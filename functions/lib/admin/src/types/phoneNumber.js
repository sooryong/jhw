"use strict";
/**
 * 파일 경로: /src/types/phoneNumber.ts
 * 작성 날짜: 2025-09-29
 * 주요 내용: 전화번호 관련 TypeScript 타입 정의
 * 원칙: 저장은 숫자만, 표시는 포맷팅
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_NUMBER_FIELDS = exports.createNormalizedBusinessNumber = exports.createNormalizedMobile = exports.createFormattedNumber = exports.createNormalizedNumber = exports.isNormalizedBusinessNumber = exports.isNormalizedMobile = exports.isFormattedNumber = exports.isNormalizedNumber = void 0;
/**
 * 타입 가드 함수들
 */
const isNormalizedNumber = (input) => {
    return /^\d+$/.test(input);
};
exports.isNormalizedNumber = isNormalizedNumber;
const isFormattedNumber = (input) => {
    return /^[\d-]+$/.test(input) && input.includes('-');
};
exports.isFormattedNumber = isFormattedNumber;
const isNormalizedMobile = (input) => {
    return /^010\d{8}$/.test(input);
};
exports.isNormalizedMobile = isNormalizedMobile;
const isNormalizedBusinessNumber = (input) => {
    return /^\d{3}-\d{2}-\d{5}$/.test(input);
};
exports.isNormalizedBusinessNumber = isNormalizedBusinessNumber;
/**
 * 번호 생성 헬퍼 함수들
 */
const createNormalizedNumber = (input) => {
    const normalized = input.replace(/[^0-9]/g, '');
    return normalized;
};
exports.createNormalizedNumber = createNormalizedNumber;
const createFormattedNumber = (input) => {
    return input;
};
exports.createFormattedNumber = createFormattedNumber;
const createNormalizedMobile = (input) => {
    const normalized = (0, exports.createNormalizedNumber)(input);
    if ((0, exports.isNormalizedMobile)(normalized)) {
        return normalized;
    }
    throw new Error('Invalid mobile number format');
};
exports.createNormalizedMobile = createNormalizedMobile;
const createNormalizedBusinessNumber = (input) => {
    // 숫자만 추출
    const digitsOnly = input.replace(/[^0-9]/g, '');
    // 10자리가 아니면 에러
    if (digitsOnly.length !== 10) {
        throw new Error('Invalid business number format: must be 10 digits');
    }
    // 하이픈 포함 형태로 포맷 (123-45-67890)
    const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5, 10)}`;
    if ((0, exports.isNormalizedBusinessNumber)(formatted)) {
        return formatted;
    }
    throw new Error('Invalid business number format');
};
exports.createNormalizedBusinessNumber = createNormalizedBusinessNumber;
/**
 * 일반적인 번호 필드 맵핑
 */
exports.COMMON_NUMBER_FIELDS = {
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
};
//# sourceMappingURL=phoneNumber.js.map