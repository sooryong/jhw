/**
 * 파일 경로: /src/utils/companyValidation.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: 고객사/공급사 통합 검증 및 데이터 변환 유틸리티
 * 목적: 중복 코드 제거 및 일관된 검증/변환 로직 제공
 */

import {
  normalizeNumber,
  normalizeBusinessNumber,
  isValidBusinessNumber,
  isValidMobile,
  isValidPhone,
} from './numberUtils';
import type { CustomerFormData, SupplierFormData, CustomerSMSRecipients } from '../types/company';
import type { NormalizedMobile } from '../types/phoneNumber';

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
 * SMS 수신자 검증 (고객사/공급사 공통)
 */
export const validateSMSRecipients = (
  smsRecipient: {
    person1: { name: string; mobile: string };
    person2?: { name: string; mobile: string };
  }
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // person1 검증 (필수)
  if (!smsRecipient.person1.name) {
    errors.smsRecipient_person1_name = '수신자1 이름은 필수입니다.';
  }
  if (!smsRecipient.person1.mobile) {
    errors.smsRecipient_person1_mobile = '수신자1 휴대폰은 필수입니다.';
  } else {
    const normalized = normalizeNumber(smsRecipient.person1.mobile);
    if (!isValidMobile(normalized)) {
      errors.smsRecipient_person1_mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }
  }

  // person2 검증 (선택이지만, 입력했다면 검증)
  if (smsRecipient.person2?.name && !smsRecipient.person2?.mobile) {
    errors.smsRecipient_person2_mobile = '휴대폰 번호를 입력해주세요.';
  }
  if (smsRecipient.person2?.mobile && !smsRecipient.person2?.name) {
    errors.smsRecipient_person2_name = '이름을 입력해주세요.';
  }
  if (smsRecipient.person2?.mobile) {
    const normalized = normalizeNumber(smsRecipient.person2.mobile);
    if (!isValidMobile(normalized)) {
      errors.smsRecipient_person2_mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
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
    ...validateSMSRecipients(formData.smsRecipient),
    ...validateCustomerSpecificFields(formData),
  };
};

/**
 * 공급사 폼 전체 검증
 */
export const validateSupplierForm = (formData: SupplierFormData): ValidationErrors => {
  return {
    ...validateBaseCompanyInfo(formData),
    ...validateSMSRecipients(formData.smsRecipient),
  };
};

/**
 * SMS 수신자 데이터 정규화 및 변환
 */
export const normalizeSMSRecipients = (
  smsRecipient: {
    person1: { name: string; mobile: string };
    person2?: { name: string; mobile: string };
  }
): CustomerSMSRecipients => {
  const normalized: CustomerSMSRecipients = {
    person1: {
      name: smsRecipient.person1.name,
      mobile: normalizeNumber(smsRecipient.person1.mobile) as NormalizedMobile,
    },
  };

  if (smsRecipient.person2?.name?.trim() && smsRecipient.person2?.mobile?.trim()) {
    normalized.person2 = {
      name: smsRecipient.person2.name,
      mobile: normalizeNumber(smsRecipient.person2.mobile) as NormalizedMobile,
    };
  }

  return normalized;
};

/**
 * 고객사 폼 데이터를 저장용 데이터로 변환 (정규화)
 */
export const normalizeCustomerFormData = (
  formData: CustomerFormData
): Omit<CustomerFormData, 'smsRecipient'> & { smsRecipient: CustomerSMSRecipients } => {
  return {
    ...formData,
    businessNumber: normalizeBusinessNumber(formData.businessNumber), // 하이픈 포함 형식
    presidentMobile: normalizeNumber(formData.presidentMobile || ''),
    businessPhone: normalizeNumber(formData.businessPhone || ''),
    smsRecipient: normalizeSMSRecipients(formData.smsRecipient),
    discountRate: Number(formData.discountRate) || 0,
    isActive: true,
    currentBalance: formData.currentBalance || 0,
  };
};

/**
 * 공급사 폼 데이터를 저장용 데이터로 변환 (정규화)
 */
export const normalizeSupplierFormData = (
  formData: SupplierFormData
): Omit<SupplierFormData, 'smsRecipient'> & { smsRecipient: CustomerSMSRecipients } => {
  return {
    ...formData,
    businessNumber: normalizeBusinessNumber(formData.businessNumber), // 하이픈 포함 형식
    presidentMobile: normalizeNumber(formData.presidentMobile || ''),
    businessPhone: normalizeNumber(formData.businessPhone || ''),
    smsRecipient: normalizeSMSRecipients(formData.smsRecipient),
    isActive: true,
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
