/**
 * 파일 경로: /src/types/purchaseOrder.ts
 * 작성 날짜: 2025-10-04
 * 주요 내용: 매입주문 TypeScript 타입 정의
 * 관련 데이터: Firebase purchaseOrders 컬렉션
 */

import { Timestamp } from 'firebase/firestore';
import type { SMSRecipient } from './orderAggregation';

// 매입주문 상품 정보
export interface PurchaseOrderItem {
  productId: string;          // 상품 ID
  productName: string;         // 상품명
  mainCategory?: string;       // 대분류 카테고리
  specification?: string;      // 상품 규격
  quantity: number;            // 주문 수량
}

// 매입주문
export interface PurchaseOrder {
  // 기본 식별
  purchaseOrderNumber: string;     // 매입주문번호 (PO-YYMMDD-001)
  supplierId: string;          // 공급사 사업자번호 (하이픈 제거)

  // 공급사 정보 (스냅샷)
  supplierInfo: {
    businessName: string;      // 상호명
    smsRecipients: SMSRecipient[];  // SMS 수신자 배열
  };

  // 주문 상품
  orderItems: PurchaseOrderItem[];
  itemCount: number;           // 총 품목 수

  // 카테고리
  category: string;            // "일일식품", "냉동식품", "공산품"

  // 상태 관리 (생명주기)
  status: 'placed' | 'confirmed' | 'pended' | 'cancelled' | 'completed';
  placedAt: Timestamp;         // 발주일시
  confirmedAt?: Timestamp;     // 공급사 확인일시
  pendedAt?: Timestamp;        // 보류일시
  pendedReason?: string;       // 보류 사유
  cancelledAt?: Timestamp;     // 취소일시
  completedAt?: Timestamp;     // 입고완료일시

  // 원장 연동
  purchaseLedgerId?: string;   // 매입원장 ID (completed 후 생성)

  // SMS 발송 정보
  lastSmsSentAt?: Timestamp;   // 마지막 SMS 발송일시
  smsSuccess?: boolean;         // SMS 발송 성공 여부

  // 메타데이터
  createdAt: Timestamp;        // 생성일시
  updatedAt: Timestamp;        // 수정일시
  createdBy: string;           // 생성자 UID (admin/staff)
}

// 매입주문 등록용 폼 데이터
export interface PurchaseOrderFormData {
  supplierId: string;
  orderItems: PurchaseOrderItem[];
  category: string;
}

// API 응답 타입
export interface PurchaseOrderResponse<T = PurchaseOrder | PurchaseOrder[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class PurchaseOrderServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PurchaseOrderServiceError';
    this.code = code;
  }
}

// 상태 라벨 헬퍼
export const getPurchaseOrderStatusLabel = (status: PurchaseOrder['status']): string => {
  switch (status) {
    case 'placed': return '발주';
    case 'confirmed': return '확정';
    case 'pended': return '보류';
    case 'cancelled': return '취소';
    case 'completed': return '입고완료';
    default: return '알 수 없음';
  }
};

// 상태 색상 헬퍼
export const getPurchaseOrderStatusColor = (
  status: PurchaseOrder['status']
): 'default' | 'warning' | 'success' | 'info' | 'error' => {
  switch (status) {
    case 'placed': return 'warning';      // 발주: 주황색
    case 'confirmed': return 'info';      // 확정: 파란색
    case 'pended': return 'warning';      // 보류: 주황색
    case 'cancelled': return 'default';   // 취소: 회색
    case 'completed': return 'success';   // 입고완료: 녹색
    default: return 'default';
  }
};

// 타입 가드 함수
export const isValidPurchaseOrder = (data: unknown): data is PurchaseOrder => {
  const po = data as PurchaseOrder;
  return (
    po &&
    typeof po.purchaseOrderNumber === 'string' &&
    typeof po.supplierId === 'string' &&
    Array.isArray(po.orderItems) &&
    typeof po.status === 'string'
  );
};
