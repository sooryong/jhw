/**
 * 파일 경로: /src/types/customerPayment.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 수금 내역 TypeScript 타입 정의
 * 관련 데이터: Firebase customerPayments 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 결제 수단
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'tax_invoice';

// 수금 상태
export type PaymentStatus = 'pending' | 'completed' | 'cancelled';

// 수금 내역
export interface CustomerPayment {
  paymentNumber: string;           // 수금번호 (PM-YYMMDD-001)
  customerId: string;              // 고객사 사업자번호

  // 고객사 정보 (스냅샷)
  customerInfo: {
    businessName: string;
    businessNumber: string;
  };

  // 수금 정보
  paymentMethod: PaymentMethod;    // 결제수단
  paymentAmount: number;           // 수금액
  paymentDate: Timestamp;          // 수금일시

  // 세금계산서 정보 (선택)
  taxInvoice?: {
    invoiceNumber: string;         // 세금계산서 번호
    issueDate: Timestamp;          // 발행일
    bankAccount: string;           // 입금 계좌
    depositDate: Timestamp;        // 입금 확인일
  };

  // 처리 정보
  status: PaymentStatus;           // 상태
  processedBy: string;             // 처리자 UID
  processedByName: string;         // 처리자 이름 (스냅샷)

  // 메타데이터
  notes?: string;                  // 비고
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 수금 등록용 폼 데이터
export interface CustomerPaymentFormData {
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
}

// API 응답 타입
export interface CustomerPaymentResponse<T = CustomerPayment | CustomerPayment[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class CustomerPaymentServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CustomerPaymentServiceError';
    this.code = code;
  }
}

// 결제 수단 레이블
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  bank_transfer: '계좌이체',
  tax_invoice: '세금계산서'
};

// 수금 상태 레이블
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '대기',
  completed: '완료',
  cancelled: '취소'
};

// 타입 가드 함수
export const isValidCustomerPayment = (data: unknown): data is CustomerPayment => {
  const cp = data as CustomerPayment;
  return (
    cp &&
    typeof cp.paymentNumber === 'string' &&
    typeof cp.customerId === 'string' &&
    typeof cp.paymentAmount === 'number' &&
    typeof cp.paymentMethod === 'string'
  );
};
