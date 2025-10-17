/**
 * 파일 경로: /src/types/supplierPayout.ts
 * 작성 날짜: 2025-10-17
 * 주요 내용: 공급사 지급 내역 TypeScript 타입 정의
 * 관련 데이터: Firebase supplierPayouts 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 지급 수단
export type PayoutMethod = 'cash' | 'card' | 'bank_transfer' | 'tax_invoice';

// 지급 상태
export type PayoutStatus = 'pending' | 'completed' | 'cancelled';

// 지급 내역
export interface SupplierPayout {
  payoutNumber: string;           // 지급번호 (PO-YYMMDD-001)
  supplierId: string;              // 공급사 사업자번호

  // 공급사 정보 (스냅샷)
  supplierInfo: {
    businessName: string;
    businessNumber: string;
  };

  // 지급 정보
  payoutMethod: PayoutMethod; // 지급수단
  payoutAmount: number;           // 지급액
  payoutDate: Timestamp;          // 지급일시

  // 받은 세금계산서 정보 (선택)
  receivedTaxInvoice?: {
    invoiceNumber: string;         // 세금계산서 번호
    issueDate: Timestamp;          // 발행일
    bankAccount: string;           // 지급 계좌
    depositDate: Timestamp;        // 지급일
  };

  // 처리 정보
  status: PayoutStatus;   // 상태
  processedBy: string;             // 처리자 UID
  processedByName: string;         // 처리자 이름 (스냅샷)

  // 메타데이터
  notes?: string;                  // 비고
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 지급 등록용 폼 데이터
export interface SupplierPayoutFormData {
  supplierId: string;
  payoutMethod: PayoutMethod;
  payoutAmount: number;
  payoutDate: Date;
  receivedTaxInvoice?: {
    invoiceNumber: string;
    issueDate: Date;
    bankAccount: string;
    depositDate: Date;
  };
  notes?: string;
}

// API 응답 타입
export interface SupplierPayoutResponse<T = SupplierPayout | SupplierPayout[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class SupplierPayoutServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SupplierPayoutServiceError';
    this.code = code;
  }
}

// 지급 수단 레이블
export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  cash: '현금',
  card: '카드',
  bank_transfer: '계좌이체',
  tax_invoice: '세금계산서'
};

// 지급 상태 레이블
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: '대기',
  completed: '완료',
  cancelled: '취소'
};

// 타입 가드 함수
export const isValidSupplierPayout = (data: unknown): data is SupplierPayout => {
  const sp = data as SupplierPayout;
  return (
    sp &&
    typeof sp.payoutNumber === 'string' &&
    typeof sp.supplierId === 'string' &&
    typeof sp.payoutAmount === 'number' &&
    typeof sp.payoutMethod === 'string'
  );
};
