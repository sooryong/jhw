/**
 * 파일 경로: /src/services/outboundService.ts
 * 작성 날짜: 2025-10-18
 * 주요 내용: 출하 관리 서비스
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
import type { SaleOrder } from '../types/saleOrder';
import type { SaleLedger, SaleLedgerItem } from '../types/saleLedger';
import type { Product } from '../types/product';
import type { CustomerAccount } from '../types/customerAccount';
import timeRangeService from './timeRangeService';

/**
 * 출하 대기 중인 매출주문 조회
 * - confirmed와 completed 상태 모두 조회
 * - 현재 범위 시작 시간부터 현재까지 생성된 매출주문만 표시
 */
export const getConfirmedSaleOrders = async (): Promise<SaleOrder[]> => {
  try {
    // timeRangeService에서 기준 시간 가져오기
    const rangeStart = await timeRangeService.getCurrentRangeStart();

    // 기준 시간 이후의 confirmed/completed 매출주문 조회
    const q = query(
      collection(db, 'saleOrders'),
      where('status', 'in', ['confirmed', 'completed']),
      where('placedAt', '>=', Timestamp.fromDate(rangeStart)),
      orderBy('placedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleOrder));

    return orders;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching confirmed sale orders:', error);
    throw new Error('출하 대기 매출주문 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매출 원장 번호 생성 (SL-YYMMDD-001)
 */
const generateSaleLedgerNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'saleLedger');

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
  return `SL-${currentDate}-${paddedNumber}`;
};

/**
 * 출하 검수 항목
 */
export interface OutboundInspectionItem {
  productId: string;
  productName: string;
  specification?: string;
  orderedQuantity: number;     // 매출주문 수량 (참조용, 신규 상품은 0)
  orderedUnitPrice: number;    // 주문가격 (실제 판매단가)
  shippedQuantity: number;     // 실제 출하 수량 (필수)
}

/**
 * 출하 완료 처리
 * - 매출주문: 내용 변경 없이 상태만 'completed'로 변경
 * - 매출 원장: 실제 출하된 모든 품목 저장 (신규 상품 포함)
 * - 트랜잭션으로 원자성 보장
 */
export interface OutboundCompletionData {
  saleOrderNumber: string;
  inspectionItems: OutboundInspectionItem[];
  notes?: string;
  shippedBy: string;
}

export const completeOutbound = async (
  data: OutboundCompletionData
): Promise<{ saleLedgerNumber: string; saleLedgerId: string }> => {
  // 매출주문 조회 (트랜잭션 밖에서)
  const saleOrder = await getSaleOrderById(data.saleOrderNumber);

  if (!saleOrder) {
    throw new Error('매출주문을 찾을 수 없습니다.');
  }

  try {
    // 1. 매출 원장 번호 생성 (트랜잭션 밖에서)
    const saleLedgerNumber = await generateSaleLedgerNumber();

    // 2. 트랜잭션으로 원장 생성
    const result = await runTransaction(db, async (transaction) => {
      // 2-1. Firestore 자동 생성 ID로 문서 참조 생성
      const ledgerRef = doc(collection(db, 'saleLedgers'));

      // 2-2. 매출주문 참조 가져오기
      const saleOrderQuery = query(
        collection(db, 'saleOrders'),
        where('saleOrderNumber', '==', data.saleOrderNumber)
      );
      const saleOrderSnapshot = await getDocs(saleOrderQuery);

      if (saleOrderSnapshot.empty) {
        throw new Error('매출주문을 찾을 수 없습니다.');
      }

      const saleOrderRef = saleOrderSnapshot.docs[0].ref;

      // 2-3. 먼저 모든 상품 정보를 읽기 (트랜잭션 규칙: 모든 읽기를 먼저 실행)
      const productReadsPromises = data.inspectionItems.map(async (item) => {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        const product = productDoc.exists() ? (productDoc.data() as Product) : null;
        return { item, productRef, product };
      });

      const productReads = await Promise.all(productReadsPromises);

      // 2-4. 고객사 계정 읽기 (모든 읽기를 먼저 실행)
      const accountRef = doc(db, 'customerAccounts', saleOrder.customerId);
      const accountDoc = await transaction.get(accountRef);

      // === 여기서부터 쓰기 작업 시작 ===

      // 2-5. 읽기가 완료된 후 원장 품목 생성
      const ledgerItems = productReads.map(({ item, product }) => {
        return {
          productId: item.productId,
          productCode: product?.productCode || 'UNKNOWN',
          productName: item.productName,
          specification: item.specification,
          category: product?.mainCategory || '미분류',
          quantity: item.shippedQuantity,
          unitPrice: item.orderedUnitPrice,
          lineTotal: item.shippedQuantity * item.orderedUnitPrice
        } as SaleLedgerItem;
      });
      const totalAmount = ledgerItems.reduce((sum, item) => sum + item.lineTotal, 0);

      // 2-6. 매출 원장 데이터 생성
      const saleLedger: Omit<SaleLedger, 'id'> = {
        saleLedgerNumber,
        saleOrderNumber: data.saleOrderNumber,
        customerId: saleOrder.customerId,
        customerInfo: {
          businessName: saleOrder.customerInfo.businessName,
          businessNumber: saleOrder.customerId
        },
        ledgerItems,
        totalAmount,
        itemCount: ledgerItems.length,
        shippedAt: Timestamp.now(),
        shippedBy: data.shippedBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...(data.notes && { notes: data.notes })
      };

      // 2-7. 매출 원장 저장
      transaction.set(ledgerRef, saleLedger);

      // 2-8. 매출주문 상태 업데이트
      transaction.update(saleOrderRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
        saleLedgerNumber,
        saleLedgerId: ledgerRef.id,
        updatedAt: Timestamp.now()
      });

      // 2-9. 고객사 계정 업데이트 (미수금 증가)
      if (accountDoc.exists()) {
        // 기존 계정 업데이트
        const account = accountDoc.data() as CustomerAccount;
        transaction.update(accountRef, {
          totalSalesAmount: account.totalSalesAmount + totalAmount,
          currentBalance: account.currentBalance + totalAmount,
          transactionCount: account.transactionCount + 1,
          lastSaleDate: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        // 새 계정 생성
        transaction.set(accountRef, {
          customerId: saleOrder.customerId,
          customerName: saleOrder.customerInfo.businessName,
          totalSalesAmount: totalAmount,
          totalReceivedAmount: 0,
          currentBalance: totalAmount,
          transactionCount: 1,
          lastSaleDate: Timestamp.now(),
          lastPaymentDate: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      return { saleLedgerNumber, saleLedgerId: ledgerRef.id };
    });

    return result;

  } catch (error) {
    console.error('Error completing outbound:', error);
    throw new Error('출하 완료 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 매출주문 상세 조회
 */
export const getSaleOrderById = async (saleOrderNumber: string): Promise<SaleOrder | null> => {
  try {
    const q = query(
      collection(db, 'saleOrders'),
      where('saleOrderNumber', '==', saleOrderNumber)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as SaleOrder;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale order:', error);
    throw new Error('매출주문 조회 중 오류가 발생했습니다.');
  }
};
