/**
 * 파일 경로: /src/services/accountLedgerService.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래처원장 생성 서비스
 */

import { Timestamp } from 'firebase/firestore';
import { getSaleLedgersByCustomerAndDateRange } from './saleLedgerService';
import { getPurchaseLedgersByDateRange } from './purchaseLedgerService';
import { getCustomer } from './customerService';
import { getSupplierById } from './supplierService';
import type {
  CustomerAccountLedger,
  SupplierAccountLedger,
  CustomerAccountLedgerEntry,
  SupplierAccountLedgerEntry,
  GenerateCustomerAccountLedgerOptions,
  GenerateSupplierAccountLedgerOptions
} from '../types/accountLedger';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CustomerCollection } from '../types/customerCollection';
import type { SupplierPayout } from '../types/supplierPayout';

/**
 * 고객사 거래처원장 생성
 */
export const generateCustomerAccountLedger = async (
  options: GenerateCustomerAccountLedgerOptions
): Promise<CustomerAccountLedger> => {
  try {
    // 고객사 정보 조회
    const customer = await getCustomer(options.customerId);
    if (!customer) {
      throw new Error('고객사 정보를 찾을 수 없습니다.');
    }

    // 기초 잔액 계산 (시작일 이전의 누적 미수금)
    const openingBalance = await calculateCustomerOpeningBalance(
      options.customerId,
      options.startDate
    );

    // 매출 원장 조회
    const saleLedgers = await getSaleLedgersByCustomerAndDateRange(
      options.customerId,
      options.startDate,
      options.endDate
    );

    // 수금 내역 조회
    const collections = await getCustomerCollectionsByDateRange(
      options.customerId,
      options.startDate,
      options.endDate
    );

    // 입출금 항목 생성
    const entries: CustomerAccountLedgerEntry[] = [];
    let runningBalance = openingBalance;

    // 매출 항목 추가
    saleLedgers.forEach(ledger => {
      runningBalance += ledger.totalAmount;
      entries.push({
        date: ledger.shippedAt,
        transactionType: 'sale',
        referenceNumber: ledger.saleLedgerNumber,
        description: `매출 (품목 ${ledger.itemCount}건)`,
        debit: ledger.totalAmount,
        credit: 0,
        balance: runningBalance,
        notes: ledger.notes
      });
    });

    // 수금 항목 추가
    collections.forEach(collection => {
      runningBalance -= collection.collectionAmount;
      entries.push({
        date: collection.collectionDate,
        transactionType: 'payment',
        referenceNumber: collection.collectionNumber,
        description: `수금 (${getPaymentMethodLabel(collection.collectionMethod)})`,
        debit: 0,
        credit: collection.collectionAmount,
        balance: runningBalance,
        notes: collection.notes
      });
    });

    // 날짜순 정렬
    entries.sort((a, b) => a.date.toMillis() - b.date.toMillis());

    // 잔액 재계산 (정렬 후)
    runningBalance = openingBalance;
    entries.forEach(entry => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    // 요약 정보 계산
    const totalSales = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalPayments = entries.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = openingBalance + totalSales - totalPayments;

    return {
      customerId: options.customerId,
      customerName: customer.businessName,
      customerBusinessNumber: customer.businessNumber,
      periodStart: options.startDate,
      periodEnd: options.endDate,
      openingBalance,
      entries,
      totalSales,
      totalPayments,
      closingBalance,
      generatedAt: new Date(),
      generatedBy: options.generatedBy,
      generatedByName: options.generatedByName
    };
  } catch (error) {
      // Error handled silently
    console.error('Error generating customer account ledger:', error);
    throw new Error('고객사 거래처원장 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 공급사 거래처원장 생성
 */
export const generateSupplierAccountLedger = async (
  options: GenerateSupplierAccountLedgerOptions
): Promise<SupplierAccountLedger> => {
  try {
    // 공급사 정보 조회
    const supplier = await getSupplierById(options.supplierId);
    if (!supplier) {
      throw new Error('공급사 정보를 찾을 수 없습니다.');
    }

    // 기초 잔액 계산
    const openingBalance = await calculateSupplierOpeningBalance(
      options.supplierId,
      options.startDate
    );

    // 매입 원장 조회
    const purchaseLedgers = await getPurchaseLedgersByDateRange(
      options.startDate,
      options.endDate
    );

    // 해당 공급사 필터링
    const filteredPurchaseLedgers = purchaseLedgers.filter(
      ledger => ledger.supplierId === options.supplierId
    );

    // 지급 내역 조회
    const payouts = await getSupplierPayoutsByDateRange(
      options.supplierId,
      options.startDate,
      options.endDate
    );

    // 입출금 항목 생성
    const entries: SupplierAccountLedgerEntry[] = [];
    let runningBalance = openingBalance;

    // 매입 항목 추가
    filteredPurchaseLedgers.forEach(ledger => {
      runningBalance += ledger.totalAmount;
      entries.push({
        date: ledger.receivedAt,
        transactionType: 'purchase',
        referenceNumber: ledger.purchaseLedgerNumber,
        description: `매입 (품목 ${ledger.itemCount}건)`,
        debit: ledger.totalAmount,
        credit: 0,
        balance: runningBalance,
        notes: ledger.notes
      });
    });

    // 지급 항목 추가
    payouts.forEach(payout => {
      runningBalance -= payout.payoutAmount;
      entries.push({
        date: payout.payoutDate,
        transactionType: 'payout',
        referenceNumber: payout.payoutNumber,
        description: `지급 (${getSupplierPaymentMethodLabel(payout.payoutMethod)})`,
        debit: 0,
        credit: payout.payoutAmount,
        balance: runningBalance,
        notes: payout.notes
      });
    });

    // 날짜순 정렬
    entries.sort((a, b) => a.date.toMillis() - b.date.toMillis());

    // 잔액 재계산
    runningBalance = openingBalance;
    entries.forEach(entry => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    // 요약 정보 계산
    const totalPurchases = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalPayouts = entries.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = openingBalance + totalPurchases - totalPayouts;

    return {
      supplierId: options.supplierId,
      supplierName: supplier.businessName,
      supplierBusinessNumber: supplier.businessNumber,
      periodStart: options.startDate,
      periodEnd: options.endDate,
      openingBalance,
      entries,
      totalPurchases,
      totalPayouts,
      closingBalance,
      generatedAt: new Date(),
      generatedBy: options.generatedBy,
      generatedByName: options.generatedByName
    };
  } catch (error) {
      // Error handled silently
    console.error('Error generating supplier account ledger:', error);
    throw new Error('공급사 거래처원장 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사 기초 잔액 계산 (시작일 이전 누적)
 */
const calculateCustomerOpeningBalance = async (
  customerId: string,
  startDate: Date
): Promise<number> => {
  try {
    // 시작일 이전의 모든 매출
    const salesQuery = query(
      collection(db, 'saleLedgers'),
      where('customerId', '==', customerId),
      where('shippedAt', '<', Timestamp.fromDate(startDate))
    );
    const salesSnapshot = await getDocs(salesQuery);
    const totalSales = salesSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.totalAmount || 0);
    }, 0);

    // 시작일 이전의 모든 수금
    const paymentsQuery = query(
      collection(db, 'customerPayments'),
      where('customerId', '==', customerId),
      where('collectionDate', '<', Timestamp.fromDate(startDate)),
      where('status', '==', 'completed')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const totalPayments = paymentsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.collectionAmount || 0);
    }, 0);

    return totalSales - totalPayments;
  } catch (error) {
      // Error handled silently
    console.error('Error calculating opening balance:', error);
    return 0;
  }
};

/**
 * 공급사 기초 잔액 계산
 */
const calculateSupplierOpeningBalance = async (
  supplierId: string,
  startDate: Date
): Promise<number> => {
  try {
    // 시작일 이전의 모든 매입
    const purchasesQuery = query(
      collection(db, 'purchaseLedgers'),
      where('supplierId', '==', supplierId),
      where('receivedAt', '<', Timestamp.fromDate(startDate))
    );
    const purchasesSnapshot = await getDocs(purchasesQuery);
    const totalPurchases = purchasesSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.totalAmount || 0);
    }, 0);

    // 시작일 이전의 모든 지급
    const payoutsQuery = query(
      collection(db, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      where('payoutDate', '<', Timestamp.fromDate(startDate)),
      where('status', '==', 'completed')
    );
    const payoutsSnapshot = await getDocs(payoutsQuery);
    const totalPayouts = payoutsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.payoutAmount || 0);
    }, 0);

    return totalPurchases - totalPayouts;
  } catch (error) {
      // Error handled silently
    console.error('Error calculating supplier opening balance:', error);
    return 0;
  }
};

