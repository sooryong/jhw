/**
 * 파일 경로: /src/utils/companyValidation.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: 고객사/공급사 통합 검증 및 데이터 변환 유틸리티
 * 목적: 중복 코드 제거 및 일관된 검증/변환 로직 제공
 */

import {
  normalizeNumber,
  isValidBusinessNumber,
  isValidMobile,
  isValidPhone,
} from './numberUtils';
import type { CustomerFormData, SupplierFormData } from '../types/company';

/**
 * 검증 에러 타입
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * 기본 회사 정보 검증 (고객사/공급사 공통)
 */
export const validateBaseCompanyInfo = (
  formData: CustomerFormData | SupplierFormData
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // 사업자등록번호 검증
  if (!formData.businessNumber) {
    errors.businessNumber = '사업자등록번호는 필수입니다.';
  } else {
    const normalized = normalizeNumber(formData.businessNumber);
    if (!isValidBusinessNumber(normalized)) {
      errors.businessNumber = '올바른 사업자번호 형식이 아닙니다. (10자리 숫자)';
    }
  }

  // 상호명 검증
  if (!formData.businessName) {
    errors.businessName = '상호명은 필수입니다.';
  }

  // 대표자명 검증
  if (!formData.president) {
    errors.president = '대표자명은 필수입니다.';
  }

  // 사업장 주소 검증
  if (!formData.businessAddress) {
    errors.businessAddress = '사업장 주소는 필수입니다.';
  }

  // 이메일 형식 검증 (선택사항)
  if (formData.businessEmail) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.businessEmail)) {
      errors.businessEmail = '올바른 이메일 형식이 아닙니다.';
    }
  }

  // 회사 휴대폰 검증 (선택사항)
  if (formData.presidentMobile) {
    const normalized = normalizeNumber(formData.presidentMobile);
    if (!isValidMobile(normalized)) {
      errors.presidentMobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }
  }

  // 회사 전화번호 검증 (선택사항)
  if (formData.businessPhone) {
    const normalized = normalizeNumber(formData.businessPhone);
    if (!isValidPhone(normalized)) {
      errors.businessPhone = '올바른 전화번호 형식이 아닙니다.';
    }
  }

  return errors;
};

/**
 * 담당자 검증 (고객사/공급사 공통)
 *
 * @param primaryContact 주 담당자 정보
 * @param secondaryContact 부 담당자 정보 (선택)
 * @param requireUserId 고객사는 true (userId 필수), 공급사는 false (userId 불필요)
 */
export const validateContacts = (
  primaryContact: { userId?: string; name: string; mobile: string },
  secondaryContact?: { userId?: string; name: string; mobile: string },
  requireUserId: boolean = false
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // primaryContact 검증 (필수)
  if (requireUserId && !primaryContact.userId) {
    errors.primaryContact_mobile = '담당자1을 검색하여 선택해주세요.';
  }

  if (!primaryContact.name) {
    errors.primaryContact_name = '담당자1 이름은 필수입니다.';
  }
  if (!primaryContact.mobile) {
    errors.primaryContact_mobile = '담당자1 휴대폰은 필수입니다.';
  } else {
    const normalized = normalizeNumber(primaryContact.mobile);
    if (!isValidMobile(normalized)) {
      errors.primaryContact_mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }
  }

  // secondaryContact 검증 (선택이지만, 입력했다면 검증)
  if (secondaryContact?.name && !secondaryContact?.mobile) {
    errors.secondaryContact_mobile = '휴대폰 번호를 입력해주세요.';
  }
  if (secondaryContact?.mobile && !secondaryContact?.name) {
    errors.secondaryContact_name = '이름을 입력해주세요.';
  }
  if (secondaryContact?.mobile) {
    // 고객사인 경우 userId 필수
    if (requireUserId && !secondaryContact.userId) {
      errors.secondaryContact_mobile = '담당자2를 검색하여 선택해주세요.';
    }

    const normalized = normalizeNumber(secondaryContact.mobile);
    if (!isValidMobile(normalized)) {
      errors.secondaryContact_mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }

    // 주 담당자와 부 담당자가 같은지 검증
    const primaryNormalized = normalizeNumber(primaryContact.mobile);
    const secondaryNormalized = normalizeNumber(secondaryContact.mobile);
    if (primaryNormalized === secondaryNormalized) {
      errors.secondaryContact_mobile = '담당자1과 담당자2는 다른 사람이어야 합니다.';
    }
  }

  return errors;
};

/**
 * 고객사 전용 필드 검증
 */
export const validateCustomerSpecificFields = (formData: CustomerFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!formData.customerType) {
    errors.customerType = '고객사 유형을 선택해주세요.';
  }

  return errors;
};

/**
 * 고객사 폼 전체 검증
 */
export const validateCustomerForm = (formData: CustomerFormData): ValidationErrors => {
  return {
    ...validateBaseCompanyInfo(formData),
    ...validateContacts(formData.primaryContact, formData.secondaryContact, true), // userId 필수
    ...validateCustomerSpecificFields(formData),
  };
};

/**
 * 공급사 폼 전체 검증
 */
export const validateSupplierForm = (formData: SupplierFormData): ValidationErrors => {
  return {
    ...validateBaseCompanyInfo(formData),
    ...validateContacts(formData.primaryContact, formData.secondaryContact, false), // userId 불필요
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
 * 고객사 폼 검증 (결과 객체 반환)
 */
export const validateCustomerFormWithResult = (formData: CustomerFormData): ValidationResult => {
  const errors = validateCustomerForm(formData);
  return {
    isValid: !hasValidationErrors(errors),
    errors,
  };
};

/**
 * 공급사 폼 검증 (결과 객체 반환)
 */
export const validateSupplierFormWithResult = (formData: SupplierFormData): ValidationResult => {
  const errors = validateSupplierForm(formData);
  return {
    isValid: !hasValidationErrors(errors),
    errors,
  };
};
