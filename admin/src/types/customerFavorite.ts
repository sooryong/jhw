/**
 * 파일 경로: /src/types/customerFavorite.ts
 * 작성 날짜: 2025-10-22
 * 주요 내용: 고객사 즐겨찾기 상품 타입 정의
 * 관련 데이터: customers/{customerId}/favoriteProducts 서브컬렉션
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 고객사 즐겨찾기 상품
 * - customers/{customerId}/favoriteProducts/{productId} 서브컬렉션에 저장
 * - productId를 문서 ID로 사용
 */
export interface CustomerFavoriteProduct {
  productId: string;             // 상품 ID (문서 ID와 동일)
  productName: string;           // 상품명 (캐시)
  productImage?: string;         // 상품 이미지 URL
  specification?: string;        // 상품 규격 (캐시)
  displayOrder: number;          // 표시 순서 (1부터 시작)
  isActive: boolean;             // 활성화 여부

  // 메타데이터
  addedAt: Timestamp;            // 즐겨찾기 추가일시
  updatedAt: Timestamp;          // 마지막 수정일시
  addedBy?: string;              // 추가한 사용자 UID
}

/**
 * 즐겨찾기 상품 생성용 폼 데이터
 */
export interface CustomerFavoriteProductFormData {
  productId: string;
  productName: string;
  productImage?: string;
  specification?: string;
  displayOrder?: number;         // 미지정 시 자동 계산
  isActive?: boolean;            // 기본값: true
}

/**
 * 즐겨찾기 상품 정렬 순서 변경용
 */
export interface CustomerFavoriteReorderData {
  productId: string;
  newDisplayOrder: number;
}

/**
 * 즐겨찾기 상품 목록 조회 옵션
 */
export interface CustomerFavoriteListOptions {
  activeOnly?: boolean;          // true: 활성화된 것만 조회
  orderBy?: 'displayOrder' | 'addedAt' | 'productName';
  limit?: number;                // 조회 개수 제한
}

/**
 * 즐겨찾기 상품 서비스 에러
 */
export class CustomerFavoriteServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CustomerFavoriteServiceError';
    this.code = code;
  }
}

/**
 * 에러 코드
 */
export const CUSTOMER_FAVORITE_ERROR_CODES = {
  ALREADY_EXISTS: 'ALREADY_EXISTS',           // 이미 즐겨찾기에 존재
  NOT_FOUND: 'NOT_FOUND',                     // 즐겨찾기 없음
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',     // 상품 없음
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',   // 고객사 없음
  INVALID_ORDER: 'INVALID_ORDER',             // 잘못된 순서
  PERMISSION_DENIED: 'PERMISSION_DENIED'      // 권한 없음
} as const;
