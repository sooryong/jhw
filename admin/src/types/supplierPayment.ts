/**
 * 파일 경로: /src/types/supplierPayment.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 지급 내역 TypeScript 타입 정의
 * 관련 데이터: Firebase supplierPayments 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 지급 수단
export type SupplierPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'tax_invoice';

// 지급 상태
export type SupplierPaymentStatus = 'pending' | 'completed' | 'cancelled';

// 지급 내역
export interface SupplierPayment {
  paymentNumber: string;           // 지급번호 (SP-YYMMDD-001)
  supplierId: string;              // 공급사 사업자번호

  // 공급사 정보 (스냅샷)
  supplierInfo: {
    businessName: string;
    businessNumber: string;
  };

  // 지급 정보
  paymentMethod: SupplierPaymentMethod; // 지급수단
  paymentAmount: number;           // 지급액
  paymentDate: Timestamp;          // 지급일시

  // 받은 세금계산서 정보 (선택)
  receivedTaxInvoice?: {
    invoiceNumber: string;         // 세금계산서 번호
    issueDate: Timestamp;          // 발행일
    bankAccount: string;           // 입금 계좌
    depositDate: Timestamp;        // 입금일
  };

  // 처리 정보
  status: SupplierPaymentStatus;   // 상태
  processedBy: string;             // 처리자 UID
  processedByName: string;         // 처리자 이름 (스냅샷)

  // 메타데이터
  notes?: string;                  // 비고
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 지급 등록용 폼 데이터
export interface SupplierPaymentFormData {
  supplierId: string;
  paymentMethod: SupplierPaymentMethod;
  paymentAmount: number;
  paymentDate: Date;
  receivedTaxInvoice?: {
    invoiceNumber: string;
    issueDate: Date;
    bankAccount: string;
    depositDate: Date;
  };
  notes?: string;
}

// API 응답 타입
export interface SupplierPaymentResponse<T = SupplierPayment | SupplierPayment[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class SupplierPaymentServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SupplierPaymentServiceError';
    this.code = code;
  }
}

// 지급 수단 레이블
export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  bank_transfer: '계좌이체',
  tax_invoice: '세금계산서'
};

// 지급 상태 레이블
export const SUPPLIER_PAYMENT_STATUS_LABELS: Record<SupplierPaymentStatus, string> = {
  pending: '대기',
  completed: '완료',
  cancelled: '취소'
};

// 타입 가드 함수
export const isValidSupplierPayment = (data: unknown): data is SupplierPayment => {
  const sp = data as SupplierPayment;
  return (
    sp &&
    typeof sp.paymentNumber === 'string' &&
    typeof sp.supplierId === 'string' &&
    typeof sp.paymentAmount === 'number' &&
    typeof sp.paymentMethod === 'string'
  );
};
