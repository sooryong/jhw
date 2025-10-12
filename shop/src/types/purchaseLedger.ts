/**
 * 파일 경로: /src/types/purchaseLedger.ts
 * 작성 날짜: 2025-10-06
 * 주요 내용: 매입 원장 TypeScript 타입 정의
 * 관련 데이터: Firebase purchaseLedgers 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 매입 원장 상품 정보
export interface PurchaseLedgerItem {
  productId: string;          // 상품 ID
  productCode: string;        // 상품 코드 (예: P12345678)
  productName: string;         // 상품명
  specification?: string;      // 상품 규격
  category: string;           // 상품 카테고리 (일일식품, 냉동식품, 공산품 등)

  // 실제 매입 정보
  quantity: number;           // 실제 입고 수량
  unitPrice: number;          // 실제 매입단가
  lineTotal: number;          // 라인 소계 (quantity × unitPrice)
}

// 매입 원장
export interface PurchaseLedger {
  // 기본 식별
  purchaseLedgerId: string;    // 매입원장번호 (PL-YYYYMMDD-00001)
  purchaseOrderNumber: string;     // 원본 매입주문번호 (참조용)
  supplierId: string;          // 공급사 사업자번호 (하이픈 제거)

  // 공급사 정보 (스냅샷)
  supplierInfo: {
    businessName: string;      // 상호명
    ownerName?: string;        // 대표자명
  };

  // 실제 매입 품목 (입고된 품목만, 신규 상품 포함 가능)
  ledgerItems: PurchaseLedgerItem[];

  // 금액 정보
  totalAmount: number;         // 총 매입금액

  // 품목 수
  itemCount: number;           // 총 품목 수

  // 입고 정보
  receivedAt: Timestamp;       // 입고 완료일시
  receivedBy: string;          // 입고 처리자 UID (admin/staff)

  // 메타데이터
  createdAt: Timestamp;        // 생성일시
  updatedAt: Timestamp;        // 수정일시

  // 비고
  notes?: string;              // 입고 시 특이사항
}

// 매입 원장 등록용 폼 데이터
export interface PurchaseLedgerFormData {
  purchaseOrderNumber: string;
  ledgerItems: PurchaseLedgerItem[];
  notes?: string;
}

// API 응답 타입
export interface PurchaseLedgerResponse<T = PurchaseLedger | PurchaseLedger[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class PurchaseLedgerServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PurchaseLedgerServiceError';
    this.code = code;
  }
}

// 타입 가드 함수
export const isValidPurchaseLedger = (data: unknown): data is PurchaseLedger => {
  const pl = data as PurchaseLedger;
  return (
    pl &&
    typeof pl.purchaseLedgerId === 'string' &&
    typeof pl.purchaseOrderNumber === 'string' &&
    typeof pl.supplierId === 'string' &&
    Array.isArray(pl.ledgerItems) &&
    typeof pl.totalAmount === 'number'
  );
};
