/**
 * 파일 경로: /src/services/purchaseLedgerService.ts
 * 작성 날짜: 2025-10-06
 * 주요 내용: 매입 원장 서비스
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
import type { PurchaseLedger } from '../types/purchaseLedger';

/**
 * 모든 매입 원장 조회
 */
export const getAllPurchaseLedgers = async (): Promise<PurchaseLedger[]> => {
  try {
    const q = query(
      collection(db, 'purchaseLedgers'),
      orderBy('receivedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledgers:', error);
    throw new Error('매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매입 원장 ID로 조회
 */
export const getPurchaseLedgerById = async (ledgerId: string): Promise<PurchaseLedger | null> => {
  try {
    const docRef = doc(db, 'purchaseLedgers', ledgerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as unknown as PurchaseLedger;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledger:', error);
    throw new Error('매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 공급사의 매입 원장 조회
 */
export const getPurchaseLedgersBySupplierId = async (supplierId: string): Promise<PurchaseLedger[]> => {
  try {
    const q = query(
      collection(db, 'purchaseLedgers'),
      where('supplierId', '==', supplierId),
      orderBy('receivedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledgers by supplier:', error);
    throw new Error('공급사별 매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 기간의 매입 원장 조회
 */
export const getPurchaseLedgersByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<PurchaseLedger[]> => {
  try {
    const q = query(
      collection(db, 'purchaseLedgers'),
      where('receivedAt', '>=', Timestamp.fromDate(startDate)),
      where('receivedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('receivedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledgers by date range:', error);
    throw new Error('기간별 매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 오늘 입고된 매입 원장 조회
 */
export const getTodayPurchaseLedgers = async (): Promise<PurchaseLedger[]> => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  return getPurchaseLedgersByDateRange(startOfDay, endOfDay);
};

/**
 * 카테고리별 매입 원장 조회
 */
export const getPurchaseLedgersByCategory = async (category: string): Promise<PurchaseLedger[]> => {
  try {
    const q = query(
      collection(db, 'purchaseLedgers'),
      where('category', '==', category),
      orderBy('receivedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledgers by category:', error);
    throw new Error('카테고리별 매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 공급사별 + 기간별 매입 원장 조회
 */
export const getPurchaseLedgersBySupplierAndDateRange = async (
  supplierId: string,
  startDate: Date,
  endDate: Date
): Promise<PurchaseLedger[]> => {
  try {
    const q = query(
      collection(db, 'purchaseLedgers'),
      where('supplierId', '==', supplierId),
      where('receivedAt', '>=', Timestamp.fromDate(startDate)),
      where('receivedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('receivedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as PurchaseLedger));

    return ledgers;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching purchase ledgers by supplier and date range:', error);
    throw new Error('공급사별 기간별 매입 원장 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 매입 원장 통계 계산
 */
export interface PurchaseLedgerStats {
  totalCount: number;
  totalOrderedAmount: number;
  totalReceivedAmount: number;
  totalVariance: number;
  variancePercentage: number;
}

export const calculatePurchaseLedgerStats = (ledgers: PurchaseLedger[]): PurchaseLedgerStats => {
  const totalCount = ledgers.length;
  const totalOrderedAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);
  const totalReceivedAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);
  const totalVariance = totalReceivedAmount - totalOrderedAmount;
  const variancePercentage = totalOrderedAmount > 0
    ? (totalVariance / totalOrderedAmount) * 100
    : 0;

  return {
    totalCount,
    totalOrderedAmount,
    totalReceivedAmount,
    totalVariance,
    variancePercentage
  };
};

/**
 * 월별 매입 통합 통계 (지급 포함)
 */
export interface MonthlyPurchaseStats {
  totalPurchaseAmount: number;      // 매입 금액 (원장 합계)
  totalPaymentAmount: number;       // 지급액 (지급 합계)
  currentBalance: number;           // 미지급금액 (차액)
  ledgerCount: number;              // 원장 건수
  paymentCount: number;             // 지급 건수
  uniqueProductCount: number;       // 상품 종류 (고유 상품 수)
  totalItemQuantity: number;        // 상품 수량 (총 품목 수)
}

export const calculateMonthlyPurchaseStats = (
  ledgers: PurchaseLedger[],
  payments: { paymentAmount: number }[]
): MonthlyPurchaseStats => {
  // 매입 금액
  const totalPurchaseAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);

  // 지급액
  const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.paymentAmount, 0);

  // 미지급금액
  const currentBalance = totalPurchaseAmount - totalPaymentAmount;

  // 원장 건수
  const ledgerCount = ledgers.length;

  // 지급 건수
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
    totalPurchaseAmount,
    totalPaymentAmount,
    currentBalance,
    ledgerCount,
    paymentCount,
    uniqueProductCount,
    totalItemQuantity
  };
};
