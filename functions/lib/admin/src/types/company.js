"use strict";
/**
 * 파일 경로: /src/types/company.ts
 * 작성 날짜: 2025-09-24 (수정: 컬렉션 분리)
 * 업데이트: 2025-09-29 (번호 정규화 규칙 적용)
 * 주요 내용: 회사 관련 TypeScript 타입 정의 - 고객사/공급사 컬렉션 분리
 * 관련 데이터: Firebase customers, suppliers 컬렉션
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CUSTOMER_TYPES = exports.isSupplier = exports.isCustomer = exports.businessNumberUtils = exports.CompanyServiceError = void 0;
// 서비스 에러 타입
class CompanyServiceError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'CompanyServiceError';
        this.code = code;
    }
}
exports.CompanyServiceError = CompanyServiceError;
// 사업자등록번호 유틸리티 구현 (Deprecated - numberUtils.ts 사용 권장)
exports.businessNumberUtils = {
    format: (businessNumber) => {
        // numberUtils.formatBusinessNumber를 사용하는 것을 권장
        const numbers = businessNumber.replace(/[^0-9]/g, '');
        if (numbers.length === 10) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
        }
        return businessNumber;
    },
    normalize: (businessNumber) => {
        // numberUtils.normalizeBusinessNumber를 사용하는 것을 권장
        // 하이픈 포함 형식으로 정규화 (123-45-67890)
        const numbers = businessNumber.replace(/[^0-9]/g, '');
        if (numbers.length === 10) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
        }
        return businessNumber;
    },
    validate: (businessNumber) => {
        // numberUtils.isValidBusinessNumber를 사용하는 것을 권장
        const numbers = businessNumber.replace(/[^0-9]/g, '');
        return numbers.length === 10 && /^\d{10}$/.test(numbers);
    }
};
// 타입 가드 함수들
const isCustomer = (company) => {
    return 'customerType' in company;
};
exports.isCustomer = isCustomer;
const isSupplier = (company) => {
    return !('customerType' in company);
};
exports.isSupplier = isSupplier;
// 기본 고객사 타입 목록
exports.DEFAULT_CUSTOMER_TYPES = [
    '일반고객',
    'VIP고객',
    '특별고객',
    '대량고객'
];
// 기본 공급사 카테고리 목록 (단순화로 제거)
// export const DEFAULT_SUPPLIER_CATEGORIES = [];
// No default export needed - all exports are named exports
//# sourceMappingURL=company.js.map