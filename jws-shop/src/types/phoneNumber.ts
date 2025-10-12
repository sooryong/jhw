/**
 * 파일 경로: /src/types/phoneNumber.ts
 * 작성 날짜: 2025-09-29
 * 주요 내용: 전화번호 관련 TypeScript 타입 정의
 * 원칙: 저장은 숫자만, 표시는 포맷팅
 */

// 브랜드 타입을 사용하여 숫자 전용 필드와 포맷된 필드 구분
declare const __normalizedNumber: unique symbol;
declare const __formattedNumber: unique symbol;

/**
 * 정규화된 번호 타입 (저장용)
 * 데이터베이스에 저장될 때 사용하는 표준화된 형태의 문자열
 * - 휴대폰번호: 숫자만 (01012345678)
 * - 사업자번호: 하이픈 포함 (123-45-67890)
 */
export type NormalizedNumber = string & { readonly [__normalizedNumber]: true };

/**
 * 포맷된 번호 타입 (표시용 - 하이픈 포함)
 * UI에서 사용자에게 표시될 때 사용하는 포맷팅된 문자열
 */
export type FormattedNumber = string & { readonly [__formattedNumber]: true };

/**
 * 휴대폰번호 타입 (정규화 - 11자리 숫자)
 */
export type NormalizedMobile = NormalizedNumber;

/**
 * 사업자등록번호 타입 (정규화 - 하이픈 포함 형태: 123-45-67890)
 * customers 컬렉션 문서 ID와 동일한 형태로 저장
 */
export type NormalizedBusinessNumber = NormalizedNumber;

/**
 * 일반 전화번호 타입 (정규화)
 */
export type NormalizedPhone = NormalizedNumber;

/**
 * 포맷된 휴대폰번호 타입 (010-1234-5678)
 */
export type FormattedMobile = FormattedNumber;

/**
 * 포맷된 사업자등록번호 타입 (123-45-67890)
 */
export type FormattedBusinessNumber = FormattedNumber;

/**
 * 포맷된 일반 전화번호 타입 (02-1234-5678)
 */
export type FormattedPhone = FormattedNumber;

/**
 * 번호 타입 구분
 */
export type NumberType = 'mobile' | 'phone' | 'business' | 'unknown';

/**
 * 번호 입력 컨텍스트
 */
export interface NumberInputContext {
  type: NumberType;
  allowFormatting: boolean;
  maxLength?: number;
  placeholder?: string;
}

/**
 * 번호 검증 결과
 */
export interface NumberValidationResult {
  isValid: boolean;
  type: NumberType;
  normalized: string;
  formatted: string;
  errors: string[];
}

/**
 * 마스킹 옵션
 */
export interface MaskingOptions {
  type?: NumberType;
  style?: 'partial' | 'full' | 'last4';
  maskChar?: string;
}

/**
 * 번호 저장 인터페이스 (데이터베이스 저장용)
 */
export interface StoredNumberFields {
  mobile?: NormalizedMobile;
  businessNumber?: NormalizedBusinessNumber;
  businessPhone?: NormalizedPhone;
  presidentMobile?: NormalizedMobile;
}

/**
 * 번호 표시 인터페이스 (UI 표시용)
 */
export interface DisplayNumberFields {
  mobile?: FormattedMobile;
  businessNumber?: FormattedBusinessNumber;
  businessPhone?: FormattedPhone;
  presidentMobile?: FormattedMobile;
}

/**
 * 번호 변환 유틸리티 타입
 */
export interface NumberTransforms {
  normalize<T extends string>(input: T): NormalizedNumber;
  format(input: NormalizedNumber, type: NumberType): FormattedNumber;
  mask(input: NormalizedNumber | FormattedNumber, options?: MaskingOptions): FormattedNumber;
  validate(input: string, type?: NumberType): NumberValidationResult;
  detectType(input: string): NumberType;
}

/**
 * 타입 가드 함수들
 */
export const isNormalizedNumber = (input: string): input is NormalizedNumber => {
  return /^\d+$/.test(input);
};

export const isFormattedNumber = (input: string): input is FormattedNumber => {
  return /^[\d-]+$/.test(input) && input.includes('-');
};

export const isNormalizedMobile = (input: string): input is NormalizedMobile => {
  return /^010\d{8}$/.test(input);
};

export const isNormalizedBusinessNumber = (input: string): input is NormalizedBusinessNumber => {
  return /^\d{3}-\d{2}-\d{5}$/.test(input);
};

/**
 * 번호 생성 헬퍼 함수들
 */
export const createNormalizedNumber = (input: string): NormalizedNumber => {
  const normalized = input.replace(/[^0-9]/g, '');
  return normalized as NormalizedNumber;
};

export const createFormattedNumber = (input: string): FormattedNumber => {
  return input as FormattedNumber;
};

export const createNormalizedMobile = (input: string): NormalizedMobile => {
  const normalized = createNormalizedNumber(input);
  if (isNormalizedMobile(normalized)) {
    return normalized as NormalizedMobile;
  }
  throw new Error('Invalid mobile number format');
};

export const createNormalizedBusinessNumber = (input: string): NormalizedBusinessNumber => {
  // 숫자만 추출
  const digitsOnly = input.replace(/[^0-9]/g, '');

  // 10자리가 아니면 에러
  if (digitsOnly.length !== 10) {
    throw new Error('Invalid business number format: must be 10 digits');
  }

  // 하이픈 포함 형태로 포맷 (123-45-67890)
  const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5, 10)}`;

  if (isNormalizedBusinessNumber(formatted)) {
    return formatted as NormalizedBusinessNumber;
  }

  throw new Error('Invalid business number format');
};

/**
 * 번호 필드가 포함된 엔티티의 기본 인터페이스
 */
export interface NumberEntity {
  id: string;
  [key: string]: unknown;
}

/**
 * 번호 필드 변환 맵핑
 */
export interface NumberFieldMapping {
  [key: string]: {
    type: NumberType;
    required: boolean;
    displayName: string;
  };
}

/**
 * 일반적인 번호 필드 맵핑
 */
export const COMMON_NUMBER_FIELDS: NumberFieldMapping = {
  mobile: {
    type: 'mobile',
    required: true,
    displayName: '휴대폰번호'
  },
  businessNumber: {
    type: 'business',
    required: true,
    displayName: '사업자등록번호'
  },
  businessPhone: {
    type: 'phone',
    required: false,
    displayName: '회사 전화번호'
  },
  presidentMobile: {
    type: 'mobile',
    required: false,
    displayName: '회사 휴대폰'
  }
} as const;

/**
 * SMS 수신자 정보
 */
export interface SMSRecipient {
  name: string;
  mobile: NormalizedMobile;
}

/**
 * 고객사 SMS 수신자 (person1 필수, person2 선택)
 */
export interface CustomerSMSRecipients {
  person1: SMSRecipient;
  person2?: SMSRecipient;
}