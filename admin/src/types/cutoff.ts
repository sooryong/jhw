/**
 * 파일 경로: /src/types/cutoff.ts
 * 작성 날짜: 2025-10-20
 * 주요 내용: 일일식품(Daily Food) 마감 관리 타입 정의
 *
 * 일일식품 상품은 유통기한이 짧아 매일 새벽 배송되는 신선식품입니다.
 * 배송 전날 14:00~14:30에 주문 접수를 마감하고 공급사에 발주합니다.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 마감 상태
 */
export const CUTOFF_STATUS = {
  OPEN: 'open',       // 주문 접수 중
  CLOSED: 'closed'    // 주문 접수 마감
} as const;

export type CutoffStatus = typeof CUTOFF_STATUS[keyof typeof CUTOFF_STATUS];

/**
 * 주문의 마감 기준 상태
 */
export const ORDER_CUTOFF_STATUS = {
  WITHIN_CUTOFF: 'within-cutoff',    // 마감 시간 내 주문 (정규 집계, 전량 공급 보장)
  AFTER_CUTOFF: 'after-cutoff'       // 마감 시간 후 주문 (여유분 재고로 처리)
} as const;

export type OrderCutoffStatus = typeof ORDER_CUTOFF_STATUS[keyof typeof ORDER_CUTOFF_STATUS];

/**
 * 상품 카테고리
 */
export const PRODUCT_CATEGORY = {
  DAILY_FOOD: '신선식품',    // 일일식품 (dailyFood)
  FROZEN: '냉동식품',
  PROCESSED: '공산품'
} as const;

export type ProductCategory = typeof PRODUCT_CATEGORY[keyof typeof PRODUCT_CATEGORY];

/**
 * 마감 정보 (Firestore 문서)
 * 컬렉션: cutoff
 * 문서 ID: current (고정)
 */
export interface Cutoff {
  status: 'open' | 'closed';           // 마감 상태 (open: 접수 중, closed: 마감됨)
  openedAt: Timestamp;                 // 접수 시작 시간
  closedAt?: Timestamp;                // 접수 마감 시간 (마감 전엔 null)
  closedByUserId?: string;             // 마감 처리자 ID
  closedByUserName?: string;           // 마감 처리자 이름
}

/**
 * 마감 정보 (애플리케이션 타입 - Date 변환)
 */
export interface CutoffInfo {
  status: 'open' | 'closed';
  openedAt: Date | null;
  closedAt: Date | null;
  closedByUserId?: string;
  closedByUserName?: string;
}

// 하위 호환성을 위한 별칭 (추후 제거 예정)
/** @deprecated Use Cutoff instead */
export type DailyFoodCutoff = Cutoff;
/** @deprecated Use CutoffInfo instead */
export type DailyFoodCutoffResult = CutoffInfo;

/**
 * 마감 처리 결과
 */
export interface CutoffCloseResult {
  aggregatedOrderCount: number;        // 집계된 주문 수
  purchaseOrderNumbers: string[];      // 생성된 매입주문 번호 목록
  smsResults: SMSResult[];             // SMS 발송 결과
}

/**
 * SMS 발송 결과
 */
export interface SMSResult {
  supplierId: string;
  supplierName: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 일일식품 집계 결과
 */
export interface DailyFoodAggregation {
  suppliers: SupplierAggregation[];
  totalQuantity: number;
  totalAmount: number;
  aggregatedAt: Date;
}

/**
 * 공급사별 집계
 */
export interface SupplierAggregation {
  supplierId: string;
  supplierName: string;
  smsRecipients: SMSRecipient[];
  products: ProductAggregation[];
  totalQuantity: number;
  totalAmount: number;
}

/**
 * 상품별 집계
 */
export interface ProductAggregation {
  productId: string;
  productName: string;
  specification?: string;
  quantity: number;
  amount: number;
  unitPrice: number;
  stockQuantity?: number;
}

/**
 * SMS 수신자
 */
export interface SMSRecipient {
  name: string;
  mobile: string;
}
