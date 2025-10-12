/**
 * 파일 경로: /src/services/inboundService.ts
 * 작성 날짜: 2025-10-06
 * 주요 내용: 입고 관리 서비스
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PurchaseOrder } from '../types/purchaseOrder';
import type { PurchaseLedger, PurchaseLedgerItem } from '../types/purchaseLedger';
import type { Product } from '../types/product';
import { purchaseOrderService } from './purchaseOrderService';

/**
 * 입고 대기 중인 매입주문 조회 (시간 기반 필터링, v1.1)
 * - confirmed와 completed 상태 모두 조회
 * - resetAt부터 현재까지 생성된 매입주문만 표시
 */
export const getConfirmedPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  try {
    // 일일확정 상태 조회
    const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
    const confirmationStatus = await dailyOrderCycleService.getStatus();

    // resetAt이 없으면 오늘 00:00 사용
    const resetAt = confirmationStatus.resetAt || new Date(new Date().setHours(0, 0, 0, 0));

    // resetAt 이후의 confirmed/completed 매입주문 조회
    const q = query(
      collection(db, 'purchaseOrders'),
      where('status', 'in', ['confirmed', 'completed']),
      where('placedAt', '>=', Timestamp.fromDate(resetAt)),
      orderBy('placedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseOrder));

    return orders;
  } catch (error) {
    console.error('Error fetching confirmed purchase orders:', error);
    throw new Error('입고 대기 매입주문 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 입고 검수 항목
 */
export interface InboundInspectionItem {
  productId: string;
  productName: string;
  specification?: string;
  orderedQuantity: number;     // 매입주문 수량 (참조용, 신규 상품은 0)
  orderedUnitPrice: number;    // 실제 매입단가 (필수)
  receivedQuantity: number;    // 실제 입고 수량 (필수)
}

/**
 * 입고 완료 처리
 * - 매입주문: 내용 변경 없이 상태만 'completed'로 변경
 * - 매입 원장: 실제 입고된 모든 품목 저장 (신규 상품 포함)
 * - 트랜잭션으로 원자성 보장
 */
export interface InboundCompletionData {
  purchaseOrderNumber: string;
  inspectionItems: InboundInspectionItem[];
  notes?: string;
  receivedBy: string;
}

export const completeInbound = async (
  data: InboundCompletionData
): Promise<{ purchaseLedgerId: string }> => {
  try {
    // 1. 먼저 매입주문 조회 (트랜잭션 밖에서)
    const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(data.purchaseOrderNumber);

    if (!purchaseOrder) {
      throw new Error('매입주문을 찾을 수 없습니다.');
    }

    const result = await runTransaction(db, async (transaction) => {
      // purchaseOrderNumber 필드로 문서 찾기
      const q = query(
        collection(db, 'purchaseOrders'),
        where('purchaseOrderNumber', '==', data.purchaseOrderNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('매입주문을 찾을 수 없습니다.');
      }

      const purchaseOrderRef = snapshot.docs[0].ref;

      // 2. 매입 원장 ID 생성
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const ledgerId = `PL-${dateStr}-${String(now.getTime()).slice(-5)}`;

      // 3. 입고 품목별로 상품 정보 조회하여 원장 품목 생성
      const ledgerItemsPromises = data.inspectionItems.map(async (item) => {
        // 상품 정보 조회
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);

        const product = productDoc.exists() ? (productDoc.data() as Product) : null;

        const ledgerItem: PurchaseLedgerItem = {
          productId: item.productId,
          productCode: product?.productCode || 'UNKNOWN',
          productName: item.productName,
          specification: item.specification,
          category: product?.mainCategory || '미분류',
          quantity: item.receivedQuantity,
          unitPrice: item.orderedUnitPrice,
          lineTotal: item.receivedQuantity * item.orderedUnitPrice
        };

        return ledgerItem;
      });

      const ledgerItems = await Promise.all(ledgerItemsPromises);

      // 4. 총액 계산
      const totalAmount = ledgerItems.reduce((sum, item) => sum + item.lineTotal, 0);

      // 5. 매입 원장 생성
      const purchaseLedger: Omit<PurchaseLedger, 'id'> = {
        purchaseLedgerId: ledgerId,
        purchaseOrderNumber: data.purchaseOrderNumber,
        supplierId: purchaseOrder.supplierId,
        supplierInfo: {
          businessName: purchaseOrder.supplierInfo.businessName
        },
        ledgerItems,
        totalAmount,
        itemCount: ledgerItems.length,
        receivedAt: Timestamp.now(),
        receivedBy: data.receivedBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...(data.notes && { notes: data.notes })
      };

      const purchaseLedgerRef = doc(db, 'purchaseLedgers', ledgerId);
      transaction.set(purchaseLedgerRef, purchaseLedger);

      // 6. 매입주문 상태만 업데이트 (내용 변경 없음)
      transaction.update(purchaseOrderRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
        purchaseLedgerId: ledgerId,
        updatedAt: Timestamp.now()
      });

      return { purchaseLedgerId: ledgerId };
    });

    return result;
  } catch (error) {
    console.error('Error completing inbound:', error);
    throw new Error('입고 완료 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 매입주문 상세 조회
 */
export const getPurchaseOrderById = async (orderId: string): Promise<PurchaseOrder | null> => {
  try {
    const docSnap = await getDocs(query(collection(db, 'purchaseOrders'), where('__name__', '==', orderId)));

    if (docSnap.empty) {
      return null;
    }

    return docSnap.docs[0].data() as PurchaseOrder;
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    throw new Error('매입주문 조회 중 오류가 발생했습니다.');
  }
};
