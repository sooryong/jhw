/**
 * 파일 경로: /src/services/supplierStatementService.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 거래명세서 생성 서비스
 * 관련 데이터: purchaseLedgers, supplierPayments 조회
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SupplierStatement } from '../types/supplierStatement';
import { SupplierStatementServiceError } from '../types/supplierStatement';
import type { PurchaseLedger } from '../types/purchaseLedger';
import type { SupplierPayout } from '../types/supplierPayout';
import { getSupplierAccount } from './supplierPayoutService';
import { getDoc, doc } from 'firebase/firestore';
import type { Supplier } from '../types/company';

/**
 * 공급사 거래명세서 생성
 *
 * @param supplierId - 공급사 사업자번호
 * @param startDate - 조회 시작일
 * @param endDate - 조회 종료일
 * @param generatedBy - 생성자 UID
 * @returns 거래명세서
 */
export const generateStatement = async (
  supplierId: string,
  startDate: Date,
  endDate: Date,
  generatedBy: string
): Promise<SupplierStatement> => {
  try {
    // 1. 공급사 정보 조회
    const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));

    if (!supplierDoc.exists()) {
      throw new SupplierStatementServiceError(
        '공급사 정보를 찾을 수 없습니다.',
        'SUPPLIER_NOT_FOUND'
      );
    }

    const supplier = supplierDoc.data() as Supplier;

    // 2. 현재 공급사 계정 조회
    const account = await getSupplierAccount(supplierId);

    if (!account) {
      throw new SupplierStatementServiceError(
        '공급사 계정 정보를 찾을 수 없습니다.',
        'ACCOUNT_NOT_FOUND'
      );
    }

    // 3. 기간 이전의 잔액 계산
    const previousPurchasesQuery = query(
      collection(db, 'purchaseLedgers'),
      where('supplierId', '==', supplierId),
      where('receivedAt', '<', Timestamp.fromDate(startDate))
    );

    const previousPayoutsQuery = query(
      collection(db, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      where('payoutDate', '<', Timestamp.fromDate(startDate))
    );

    const [previousPurchasesSnapshot, previousPaymentsSnapshot] = await Promise.all([
      getDocs(previousPurchasesQuery),
      getDocs(previousPayoutsQuery)
    ]);

    const previousPurchaseAmount = previousPurchasesSnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data() as PurchaseLedger).totalAmount,
      0
    );

    const previousPaymentAmount = previousPaymentsSnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data() as SupplierPayout).payoutAmount,
      0
    );

    const previousBalance = previousPurchaseAmount - previousPaymentAmount;

    // 4. 기간 내 매입원장 조회
    const purchaseLedgersQuery = query(
      collection(db, 'purchaseLedgers'),
      where('supplierId', '==', supplierId),
      where('receivedAt', '>=', Timestamp.fromDate(startDate)),
      where('receivedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('receivedAt', 'asc')
    );

    const purchaseLedgersSnapshot = await getDocs(purchaseLedgersQuery);
    const purchaseLedgers = purchaseLedgersSnapshot.docs.map(
      doc => doc.data() as PurchaseLedger
    );

    const currentPurchaseAmount = purchaseLedgers.reduce(
      (sum, ledger) => sum + ledger.totalAmount,
      0
    );

    // 5. 기간 내 지급 내역 조회
    const payoutsQuery = query(
      collection(db, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      where('payoutDate', '>=', Timestamp.fromDate(startDate)),
      where('payoutDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('payoutDate', 'asc')
    );

    const payoutsSnapshot = await getDocs(payoutsQuery);
    const payouts = payoutsSnapshot.docs.map(
      doc => doc.data() as SupplierPayout
    );

    const currentPayoutAmount = payouts.reduce(
      (sum, payout) => sum + payout.payoutAmount,
      0
    );

    // 6. 현재 잔액 계산
    const currentBalance = previousBalance + currentPurchaseAmount - currentPayoutAmount;

    // 7. 거래명세서 생성
    const statement: SupplierStatement = {
      supplierId,
      supplierName: supplier.businessName,
      periodStart: startDate,
      periodEnd: endDate,
      previousBalance,
      currentPurchaseAmount,
      currentPayoutAmount,
      currentBalance,
      purchaseLedgers,
      payouts,
      generatedAt: new Date(),
      generatedBy
    };

    return statement;

  } catch (error: unknown) {
    console.error('Error generating supplier statement:', error);
    if (error instanceof SupplierStatementServiceError) {
      throw error;
    }
    throw new SupplierStatementServiceError(
      '거래명세서 생성 중 오류가 발생했습니다.',
      'GENERATE_STATEMENT_FAILED'
    );
  }
};
