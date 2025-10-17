/**
 * 파일 경로: /src/types/customerCollection.ts
 * 작성 날짜: 2025-10-17
 * 주요 내용: 고객사 수금 내역 TypeScript 타입 정의
 * 관련 데이터: Firebase customerCollections 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 수금 수단
export type CollectionMethod = 'cash' | 'card' | 'bank_transfer' | 'tax_invoice';

// 수금 상태
export type CollectionStatus = 'pending' | 'completed' | 'cancelled';

// 수금 내역
export interface CustomerCollection {
  collectionNumber: string;           // 수금번호 (CM-YYMMDD-001)
  customerId: string;              // 고객사 사업자번호

  // 고객사 정보 (스냅샷)
  customerInfo: {
    businessName: string;
    businessNumber: string;
  };

  // 수금 정보
  collectionMethod: CollectionMethod;    // 수금수단
  collectionAmount: number;           // 수금액
  collectionDate: Timestamp;          // 수금일시

  // 세금계산서 정보 (선택)
  taxInvoice?: {
    invoiceNumber: string;         // 세금계산서 번호
    issueDate: Timestamp;          // 발행일
    bankAccount: string;           // 수금 계좌
    depositDate: Timestamp;        // 수금 확인일
  };

  // 처리 정보
  status: CollectionStatus;           // 상태
  processedBy: string;             // 처리자 UID
  processedByName: string;         // 처리자 이름 (스냅샷)

  // 메타데이터
  notes?: string;                  // 비고
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 수금 등록용 폼 데이터
export interface CustomerCollectionFormData {
  customerId: string;
  collectionMethod: CollectionMethod;
  collectionAmount: number;
  collectionDate: Date;
  taxInvoice?: {
    invoiceNumber: string;
    issueDate: Date;
    bankAccount: string;
    depositDate: Date;
  };
  notes?: string;
}

// API 응답 타입
export interface CustomerCollectionResponse<T = CustomerCollection | CustomerCollection[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class CustomerCollectionServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CustomerCollectionServiceError';
    this.code = code;
  }
}

// 수금 수단 레이블
export const COLLECTION_METHOD_LABELS: Record<CollectionMethod, string> = {
  cash: '현금',
  card: '카드',
  bank_transfer: '계좌이체',
  tax_invoice: '세금계산서'
};

// 수금 상태 레이블
export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  pending: '대기',
  completed: '완료',
  cancelled: '취소'
};

// 타입 가드 함수
export const isValidCustomerCollection = (data: unknown): data is CustomerCollection => {
  const cc = data as CustomerCollection;
  return (
    cc &&
    typeof cc.collectionNumber === 'string' &&
    typeof cc.customerId === 'string' &&
    typeof cc.collectionAmount === 'number' &&
    typeof cc.collectionMethod === 'string'
  );
};
