/**
 * 파일 경로: /src/types/saleOrder.ts
 * 작성 날짜: 2025-09-28
 * 최종 수정: 2025-10-18
 * 주요 내용: 매출주문 타입 정의
 * 관련 데이터: saleOrders 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 매출주문 상태
export type SaleOrderStatus = 'placed' | 'confirmed' | 'pended' | 'rejected' | 'completed' | 'cancelled';

// 일일식품 주문 타입 (주문 생성 시점에 확정, 이후 불변)
export type DailyFoodOrderType = 'regular' | 'additional' | 'none';

// 주문 상품 아이템
export interface OrderItem {
  productId: string;          // 상품 ID
  productName: string;        // 상품명
  specification: string;      // 상품 규격/사양
  quantity: number;           // 주문 수량
  unitPrice: number;          // 적용된 단가
  lineTotal: number;          // 라인별 소계 (unitPrice × quantity)
}

// 고객사 정보 (주문 시점 스냅샷)
export interface CustomerInfo {
  businessName: string;       // 상호명
  businessNumber?: string;    // 사업자번호
  customerType: string;       // 고객사 유형 (VIP고객, 일반고객 등)
}

// 주문 검증 오류
export interface ValidationError {
  field: string;              // 오류 발생 필드
  code: string;               // 오류 코드 (STOCK_SHORTAGE, UNUSUAL_QUANTITY, PRICE_MISMATCH 등)
  message: string;            // 오류 메시지
  severity: 'warning' | 'error';  // 심각도
}

// 매출주문 인터페이스
export interface SaleOrder {
  // 기본 식별 정보
  saleOrderNumber: string;    // 매출주문번호 (SO-YYMMDD-001)
  customerId: string;         // 고객사 ID (customers 컬렉션 참조)

  // 고객사 정보 (간소화)
  customerInfo: CustomerInfo;

  // 주문 상품 (간소화)
  orderItems: OrderItem[];

  // 주문 금액 (메인 필드로 이동)
  finalAmount: number;        // 최종 주문금액
  itemCount: number;          // 총 품목 수

  // 상태 관리
  status: SaleOrderStatus;
  placedAt: Timestamp;        // 주문접수일시
  confirmedAt?: Timestamp;    // 주문확정일시 (자동 또는 강제 확정)
  completedAt?: Timestamp;    // 출하완료일시 (선택)
  cancelledAt?: Timestamp;    // 주문취소일시 (선택)
  rejectedAt?: Timestamp;     // 주문거부일시 (선택)

  // 일일식품 주문 타입 (주문 생성 시점에 확정, 이후 불변)
  dailyFoodOrderType?: DailyFoodOrderType;
  // regular: 마감 시간 내 주문 (정규 집계, 전량 공급 보장)
  // additional: 마감 시간 후 주문 (여유분 재고로 처리)
  // none: 일일식품 미포함 주문

  // pended 상태 관리
  pendedReason?: string;      // pended 사유
  validationErrors?: ValidationError[];  // 검증 오류 목록
  processedBy?: string;       // 처리자 (admin ID)
  pendedAt?: Timestamp;       // 보류 처리 시간

  // 연동 정보
  purchaseOrderNumber?: string;   // 매입주문번호 (regular 타입만 연결됨)
  saleLedgerId?: string;      // 매출전표 ID (completed 상태에서만 존재)

  // 메타데이터
  createdAt: Timestamp;       // 생성일시
  updatedAt: Timestamp;       // 수정일시
  createdBy: string;          // 주문자 (고객사 사용자 ID)
}

// 매출주문 생성용 인터페이스 (ID 및 타임스탬프 제외)
export interface CreateSaleOrderData {
  customerId: string;
  customerInfo: CustomerInfo;
  orderItems: OrderItem[];
  finalAmount: number;
  itemCount: number;
  createdBy: string;          // 주문자 ID (고객 또는 직원)
}

// 장바구니 아이템
export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: Timestamp;
}

// 장바구니 인터페이스
export interface Cart {
  customerId: string;
  items: CartItem[];
  lastUpdated: Timestamp;
  expiresAt: Timestamp;       // 24시간 후 자동 삭제
}

// 주문 이력 조회용 필터
export interface OrderHistoryFilter {
  startDate?: string;         // YYYY-MM-DD 형식
  endDate?: string;           // YYYY-MM-DD 형식
  status?: SaleOrderStatus | 'all';
  page?: number;
  limit?: number;
}

// 주문 이력 조회 결과
export interface OrderHistoryResult {
  orders: SaleOrder[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}