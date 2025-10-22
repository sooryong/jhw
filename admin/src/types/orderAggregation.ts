/**
 * 파일 경로: /src/types/orderAggregation.ts
 * 작성 날짜: 2025-10-04
 * 주요 내용: 주문 집계 데이터 TypeScript 타입 정의
 */

// SMS 수신자 정보
export interface SMSRecipient {
  name: string;
  mobile: string;
}

// 집계 카드 데이터
export interface AggregationCardData {
  count: number;
  amount: number;
  quantity?: number;  // 상품 수량 (optional, 일부 집계에만 사용)
}

// 확정 기준별 집계
export interface StatusAggregation {
  regular: AggregationCardData;      // 확정 전 주문 (confirmationStatus: 'regular')
  additional: AggregationCardData;   // 확정 후 주문 (confirmationStatus: 'additional')
  pended: AggregationCardData;       // 보류 주문 (status: 'pended')
  rejected: AggregationCardData;     // 거절 주문 (status: 'rejected')
}

// 상품별 집계
export interface ProductAggregation {
  productId: string;
  productName: string;
  specification?: string;
  mainCategory?: string;          // 상품 카테고리

  // 수량 (confirmationStatus별 분리)
  placedQuantity: number;          // regular (confirmationStatus='regular') 수량
  confirmedQuantity: number;       // additional (confirmationStatus='additional') 수량
  totalQuantity: number;           // 전체 수량

  // 금액 (confirmationStatus별 분리)
  placedAmount: number;            // regular (confirmationStatus='regular') 금액
  confirmedAmount: number;         // additional (confirmationStatus='additional') 금액
  totalAmount: number;             // 전체 금액
  unitPrice: number;               // 매입가격 (purchasePrice)

  // 재고
  stockQuantity?: number;          // 현재고

  // 통계
  orderCount: number;              // 주문 건수
}

// 공급사별 집계
export interface SupplierAggregation {
  supplierId: string;
  supplierName: string;
  smsRecipients: SMSRecipient[];   // SMS 수신자

  // 상품 목록
  products: ProductAggregation[];

  // 공급사 합계
  totalQuantity: number;           // 전체 수량
  totalPlacedQuantity: number;     // placed 수량
  totalConfirmedQuantity: number;  // confirmed 수량
  totalAmount: number;             // 총 금액

  // 매입주문 생성 상태 (2025-10-20 추가)
  hasPurchaseOrder?: boolean;           // 매입주문 생성 여부
  purchaseOrderNumber?: string | null;  // 생성된 매입주문 번호
  purchaseOrderCreatedAt?: Date | null; // 매입주문 생성 시간
}

// 카테고리별 집계
export interface CategoryAggregation {
  category: string;                // "일일식품", "냉동식품", "공산품"

  // 주문 통계
  totalOrders: number;             // 전체 주문 수
  confirmedOrders: number;         // confirmed 주문 수
  placedOrders: number;            // pending 주문 수 (호환성 유지)

  // 금액 통계
  totalAmount: number;
  confirmedAmount: number;
  placedAmount: number;            // pending 금액 (호환성 유지)

  // 공급사별 집계
  suppliers: SupplierAggregation[];
}

// 전체 집계 데이터
export interface OrderAggregationData {
  // 전체 통계
  total: StatusAggregation;

  // 카테고리별 집계
  categories: {
    [category: string]: CategoryAggregation;
  };

  // 원본 주문 데이터 (optional)
  orders?: unknown[];  // SaleOrder[] 타입이지만 순환 참조 방지를 위해 any 사용

  // 날짜 정보
  date: Date;
}

// 일일식품 확정용 집계
export interface DailyFoodAggregation {
  // placed 주문 수
  placedCount: number;
  placedAmount: number;

  // 공급사별 집계
  suppliers: SupplierAggregation[];

  // 확정 여부
  isConfirmed: boolean;
  confirmedAt?: Date;

  // 매입주문 정보
  purchaseOrderNumbers?: string[];

  // SMS 발송 정보
  smsSentAt?: Date;
  smsSentCount?: number;
  smsSuccessCount?: number;
}

// 집계 필터 옵션
export interface AggregationFilter {
  date: Date;                      // 집계 날짜
  status?: 'all' | 'confirmed' | 'pended' | 'rejected' | 'completed';  // 상태 필터
  category?: string;               // 카테고리 필터
}
