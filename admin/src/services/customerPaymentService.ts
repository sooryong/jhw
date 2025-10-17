/**
 * 파일 경로: /src/services/customerPaymentService.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 수금 처리 서비스
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  runTransaction,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  CustomerPayment,
  // CustomerPaymentFormData - unused, may be needed in future
  PaymentMethod
} from '../types/customerPayment';
import type { CustomerAccount } from '../types/customerAccount';

/**
 * 수금번호 생성 (PM-YYMMDD-001)
 */
const generatePaymentNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'customerPayment');

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
  return `PM-${currentDate}-${paddedNumber}`;
};

/**
 * 수금 등록 데이터
 */
export interface CreatePaymentData {
  customerId: string;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  paymentDate: Date;
  taxInvoice?: {
    invoiceNumber: string;
    issueDate: Date;
    bankAccount: string;
    depositDate: Date;
  };
  notes?: string;
  processedBy: string;              // 처리자 UID
  processedByName: string;          // 처리자 이름
}

/**
 * 수금 처리
 * - 수금 내역 생성
 * - 고객사 계정 미수금 감소
 * - 트랜잭션으로 원자성 보장
 */
export const createPayment = async (
  data: CreatePaymentData
): Promise<{ paymentNumber: string }> => {
  try {
    // 1. 수금번호 생성 (트랜잭션 밖에서)
    const paymentNumber = await generatePaymentNumber();

    // 2. 트랜잭션으로 수금 등록 및 계정 업데이트
    const result = await runTransaction(db, async (transaction) => {
      // 2-1. 고객사 정보 조회 (읽기 1)
      const customerRef = doc(db, 'customers', data.customerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error('고객사를 찾을 수 없습니다.');
      }

      const customer = customerDoc.data();

      // 2-2. 고객사 계정 조회 (읽기 2) - 모든 읽기를 먼저 수행
      const accountRef = doc(db, 'customerAccounts', data.customerId);
      const accountDoc = await transaction.get(accountRef);

      if (!accountDoc.exists()) {
        throw new Error('고객사 계정을 찾을 수 없습니다. 매출 발생 후 수금을 등록해주세요.');
      }

      const account = accountDoc.data() as CustomerAccount;

      // 2-3. Firestore 자동 생성 ID로 문서 참조 생성
      const paymentRef = doc(collection(db, 'customerPayments'));

      // 2-4. 수금 내역 데이터 생성
      const payment: Omit<CustomerPayment, 'id'> = {
        paymentNumber,
        customerId: data.customerId,
        customerInfo: {
          businessName: customer.businessName,
          businessNumber: data.customerId
        },
        paymentMethod: data.paymentMethod,
        paymentAmount: data.paymentAmount,
        paymentDate: Timestamp.fromDate(data.paymentDate),
        ...(data.taxInvoice && {
          taxInvoice: {
            invoiceNumber: data.taxInvoice.invoiceNumber,
            issueDate: Timestamp.fromDate(data.taxInvoice.issueDate),
            bankAccount: data.taxInvoice.bankAccount,
            depositDate: Timestamp.fromDate(data.taxInvoice.depositDate)
          }
        }),
        status: 'completed',
        processedBy: data.processedBy,
        processedByName: data.processedByName,
        ...(data.notes && { notes: data.notes }),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // 2-5. 수금 내역 저장 (쓰기 1)
      transaction.set(paymentRef, payment);

      // 2-6. 고객사 계정 업데이트 (쓰기 2)
      transaction.update(accountRef, {
        totalReceivedAmount: account.totalReceivedAmount + data.paymentAmount,
        currentBalance: account.currentBalance - data.paymentAmount,
        lastPaymentDate: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return { paymentNumber };
    });

    return result;

  } catch (error: unknown) {
    console.error('Error creating payment:', error);
    throw new Error(error.message || '수금 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사별 계정 조회
 */
export const getCustomerAccount = async (
  customerId: string
): Promise<CustomerAccount | null> => {
  try {
    const accountRef = doc(db, 'customerAccounts', customerId);
    const accountDoc = await getDoc(accountRef);

    if (!accountDoc.exists()) {
      return null;
    }

    return {
      id: accountDoc.id,
      ...accountDoc.data()
    } as CustomerAccount;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching customer account:', error);
    throw new Error('고객사 계정 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 전체 고객사 계정 목록 조회
 */
export const getAllCustomerAccounts = async (): Promise<CustomerAccount[]> => {
  try {
    const q = query(
      collection(db, 'customerAccounts'),
      orderBy('currentBalance', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CustomerAccount));
  } catch (error) {
      // Error handled silently
    console.error('Error fetching customer accounts:', error);
    throw new Error('고객사 계정 목록 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사별 수금 내역 조회
 */
export const getCustomerPayments = async (
  customerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CustomerPayment[]> => {
  try {
    let q = query(
      collection(db, 'customerPayments'),
      where('customerId', '==', customerId),
      orderBy('paymentDate', 'desc')
    );

    if (startDate) {
      q = query(q, where('paymentDate', '>=', Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      q = query(q, where('paymentDate', '<=', Timestamp.fromDate(endDate)));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CustomerPayment));
  } catch (error) {
      // Error handled silently
    console.error('Error fetching customer payments:', error);
    throw new Error('수금 내역 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 전체 수금 내역 조회
 */
export const getAllPayments = async (
  startDate?: Date,
  endDate?: Date
): Promise<CustomerPayment[]> => {
  try {
    let q = query(
      collection(db, 'customerPayments'),
      orderBy('paymentDate', 'desc')
    );

    if (startDate) {
      q = query(q, where('paymentDate', '>=', Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      q = query(q, where('paymentDate', '<=', Timestamp.fromDate(endDate)));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CustomerPayment));
  } catch (error) {
      // Error handled silently
    console.error('Error fetching all payments:', error);
    throw new Error('수금 내역 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 수금번호로 수금 내역 조회
 */
export const getPaymentByNumber = async (
  paymentNumber: string
): Promise<CustomerPayment | null> => {
  try {
    const q = query(
      collection(db, 'customerPayments'),
      where('paymentNumber', '==', paymentNumber)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as CustomerPayment;
  } catch (error) {
      // Error handled silently
    console.error('Error fetching payment by number:', error);
    throw new Error('수금 내역 조회 중 오류가 발생했습니다.');
  }
};

export default {
  createPayment,
  getCustomerAccount,
  getAllCustomerAccounts,
  getCustomerPayments,
  getAllPayments,
  getPaymentByNumber
};
