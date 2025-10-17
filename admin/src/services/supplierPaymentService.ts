/**
 * 파일 경로: /src/services/supplierPaymentService.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 지급 관리 서비스
 * 관련 데이터: Firebase supplierPayments, supplierAccounts 컬렉션
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
  SupplierPayment,
  SupplierPaymentFormData
} from '../types/supplierPayment';
import { SupplierPaymentServiceError } from '../types/supplierPayment';
import type { SupplierAccount } from '../types/supplierAccount';
import type { Supplier } from '../types/company';

/**
 * 지급번호 생성 (SP-YYMMDD-001)
 */
const generatePaymentNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'supplierPayment');

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
  return `SP-${currentDate}-${paddedNumber}`;
};

/**
 * 지급 등록용 데이터 인터페이스 (내부용)
 */
interface CreatePaymentData extends SupplierPaymentFormData {
  processedBy: string;
  processedByName: string;
}

/**
 * 공급사 지급 등록
 * - 지급 내역 생성
 * - 공급사 계정 잔액 업데이트 (트랜잭션)
 */
export const createPayment = async (
  data: CreatePaymentData
): Promise<{ paymentNumber: string }> => {
  try {
    // 공급사 정보 조회
    const supplierDoc = await getDoc(doc(db, 'suppliers', data.supplierId));

    if (!supplierDoc.exists()) {
      throw new SupplierPaymentServiceError(
        '공급사 정보를 찾을 수 없습니다.',
        'SUPPLIER_NOT_FOUND'
      );
    }

    const supplier = supplierDoc.data() as Supplier;

    // 지급번호 생성
    const paymentNumber = await generatePaymentNumber();

    // 트랜잭션으로 지급 등록 + 계정 업데이트
    const result = await runTransaction(db, async (transaction) => {
      // 1. 공급사 계정 조회 (READ - 먼저 실행)
      const accountRef = doc(db, 'supplierAccounts', data.supplierId);
      const accountDoc = await transaction.get(accountRef);

      if (!accountDoc.exists()) {
        throw new SupplierPaymentServiceError(
          '공급사 계정 정보를 찾을 수 없습니다.',
          'ACCOUNT_NOT_FOUND'
        );
      }

      const account = accountDoc.data() as SupplierAccount;

      // 2. 지급 내역 생성 (WRITE)
      const paymentRef = doc(collection(db, 'supplierPayments'));

      const payment: Omit<SupplierPayment, 'id'> = {
        paymentNumber,
        supplierId: data.supplierId,
        supplierInfo: {
          businessName: supplier.businessName,
          businessNumber: supplier.businessNumber
        },
        paymentMethod: data.paymentMethod,
        paymentAmount: data.paymentAmount,
        paymentDate: Timestamp.fromDate(data.paymentDate),
        status: 'completed',
        processedBy: data.processedBy,
        processedByName: data.processedByName,
        ...(data.notes && { notes: data.notes }),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // 세금계산서 정보가 있으면 추가
      if (data.receivedTaxInvoice) {
        payment.receivedTaxInvoice = {
          invoiceNumber: data.receivedTaxInvoice.invoiceNumber,
          issueDate: Timestamp.fromDate(data.receivedTaxInvoice.issueDate),
          bankAccount: data.receivedTaxInvoice.bankAccount,
          depositDate: Timestamp.fromDate(data.receivedTaxInvoice.depositDate)
        };
      }

      transaction.set(paymentRef, payment);

      // 3. 공급사 계정 업데이트 (WRITE)
      transaction.update(accountRef, {
        totalPaidAmount: account.totalPaidAmount + data.paymentAmount,
        currentBalance: account.currentBalance - data.paymentAmount,
        lastPaymentDate: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return { paymentNumber };
    });

    return result;

  } catch (error: unknown) {
    console.error('Error creating supplier payment:', error);
    if (error instanceof SupplierPaymentServiceError) {
      throw error;
    }
    throw new SupplierPaymentServiceError(
      '지급 등록 중 오류가 발생했습니다.',
      'CREATE_PAYMENT_FAILED'
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
    throw new SupplierPaymentServiceError(
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
    throw new SupplierPaymentServiceError(
      '공급사 계정 목록 조회 중 오류가 발생했습니다.',
      'FETCH_ACCOUNTS_FAILED'
    );
  }
};

/**
 * 공급사별 지급 내역 조회
 */
export const getSupplierPayments = async (
  supplierId: string,
  startDate?: Date,
  endDate?: Date
): Promise<SupplierPayment[]> => {
  try {
    let q = query(
      collection(db, 'supplierPayments'),
      where('supplierId', '==', supplierId),
      orderBy('paymentDate', 'desc')
    );

    if (startDate) {
      q = query(q, where('paymentDate', '>=', Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      q = query(q, where('paymentDate', '<=', Timestamp.fromDate(endDate)));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as SupplierPayment);
  } catch (error) {
      // Error handled silently
    console.error('Error fetching supplier payments:', error);
    throw new SupplierPaymentServiceError(
      '지급 내역 조회 중 오류가 발생했습니다.',
      'FETCH_PAYMENTS_FAILED'
    );
  }
};

/**
 * 전체 지급 내역 조회
 */
export const getAllPayments = async (): Promise<SupplierPayment[]> => {
  try {
    const q = query(
      collection(db, 'supplierPayments'),
      orderBy('paymentDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as SupplierPayment);
  } catch (error) {
      // Error handled silently
    console.error('Error fetching all payments:', error);
    throw new SupplierPaymentServiceError(
      '지급 내역 목록 조회 중 오류가 발생했습니다.',
      'FETCH_ALL_PAYMENTS_FAILED'
    );
  }
};
