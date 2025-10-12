/**
 * 파일 경로: /src/utils/numberUtils.ts
 * 작성 날짜: 2025-09-28
 * 업데이트: 2025-10-07
 * 주요 내용: 번호 정규화 및 포맷팅 유틸리티
 * 원칙: 저장과 표시 모두 하이픈 포함 (123-45-67890)
 */

import type { FormattedMobile, FormattedPhone, FormattedBusinessNumber } from '../types/phoneNumber';

/**
 * 입력된 문자열에서 숫자만 추출 (내부 처리용)
 * @param input 원본 문자열
 * @returns 숫자만 포함된 문자열
 */
export const normalizeNumber = (input: string): string => {
  if (!input) return '';
  return input.replace(/[^0-9]/g, '');
};

/**
 * 사업자등록번호 정규화 (저장용 - 하이픈 포함)
 * @param input 사용자 입력 (숫자만 또는 하이픈 포함)
 * @returns 하이픈 포함 사업자등록번호 (123-45-67890)
 */
export const normalizeBusinessNumber = (input: string): string => {
  if (!input) return '';
  const numbers = normalizeNumber(input);

  if (numbers.length === 10) {
    return numbers.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3');
  }

  return input; // 10자리가 아니면 원본 반환
};

/**
 * 사업자등록번호 실시간 입력 포맷팅
 * @param input 사용자 입력
 * @returns 실시간 포맷팅된 사업자등록번호
 */
