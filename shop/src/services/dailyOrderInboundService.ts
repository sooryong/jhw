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
      // Error handled silently
    console.error('Error fetching confirmed purchase orders:', error);
    throw new Error('입고 대기 매입주문 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매입 원장 번호 생성 (PL-YYMMDD-001)
 */
const generatePurchaseLedgerNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'purchaseLedger');

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let lastNumber = 0;
    let storedDate = currentDate;

    if (counterDoc.exists()) {
      const data = counterDoc.data();
      lastNumber = data.lastNumber || 0;
      storedDate = data.currentDate || currentDate;
    }

    // 날짜가 바뀌면 카운터 리셋
    const nextNumber = (storedDate === currentDate) ? lastNumber + 1 : 1;

    // 카운터 업데이트
    transaction.set(counterRef, {
      lastNumber: nextNumber,
      currentDate: currentDate
    }, { merge: true });

    return nextNumber;
  });

  // 3자리 패딩 (overflow 시 4자리 이상 허용)
  const paddedNumber = newNumber.toString().padStart(3, '0');
  return `PL-${currentDate}-${paddedNumber}`;
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
): Promise<{ purchaseLedgerNumber: string }> => {
  // 매입주문 조회 (트랜잭션 밖에서)
  const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(data.purchaseOrderNumber);

  if (!purchaseOrder) {
    throw new Error('매입주문을 찾을 수 없습니다.');
  }

  try {
    // 1. 매입 원장 번호 생성 (트랜잭션 밖에서)
    const purchaseLedgerNumber = await generatePurchaseLedgerNumber();

    // 2. 트랜잭션으로 원장 생성
    const result = await runTransaction(db, async (transaction) => {
      // 2-1. Firestore 자동 생성 ID로 문서 참조 생성
      const ledgerRef = doc(collection(db, 'purchaseLedgers'));

      // 2-2. 매입주문 참조 가져오기
      const purchaseOrderQuery = query(
        collection(db, 'purchaseOrders'),
        where('purchaseOrderNumber', '==', data.purchaseOrderNumber)
      );
      const purchaseOrderSnapshot = await getDocs(purchaseOrderQuery);

      if (purchaseOrderSnapshot.empty) {
        throw new Error('매입주문을 찾을 수 없습니다.');
      }

      const purchaseOrderRef = purchaseOrderSnapshot.docs[0].ref;

      // 2-3. 입고 품목별로 상품 정보 조회하여 원장 품목 생성
      const ledgerItemsPromises = data.inspectionItems.map(async (item) => {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        const product = productDoc.exists() ? (productDoc.data() as Product) : null;

        return {
          productId: item.productId,
          productCode: product?.productCode || 'UNKNOWN',
          productName: item.productName,
          specification: item.specification,
          category: product?.mainCategory || '미분류',
          quantity: item.receivedQuantity,
          unitPrice: item.orderedUnitPrice,
          lineTotal: item.receivedQuantity * item.orderedUnitPrice
        } as PurchaseLedgerItem;
      });

      const ledgerItems = await Promise.all(ledgerItemsPromises);
      const totalAmount = ledgerItems.reduce((sum, item) => sum + item.lineTotal, 0);

      // 2-4. 매입 원장 데이터 생성
      const purchaseLedger: Omit<PurchaseLedger, 'id'> = {
        purchaseLedgerNumber,
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

      // 2-5. 매입 원장 저장
      transaction.set(ledgerRef, purchaseLedger);

      // 2-6. 매입주문 상태 업데이트
      transaction.update(purchaseOrderRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
        purchaseLedgerNumber,
        updatedAt: Timestamp.now()
      });

      return { purchaseLedgerNumber };
    });

    return result;

  } catch (error: unknown) {
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
      // Error handled silently
    console.error('Error fetching purchase order:', error);
    throw new Error('매입주문 조회 중 오류가 발생했습니다.');
  }
};
