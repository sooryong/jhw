/**
 * 파일 경로: /src/services/supplierPayoutService.ts
 * 작성 날짜: 2025-10-17
 * 주요 내용: 공급사 지급 관리 서비스
 * 관련 데이터: Firebase supplierPayouts, supplierAccounts 컬렉션
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  SupplierPayout,
  SupplierPayoutFormData
} from '../types/supplierPayout';
import { SupplierPayoutServiceError } from '../types/supplierPayout';
import type { SupplierAccount } from '../types/supplierAccount';
import type { Supplier } from '../types/company';

/**
 * 지급번호 생성 (PO-YYMMDD-001)
 */
const generatePayoutNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'supplierPayout');

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
  return `PO-${currentDate}-${paddedNumber}`;
};

/**
 * 지급 등록용 데이터 인터페이스 (내부용)
 */
interface CreatePayoutData extends SupplierPayoutFormData {
  processedBy: string;
  processedByName: string;
}

/**
 * 공급사 지급 등록
 * - 지급 내역 생성
 * - 공급사 계정 잔액 업데이트 (트랜잭션)
 */
export const createPayout = async (
  data: CreatePayoutData
): Promise<{ payoutNumber: string }> => {
  try {
    // 공급사 정보 조회
    const supplierDoc = await getDoc(doc(db, 'suppliers', data.supplierId));

    if (!supplierDoc.exists()) {
      throw new SupplierPayoutServiceError(
        '공급사 정보를 찾을 수 없습니다.',
        'SUPPLIER_NOT_FOUND'
      );
    }

    const supplier = supplierDoc.data() as Supplier;

    // 지급번호 생성
    const payoutNumber = await generatePayoutNumber();

    // 트랜잭션으로 지급 등록 + 계정 업데이트
    const result = await runTransaction(db, async (transaction) => {
      // 1. 공급사 계정 조회 (READ - 먼저 실행)
      const accountRef = doc(db, 'supplierAccounts', data.supplierId);
      const accountDoc = await transaction.get(accountRef);

      if (!accountDoc.exists()) {
        throw new SupplierPayoutServiceError(
          '공급사 계정 정보를 찾을 수 없습니다.',
          'ACCOUNT_NOT_FOUND'
        );
      }

      const account = accountDoc.data() as SupplierAccount;

      // 2. 지급 내역 생성 (WRITE)
      // TODO: 컬렉션명을 supplierPayouts로 변경 (마이그레이션 필요)
      const payoutRef = doc(collection(db, 'supplierPayments'));

      const payout: Omit<SupplierPayout, 'id'> = {
        payoutNumber,
        supplierId: data.supplierId,
        supplierInfo: {
          businessName: supplier.businessName,
          businessNumber: supplier.businessNumber
        },
        payoutMethod: data.payoutMethod,
        payoutAmount: data.payoutAmount,
        payoutDate: Timestamp.fromDate(data.payoutDate),
        status: 'completed',
        processedBy: data.processedBy,
        processedByName: data.processedByName,
        ...(data.notes && { notes: data.notes }),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // 세금계산서 정보가 있으면 추가
      if (data.receivedTaxInvoice) {
        payout.receivedTaxInvoice = {
          invoiceNumber: data.receivedTaxInvoice.invoiceNumber,
          issueDate: Timestamp.fromDate(data.receivedTaxInvoice.issueDate),
          bankAccount: data.receivedTaxInvoice.bankAccount,
          depositDate: Timestamp.fromDate(data.receivedTaxInvoice.depositDate)
        };
      }

      transaction.set(payoutRef, payout);

      // 3. 공급사 계정 업데이트 (WRITE)
      transaction.update(accountRef, {
        totalPaidAmount: account.totalPaidAmount + data.payoutAmount,
        currentBalance: account.currentBalance - data.payoutAmount,
        lastPaymentDate: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return { payoutNumber };
    });

    return result;

  } catch (error: unknown) {
    console.error('Error creating supplier payout:', error);
    if (error instanceof SupplierPayoutServiceError) {
      throw error;
    }
    throw new SupplierPayoutServiceError(
      '지급 등록 중 오류가 발생했습니다.',
      'CREATE_PAYOUT_FAILED'
    );
  }
};

/**
 * 공급사 계정 조회
 */
export const getSupplierAccount = async (supplierId: string): Promise<SupplierAccount | null> => {
  try {
    const accountDoc = await getDoc(doc(db, 'supplierAccounts', supplierId));

    if (!accountDoc.exists()) {
      return null;
    }

    return accountDoc.data() as SupplierAccount;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching supplier account:', error);
    throw new SupplierPayoutServiceError(
      '공급사 계정 조회 중 오류가 발생했습니다.',
      'FETCH_ACCOUNT_FAILED'
    );
  }
};

/**
 * 전체 공급사 계정 목록 조회
 */
export const getAllSupplierAccounts = async (): Promise<SupplierAccount[]> => {
  try {
    const q = query(
      collection(db, 'supplierAccounts'),
      orderBy('currentBalance', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as SupplierAccount);
  } catch (error) {
      // Error handled silently
    console.error('Error fetching supplier accounts:', error);
    throw new SupplierPayoutServiceError(
      '공급사 계정 목록 조회 중 오류가 발생했습니다.',
      'FETCH_ACCOUNTS_FAILED'
    );
  }
};

/**
 * 공급사별 지급 내역 조회
 */
export const getSupplierPayouts = async (
  supplierId: string,
  startDate?: Date,
  endDate?: Date
): Promise<SupplierPayout[]> => {
  try {
    let q = query(
      collection(db, 'supplierPayments'), // TODO: supplierPayouts로 변경
      where('supplierId', '==', supplierId),
      orderBy('payoutDate', 'desc')
    );

    if (startDate) {
      q = query(q, where('payoutDate', '>=', Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      q = query(q, where('payoutDate', '<=', Timestamp.fromDate(endDate)));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as SupplierPayout);
  } catch (error) {
      // Error handled silently
    console.error('Error fetching supplier payouts:', error);
    throw new SupplierPayoutServiceError(
      '지급 내역 조회 중 오류가 발생했습니다.',
      'FETCH_PAYOUTS_FAILED'
    );
  }
};

/**
 * 전체 지급 내역 조회
 */
export const getAllPayouts = async (): Promise<SupplierPayout[]> => {
  try {
    const q = query(
      collection(db, 'supplierPayments'), // TODO: supplierPayouts로 변경
      orderBy('payoutDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as SupplierPayout);
  } catch (error) {
      // Error handled silently
    console.error('Error fetching all payouts:', error);
    throw new SupplierPayoutServiceError(
      '지급 내역 목록 조회 중 오류가 발생했습니다.',
      'FETCH_ALL_PAYOUTS_FAILED'
    );
  }
};
