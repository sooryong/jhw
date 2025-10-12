/**
 * 파일 경로: /src/utils/productValidation.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: 상품 통합 검증 유틸리티
 * 목적: 중복 코드 제거 및 일관된 검증 로직 제공
 */

import type { ProductFormData } from '../types/product';

/**
 * 검증 에러 타입
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * 상품 기본 정보 검증
 */
export const validateProductBasicInfo = (formData: ProductFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // 필수 필드 검증
  if (!formData.productName.trim()) {
    errors.productName = '상품명은 필수입니다.';
  }

  if (!formData.specification?.trim()) {
    errors.specification = '상품 사양은 필수입니다.';
  }

  if (!formData.supplierId) {
    errors.supplierId = '공급사를 선택해주세요.';
  }

  if (!formData.mainCategory) {
    errors.mainCategory = '대분류를 선택해주세요.';
  }

  return errors;
};

/**
 * 상품 가격 검증
 */
export const validateProductPrices = (
  formData: ProductFormData,
  customerTypes: string[]
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // 표준 판매가격 검증
  if (formData.salePrices.standard <= 0) {
    errors.standardPrice = '표준 판매가격을 입력해주세요.';
  }

  // 고객사 유형별 가격 필수 검증
  customerTypes.forEach((customerType) => {
    const price = formData.salePrices.customerTypes[customerType];
    if (!price || price <= 0) {
      errors[`customerPrice_${customerType}`] = `${customerType} 가격은 필수입니다.`;
    }
  });

  // 가격 검증 (매입가 > 판매가 경고) - 매입가가 입력된 경우만
  if (
    formData.purchasePrice !== undefined &&
    formData.purchasePrice > 0 &&
    formData.purchasePrice > formData.salePrices.standard
  ) {
    errors.standardPrice = '매입가격보다 낮은 판매가격입니다. 확인해주세요.';
  }

  return errors;
};

/**
 * 상품 재고 검증
 */
export const validateProductStock = (formData: ProductFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // 선택 필드 검증 (입력된 경우만)
  if (formData.minimumStock !== undefined && formData.minimumStock < 0) {
    errors.minimumStock = '최소 재고는 0 이상이어야 합니다.';
  }

  if (formData.stockQuantity !== undefined && formData.stockQuantity < 0) {
    errors.stockQuantity = '현재 재고는 0 이상이어야 합니다.';
  }

  if (formData.purchasePrice !== undefined && formData.purchasePrice < 0) {
    errors.purchasePrice = '매입가격은 0 이상이어야 합니다.';
  }

  return errors;
};

/**
 * 상품 폼 전체 검증
 */
export const validateProductForm = (
  formData: ProductFormData,
  customerTypes: string[]
): ValidationErrors => {
  return {
    ...validateProductBasicInfo(formData),
    ...validateProductPrices(formData, customerTypes),
    ...validateProductStock(formData),
  };
};

/**
 * 검증 에러가 있는지 확인
 */
export const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

/**
 * 검증 결과 반환 타입
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

/**
 * 상품 기본 폼 검증 (고객사 타입 검증 제외 - 수정 페이지용)
 */
export const validateProductBasicForm = (formData: ProductFormData): ValidationErrors => {
  return {
    ...validateProductBasicInfo(formData),
    ...validateProductStock(formData),
  };
};

/**
 * 상품 폼 검증 (결과 객체 반환)
 */
export const validateProductFormWithResult = (
  formData: ProductFormData,
  customerTypes: string[]
): ValidationResult => {
  const errors = validateProductForm(formData, customerTypes);
  return {
    isValid: !hasValidationErrors(errors),
    errors,
  };
};