export const formatBusinessNumberInput = (input: string): string => {
  if (!input) return '';

  // 숫자만 추출
  const numbers = normalizeNumber(input);

  // 10자리 초과하면 10자리까지만
  const truncated = numbers.slice(0, 10);

  // 실시간 포맷팅
  if (truncated.length <= 3) {
    return truncated;
  } else if (truncated.length <= 5) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3)}`;
  } else {
    return `${truncated.slice(0, 3)}-${truncated.slice(3, 5)}-${truncated.slice(5)}`;
  }
};

/**
 * 휴대폰번호 포맷팅 (표시용)
 * @param number 숫자만 포함된 휴대폰번호 (11자리)
 * @returns 포맷팅된 휴대폰번호 (010-XXXX-XXXX)
 */
export const formatMobile = (number: string): FormattedMobile => {
  if (!number) return '' as FormattedMobile;

  const normalized = normalizeNumber(number);

  if (normalized.length === 11 && normalized.startsWith('010')) {
    return normalized.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') as FormattedMobile;
  }

  return normalized as FormattedMobile;
};

/**
 * 일반 전화번호 포맷팅 (표시용)
 * @param number 숫자만 포함된 전화번호
 * @returns 포맷팅된 전화번호
 */
export const formatPhone = (number: string): FormattedPhone => {
  if (!number) return '' as FormattedPhone;

  const normalized = normalizeNumber(number);

  // 서울 지역번호 (02-XXXX-XXXX)
  if (normalized.startsWith('02')) {
    if (normalized.length === 9) {
      return normalized.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3') as FormattedPhone;
    } else if (normalized.length === 10) {
      return normalized.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3') as FormattedPhone;
    }
  }

  // 기타 지역번호 (0XX-XXX-XXXX 또는 0XX-XXXX-XXXX)
  if (normalized.startsWith('0') && normalized.length >= 9) {
    if (normalized.length === 10) {
      return normalized.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') as FormattedPhone;
    } else if (normalized.length === 11) {
      return normalized.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') as FormattedPhone;
    }
  }

  return normalized as FormattedPhone;
};

/**
 * 사업자등록번호 포맷팅 (표시용 및 실시간 입력용)
 * @param number 사업자등록번호 (하이픈 포함 또는 미포함)
 * @returns 하이픈 포함 사업자등록번호 (123-45-67890)
 */
export const formatBusinessNumber = (number: string): FormattedBusinessNumber => {
  return formatBusinessNumberInput(number) as FormattedBusinessNumber;
};

/**
 * 팩스번호 포맷팅 (표시용) - 전화번호와 동일한 규칙
 */
export const formatFax = formatPhone;

/**
 * 휴대폰번호 유효성 검증
 * @param number 검증할 번호
 * @returns 유효 여부
 */
export const isValidMobile = (number: string): boolean => {
  const normalized = normalizeNumber(number);
  return normalized.length === 11 && normalized.startsWith('010');
};

/**
 * 사업자등록번호 유효성 검증
 * @param number 검증할 번호
 * @returns 유효 여부
 */
export const isValidBusinessNumber = (number: string): boolean => {
  const normalized = normalizeNumber(number);
  return normalized.length === 10;
};

/**
 * 번호 비교 (정규화 후 비교)
 * @param number1 첫 번째 번호
 * @param number2 두 번째 번호
 * @returns 동일 여부
 */
export const compareNumbers = (number1: string, number2: string): boolean => {
  return normalizeNumber(number1) === normalizeNumber(number2);
};

/**
 * 번호 입력 시 실시간 포맷팅 (사용자 입력용)
 * @param value 현재 입력값
 * @param type 번호 타입
 * @returns 포맷팅된 값
 */
export const formatNumberInput = (value: string, type: 'mobile' | 'phone' | 'business' | 'fax'): string => {
  switch (type) {
    case 'mobile':
      return formatMobile(value);
    case 'phone':
    case 'fax':
      return formatPhone(value);
    case 'business':
      return formatBusinessNumber(value);
    default:
      return value;
  }
};

/**
 * 번호 검색용 정규화 (검색 시 사용)
 * 입력된 검색어를 숫자만으로 변환하여 DB의 숫자 형태와 비교 가능하게 함
 */
export const normalizeForSearch = (searchTerm: string): string => {
  return normalizeNumber(searchTerm);
};

/**
 * 일반 전화번호 유효성 검증
 * @param number 검증할 번호
 * @returns 유효 여부
 */
export const isValidPhone = (number: string): boolean => {
  const normalized = normalizeNumber(number);

  // 서울 지역번호 (02) - 9자리 또는 10자리
  if (normalized.startsWith('02')) {
    return normalized.length >= 9 && normalized.length <= 10;
  }

  // 기타 지역번호 (031, 032, 등) - 10자리 또는 11자리
  if (normalized.startsWith('0') && normalized.length >= 3) {
    return normalized.length >= 10 && normalized.length <= 11;
  }

  return false;
};

/**
 * 번호 타입 자동 감지
 * @param number 감지할 번호
 * @returns 번호 타입
 */
export const detectNumberType = (number: string): 'mobile' | 'phone' | 'business' | 'unknown' => {
  const normalized = normalizeNumber(number);

  if (isValidMobile(normalized)) return 'mobile';
  if (isValidBusinessNumber(normalized)) return 'business';
  if (isValidPhone(normalized)) return 'phone';

  return 'unknown';
};

/**
 * 번호 마스킹 (개인정보 보호용)
 * @param number 마스킹할 번호
 * @param type 번호 타입
 * @returns 마스킹된 번호
 */
export const maskNumber = (number: string, type?: 'mobile' | 'phone' | 'business'): string => {
  if (!number) return '';

  const normalized = normalizeNumber(number);
  const detectedType = type || detectNumberType(normalized);

  switch (detectedType) {
    case 'mobile':
      // 010-****-1234 형태로 마스킹
      if (normalized.length === 11) {
        return normalized.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3');
      }
      break;
    case 'business':
      // 123-**-**890 형태로 마스킹
      if (normalized.length === 10) {
        return normalized.replace(/(\d{3})(\d{2})(\d{5})/, '$1-**-***$3');
      }
      break;
    case 'phone':
      // 02-****-5678 형태로 마스킹
      if (normalized.startsWith('02')) {
        if (normalized.length === 9) {
          return normalized.replace(/(\d{2})(\d{3})(\d{4})/, '$1-***-$3');
        } else if (normalized.length === 10) {
          return normalized.replace(/(\d{2})(\d{4})(\d{4})/, '$1-****-$3');
        }
      } else if (normalized.startsWith('0')) {
        return normalized.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-****-$3');
      }
      break;
  }

  return number;
};

/**
 * 입력값이 숫자만으로 구성되었는지 확인
 * @param input 확인할 입력값
 * @returns 숫자만 포함 여부
 */
export const isNumericOnly = (input: string): boolean => {
  return /^\d+$/.test(input);
};

/**
 * 배열의 번호들을 정규화하여 반환
 * @param numbers 번호 배열
 * @returns 정규화된 번호 배열
 */
export const normalizeNumberArray = (numbers: string[]): string[] => {
  return numbers.map(normalizeNumber).filter(Boolean);
};