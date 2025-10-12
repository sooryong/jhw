/**
 * 파일 경로: /src/utils/formatUtils.ts
 * 작성 날짜: 2025-09-27
 * 업데이트: 2025-09-29
 * 주요 내용: 공통 포맷팅 유틸리티 함수들 (numberUtils.ts와 통합)
 *
 * 이 파일은 numberUtils.ts의 포맷팅 함수들에 대한 호환성 레이어입니다.
 * 새 코드에서는 numberUtils.ts를 직접 사용하는 것을 권장합니다.
 */

import {
  formatMobile,
  formatPhone as formatPhoneNumber,
  formatBusinessNumber as formatBusinessNum,
  formatBusinessNumberInput,
  formatFax,
  normalizeNumber,
  normalizeBusinessNumber,
  detectNumberType,
  maskNumber
} from './numberUtils';

/**
 * 휴대폰번호 포맷팅 (010-1234-5678)
 * @deprecated 대신 numberUtils.formatMobile을 사용하세요
 * @param phone 숫자만 포함된 휴대폰번호 또는 이미 포맷된 번호
 * @returns 포맷된 휴대폰번호
 */
export const formatPhone = (phone: string): string => {
  return formatMobile(phone);
};

/**
 * 사업자등록번호 포맷팅 (123-45-67890)
 * @deprecated 대신 numberUtils.formatBusinessNumber를 사용하세요
 * @param businessNumber 숫자만 포함된 사업자번호 또는 이미 포맷된 번호
 * @returns 포맷된 사업자등록번호
 */
export const formatBusinessNumber = (businessNumber: string): string => {
  return formatBusinessNum(businessNumber);
};

/**
 * 일반 전화번호 포맷팅 (02-1234-5678, 031-123-4567 등)
 * @deprecated 대신 numberUtils.formatPhone을 사용하세요
 * @param phone 숫자만 포함된 전화번호 또는 이미 포맷된 번호
 * @returns 포맷된 전화번호
 */
export const formatTelNumber = (phone: string): string => {
  return formatPhoneNumber(phone);
};

/**
 * 팩스번호 포맷팅 (전화번호와 동일한 형식)
 * @deprecated 대신 numberUtils.formatFax를 사용하세요
 * @param fax 숫자만 포함된 팩스번호 또는 이미 포맷된 번호
 * @returns 포맷된 팩스번호
 */
export const formatFaxNumber = (fax: string): string => {
  return formatFax(fax);
};

// 새로운 포맷팅 함수들 (numberUtils.ts에서 가져옴)
export {
  formatMobile,
  formatPhoneNumber as formatPhoneNew,
  formatBusinessNum as formatBusinessNumberNew,
  formatBusinessNumberInput,
  formatFax,
  normalizeNumber,
  normalizeBusinessNumber,
  detectNumberType,
  maskNumber
};

/**
 * 통합 포맷팅 함수 - 번호 타입을 자동 감지하여 적절한 포맷을 적용
 * @param number 포맷팅할 번호
 * @param forceType 강제로 적용할 타입 (선택)
 * @returns 포맷된 번호
 */
export const formatNumber = (number: string, forceType?: 'mobile' | 'phone' | 'business'): string => {
  if (!number) return '';

  const type = forceType || detectNumberType(number);

  switch (type) {
    case 'mobile':
      return formatMobile(number);
    case 'phone':
      return formatPhoneNumber(number);
    case 'business':
      return formatBusinessNum(number);
    default:
      return number;
  }
};

/**
 * 디스플레이용 포맷팅 (마스킹 포함 옵션)
 * @param number 포맷팅할 번호
 * @param options 옵션
 * @returns 포맷된 번호
 */
export const formatForDisplay = (
  number: string,
  options: {
    mask?: boolean;
    type?: 'mobile' | 'phone' | 'business';
  } = {}
): string => {
  if (!number) return '';

  if (options.mask) {
    return maskNumber(number, options.type);
  }

  return formatNumber(number, options.type);
};

/**
 * 통화 금액 포맷팅 (1,234,567원)
 * @param amount 금액
 * @returns 포맷된 금액 문자열
 */
export const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('ko-KR')}원`;
};