/**
 * 고객사 수금 내역 조회 (기간별)
 */
const getCustomerCollectionsByDateRange = async (
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<CustomerCollection[]> => {
  try {
    const q = query(
      collection(db, 'customerPayments'),
      where('customerId', '==', customerId),
      where('collectionDate', '>=', Timestamp.fromDate(startDate)),
      where('collectionDate', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed'),
      orderBy('collectionDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as CustomerCollection));
  } catch (error) {
      // Error handled silently
    console.error('Error fetching customer payments:', error);
    return [];
  }
};

/**
 * 공급사 지급 내역 조회 (기간별)
 */
const getSupplierPayoutsByDateRange = async (
  supplierId: string,
  startDate: Date,
  endDate: Date
): Promise<SupplierPayout[]> => {
  try {
    const q = query(
      collection(db, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      where('payoutDate', '>=', Timestamp.fromDate(startDate)),
      where('payoutDate', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed'),
      orderBy('payoutDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SupplierPayout));
  } catch (error) {
      // Error handled silently
    console.error('Error fetching supplier payments:', error);
    return [];
  }
};

/**
 * 결제 수단 레이블 (고객사)
 */
const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: '현금',
    card: '카드',
    bank_transfer: '계좌이체',
    tax_invoice: '세금계산서'
  };
  return labels[method] || method;
};

/**
 * 결제 수단 레이블 (공급사)
 */
const getSupplierPaymentMethodLabel = (method: string): string => {
  return getPaymentMethodLabel(method);
};
