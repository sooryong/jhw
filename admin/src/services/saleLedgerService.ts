/**
 * 파일 경로: /src/services/saleLedgerService.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 매출 원장 서비스
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SaleLedger } from '../types/saleLedger';

/**
 * 모든 매출 원장 조회
 */
export const getAllSaleLedgers = async (): Promise<SaleLedger[]> => {
  try {
    const q = query(
      collection(db, 'saleLedgers'),
      orderBy('shippedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledgers:', error);
    throw new Error('매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매출 원장 ID로 조회
 */
export const getSaleLedgerById = async (ledgerId: string): Promise<SaleLedger | null> => {
  try {
    const docRef = doc(db, 'saleLedgers', ledgerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as unknown as SaleLedger;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledger:', error);
    throw new Error('매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 고객사의 매출 원장 조회
 */
export const getSaleLedgersByCustomerId = async (customerId: string): Promise<SaleLedger[]> => {
  try {
    const q = query(
      collection(db, 'saleLedgers'),
      where('customerId', '==', customerId),
      orderBy('shippedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledgers by customer:', error);
    throw new Error('고객사별 매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 기간의 매출 원장 조회
 */
export const getSaleLedgersByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<SaleLedger[]> => {
  try {
    const q = query(
      collection(db, 'saleLedgers'),
      where('shippedAt', '>=', Timestamp.fromDate(startDate)),
      where('shippedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('shippedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledgers by date range:', error);
    throw new Error('기간별 매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 오늘 출하된 매출 원장 조회
 */
export const getTodaySaleLedgers = async (): Promise<SaleLedger[]> => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  return getSaleLedgersByDateRange(startOfDay, endOfDay);
};

/**
 * 카테고리별 매출 원장 조회
 */
export const getSaleLedgersByCategory = async (category: string): Promise<SaleLedger[]> => {
  try {
    const q = query(
      collection(db, 'saleLedgers'),
      where('category', '==', category),
      orderBy('shippedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledgers by category:', error);
    throw new Error('카테고리별 매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사별 + 기간별 매출 원장 조회
 */
export const getSaleLedgersByCustomerAndDateRange = async (
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<SaleLedger[]> => {
  try {
    const q = query(
      collection(db, 'saleLedgers'),
      where('customerId', '==', customerId),
      where('shippedAt', '>=', Timestamp.fromDate(startDate)),
      where('shippedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('shippedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching sale ledgers by customer and date range:', error);
    throw new Error('고객사별 기간별 매출 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매출 원장 통계 계산
 */
export interface SaleLedgerStats {
  totalCount: number;
  totalSalesAmount: number;
  averageSalesAmount: number;
  totalItemCount: number;
}

export const calculateSaleLedgerStats = (ledgers: SaleLedger[]): SaleLedgerStats => {
  const totalCount = ledgers.length;
  const totalSalesAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);
  const averageSalesAmount = totalCount > 0 ? totalSalesAmount / totalCount : 0;
  const totalItemCount = ledgers.reduce((sum, ledger) => sum + ledger.itemCount, 0);

  return {
    totalCount,
    totalSalesAmount,
    averageSalesAmount,
    totalItemCount
  };
};

/**
 * 월별 매출 통합 통계 (세금계산서용)
 */
export interface MonthlySalesStats {
  totalSalesAmount: number;      // 매출 금액 (원장 합계)
  totalPaymentAmount: number;    // 입금액 (수금 합계)
  currentBalance: number;        // 미수금액 (차액)
  ledgerCount: number;           // 원장 건수
  paymentCount: number;          // 입금 건수
  uniqueProductCount: number;    // 상품 종류 (고유 상품 수)
  totalItemQuantity: number;     // 상품 수량 (총 품목 수)
}

export const calculateMonthlySalesStats = (
  ledgers: SaleLedger[],
  payments: { paymentAmount: number }[]
): MonthlySalesStats => {
  // 매출 금액
  const totalSalesAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);

  // 입금액
  const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.paymentAmount, 0);

  // 미수금액
  const currentBalance = totalSalesAmount - totalPaymentAmount;

  // 원장 건수
  const ledgerCount = ledgers.length;

  // 입금 건수
  const paymentCount = payments.length;

  // 상품 종류 (고유 productId 개수)
  const uniqueProductIds = new Set<string>();
  ledgers.forEach(ledger => {
    ledger.ledgerItems.forEach(item => {
      uniqueProductIds.add(item.productId);
    });
  });
  const uniqueProductCount = uniqueProductIds.size;

  // 상품 수량 (총 품목 quantity 합계)
  const totalItemQuantity = ledgers.reduce((sum, ledger) => {
    return sum + ledger.ledgerItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  return {
    totalSalesAmount,
    totalPaymentAmount,
    currentBalance,
    ledgerCount,
    paymentCount,
    uniqueProductCount,
    totalItemQuantity
  };
};
