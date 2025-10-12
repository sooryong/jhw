/**
 * 파일 경로: /src/types/product.ts
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 관리 TypeScript 타입 정의
 * 관련 데이터: Firebase products 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 상품 로트 정보
export interface ProductLot {
  lotDate: string;    // "20250127" (YYYYMMDD) - 유일한 식별자
  quantity: number;   // 입고수량
  stock: number;      // 잔여수량
  price: number;      // 매입가격
}

// 고객사 유형별 판매가격 구조
export interface CustomerTypePrices {
  [customerType: string]: number;
}

// 판매가격 구조체
export interface SalePrices {
  standard: number; // 표준 판매가격
  customerTypes: CustomerTypePrices; // 고객사 유형별 가격
}

// 상품 정보
export interface Product {
  // 문서 ID는 Firestore에서 자동 생성
  productId?: string; // 문서 ID (내부용)

  // 사용자 표시용 상품 코드
  productCode: string; // 상품 코드 (예: P12345678)

  // 기본 정보
  productName: string; // 상품명
  specification?: string; // 상품 사양/규격

  // 분류 (Settings 연동)
  mainCategory?: string; // 메인 카테고리
  subCategory?: string; // 서브 카테고리

  // 가격 정보
  purchasePrice?: number; // 매입가격 (선택)
  salePrices: SalePrices; // 판매가격 구조체

  // 재고 관리
  stockQuantity?: number; // 현재 재고수량 (선택)
  minimumStock?: number; // 최소 재고량 (선택)

  // 로트 관리
  lots: ProductLot[]; // 로트 정보 배열
  latestPurchasePrice?: number; // 최근 매입가격 (자동 계산)

  // 공급사 연동
  supplierId?: string; // 공급사 사업자번호

  // 미디어
  image?: string; // 상품 이미지 URL (메인 이미지 - 하위 호환성)
  images?: string[]; // 추가 이미지 URL 배열 (다중 이미지 지원, 최대 4개)
  primaryImageIndex?: number; // 대표 이미지 인덱스 (0-3, 기본값: 0)
  description?: string; // 상품 설명

  // 유통기한 정보
  expirationDate?: string; // 유통기한 (예: "2025-12-31")
  shelfLife?: string; // 보관기간 (예: "제조일로부터 6개월")

  // 상태 및 메타데이터
  isActive: boolean; // 활성 상태
  createdAt: Timestamp; // 생성일시
  updatedAt: Timestamp; // 수정일시
}

// 상품 등록/수정용 폼 데이터
export interface ProductFormData {
  // 사용자 표시용 상품 코드
  productCode?: string; // 상품 코드 (자동 생성)

  // 기본 정보
  productName: string;
  specification?: string;

  // 분류
  mainCategory?: string;
  subCategory?: string;

  // 가격 정보
  purchasePrice?: number; // 매입가격 (선택)
  salePrices: SalePrices;

  // 재고 관리
  stockQuantity?: number; // 현재 재고수량 (선택)
  minimumStock?: number; // 최소 재고량 (선택)

  // 공급사
  supplierId?: string;

  // 미디어
  image?: string;
  images?: string[];
  primaryImageIndex?: number;
  description?: string;

  // 유통기한 정보
  expirationDate?: string;
  shelfLife?: string;

  // 상태
  isActive: boolean;
}

// 검색/필터 조건
export interface ProductFilter {
  isActive?: boolean;
  searchText?: string;
  mainCategory?: string;
  subCategory?: string;
  supplierId?: string;
  lowStock?: boolean; // 재고 부족 상품 필터

  // 페이지네이션
  page?: number;      // 페이지 번호 (0부터 시작)
  limit?: number;     // 페이지당 항목 수 (기본 25)
}

// API 응답 타입
export interface ProductResponse<T = Product | Product[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 페이지네이션 응답 타입
export interface PaginatedProductResponse {
  success: boolean;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class ProductServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ProductServiceError';
    this.code = code;
  }
}

// 할인율 계산 유틸리티 함수
export interface PriceUtils {
  calculateDiscountRate: (standardPrice: number, customerPrice: number) => number;
  formatPrice: (price: number) => string;
  formatDiscountRate: (rate: number) => string;
}

// 할인율 계산 유틸리티 구현
export const priceUtils: PriceUtils = {
  // 할인율 계산 (표준가격 대비)
  calculateDiscountRate: (standardPrice: number, customerPrice: number): number => {
    if (standardPrice === 0) return 0;
    return ((standardPrice - customerPrice) / standardPrice) * 100;
  },

  // 가격 포맷팅
  formatPrice: (price: number): string => {
    return `₩${price.toLocaleString()}`;
  },

  // 할인율 포맷팅
  formatDiscountRate: (rate: number): string => {
    if (rate === 0) return '';
    return `${rate.toFixed(1)}%`;
  }
};

// 재고 상태 유틸리티
export interface StockUtils {
  getStockStatus: (current: number, minimum?: number) => 'safe' | 'warning' | 'critical';
  getStockStatusText: (status: string) => string;
  getStockStatusColor: (status: string) => 'success' | 'warning' | 'error';
}

// 재고 상태 유틸리티 구현
export const stockUtils: StockUtils = {
  // 재고 상태 계산
  getStockStatus: (current: number, minimum = 0): 'safe' | 'warning' | 'critical' => {
    if (current === 0) return 'critical';
    if (minimum > 0 && current <= minimum) return 'warning';
    return 'safe';
  },

  // 재고 상태 텍스트
  getStockStatusText: (status: string): string => {
    switch (status) {
      case 'safe': return '재고 충분';
      case 'warning': return '재고 부족';
      case 'critical': return '재고 없음';
      default: return '알 수 없음';
    }
  },

  // 재고 상태 색상
  getStockStatusColor: (status: string): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'safe': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'success';
    }
  }
};

// 타입 가드 함수
export const isValidProduct = (data: unknown): data is Product => {
  const d = data as Record<string, unknown>;
  return (
    !!data &&
    typeof d.productName === 'string' &&
    !!d.salePrices &&
    typeof (d.salePrices as SalePrices).standard === 'number' &&
    typeof d.isActive === 'boolean'
  );
};

// 기본 판매가격 구조 생성 헬퍼
export const createDefaultSalePrices = (standardPrice: number, customerTypes: string[]): SalePrices => {
  const customerTypePrices: CustomerTypePrices = {};

  // 모든 고객 유형에 대해 표준가격으로 초기화
  customerTypes.forEach(type => {
    customerTypePrices[type] = standardPrice;
  });

  return {
    standard: standardPrice,
    customerTypes: customerTypePrices
  };
};

// 폼 데이터를 Product로 변환
export const formDataToProduct = (formData: ProductFormData): Omit<Product, 'createdAt' | 'updatedAt'> => {
  return {
    productCode: formData.productCode || '', // 빈 문자열로 초기화 (서비스에서 자동 생성)
    productName: formData.productName,
    specification: formData.specification,
    mainCategory: formData.mainCategory,
    subCategory: formData.subCategory,
    purchasePrice: formData.purchasePrice,
    salePrices: formData.salePrices,
    stockQuantity: formData.stockQuantity,
    minimumStock: formData.minimumStock,
    supplierId: formData.supplierId,
    image: formData.image,
    description: formData.description,
    isActive: formData.isActive,
    lots: [] // 빈 배열로 초기화 (입고 시 추가됨)
  };
};

// Product를 폼 데이터로 변환
export const productToFormData = (product: Product): ProductFormData => {
  return {
    productCode: product.productCode,
    productName: product.productName,
    specification: product.specification,
    mainCategory: product.mainCategory,
    subCategory: product.subCategory,
    purchasePrice: product.purchasePrice,
    salePrices: product.salePrices,
    stockQuantity: product.stockQuantity,
    minimumStock: product.minimumStock,
    supplierId: product.supplierId,
    image: product.image,
    images: product.images,
    primaryImageIndex: product.primaryImageIndex,
    description: product.description,
    isActive: product.isActive
  };
};

// 기본 상품 카테고리 (나중에 Settings에서 관리)
export const DEFAULT_PRODUCT_CATEGORIES = {
  '전자제품': ['노트북', '데스크톱', '모니터', '키보드', '마우스'],
  '가전제품': ['냉장고', '세탁기', '에어컨', '전자레인지'],
  '사무용품': ['프린터', '복사기', '스캐너', '문구류']
} as const;