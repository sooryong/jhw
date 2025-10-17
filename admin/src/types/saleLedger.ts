/**
 * 파일 경로: /src/types/saleLedger.ts
 * 작성 날짜: 2025-10-13
 * 주요 내용: 매출 원장 TypeScript 타입 정의
 * 관련 데이터: Firebase saleLedgers 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 매출 원장 상품 정보
export interface SaleLedgerItem {
  productId: string;          // 상품 ID
  productCode: string;        // 상품 코드 (예: P12345678)
  productName: string;         // 상품명
  specification?: string;      // 상품 규격
  category: string;           // 상품 카테고리 (일일식품, 냉동식품, 공산품 등)

  // 실제 판매 정보
  quantity: number;           // 실제 출하 수량
  unitPrice: number;          // 실제 판매단가
  lineTotal: number;          // 라인 소계 (quantity × unitPrice)
}

// 매출 원장
export interface SaleLedger {
  // 기본 식별
  saleLedgerNumber: string;        // 매출원장번호 (SL-YYMMDD-001)
  saleOrderNumber: string;     // 원본 매출주문번호 (참조용)
  customerId: string;          // 고객사 사업자번호 (하이픈 제거)

  // 고객사 정보 (스냅샷)
  customerInfo: {
    businessName: string;      // 상호명
    businessNumber?: string;   // 사업자번호
  };

  // 실제 판매 품목 (출하된 품목만, 신규 상품 포함 가능)
  ledgerItems: SaleLedgerItem[];

  // 금액 정보
  totalAmount: number;         // 총 판매금액

  // 품목 수
  itemCount: number;           // 총 품목 수

  // 출하 정보
  shippedAt: Timestamp;        // 출하 완료일시
  shippedBy: string;           // 출하 처리자 UID (admin/staff)

  // 메타데이터
  createdAt: Timestamp;        // 생성일시
  updatedAt: Timestamp;        // 수정일시

  // 비고
  notes?: string;              // 출하 시 특이사항
}

// 매출 원장 등록용 폼 데이터
export interface SaleLedgerFormData {
  saleOrderNumber: string;
  ledgerItems: SaleLedgerItem[];
  notes?: string;
}

// API 응답 타입
export interface SaleLedgerResponse<T = SaleLedger | SaleLedger[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class SaleLedgerServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SaleLedgerServiceError';
    this.code = code;
  }
}

// 타입 가드 함수
export const isValidSaleLedger = (data: unknown): data is SaleLedger => {
  const sl = data as SaleLedger;
  return (
    sl &&
    typeof sl.saleLedgerNumber === 'string' &&
    typeof sl.saleOrderNumber === 'string' &&
    typeof sl.customerId === 'string' &&
    Array.isArray(sl.ledgerItems) &&
    typeof sl.totalAmount === 'number'
  );
};
