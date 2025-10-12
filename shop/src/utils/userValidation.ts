/**
 * 파일 경로: /src/utils/userValidation.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: 사용자 통합 검증 유틸리티
 * 목적: 중복 코드 제거 및 일관된 검증 로직 제공
 */

import { normalizeNumber, isValidMobile } from './numberUtils';

/**
 * 검증 에러 타입
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * 사용자 기본 정보 검증
 */
export const validateUserBasicInfo = (
  name: string,
  mobile: string,
  role: string
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // 필수 필드 검증
  if (!name.trim()) {
    errors.name = '이름은 필수입니다.';
  }

  if (!mobile.trim()) {
    errors.mobile = '휴대폰번호는 필수입니다.';
  } else {
    const normalized = normalizeNumber(mobile);
    if (!isValidMobile(normalized)) {
      errors.mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }
  }

  if (!role) {
    errors.role = '역할을 선택해주세요.';
  }

  return errors;
};

/**
 * 사용자 폼 검증
 */
export const validateUserForm = (name: string, mobile: string, role: string): ValidationErrors => {
  return validateUserBasicInfo(name, mobile, role);
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
 * 사용자 폼 검증 (결과 객체 반환)
 */
export const validateUserFormWithResult = (
  name: string,
  mobile: string,
  role: string
): ValidationResult => {
  const errors = validateUserForm(name, mobile, role);
  return {
    isValid: !hasValidationErrors(errors),
    errors,
  };
};
