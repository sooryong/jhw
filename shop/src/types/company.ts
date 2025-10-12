/**
 * 파일 경로: /src/types/company.ts
 * 작성 날짜: 2025-09-24 (수정: 컬렉션 분리)
 * 업데이트: 2025-09-29 (번호 정규화 규칙 적용)
 * 주요 내용: 회사 관련 TypeScript 타입 정의 - 고객사/공급사 컬렉션 분리
 * 관련 데이터: Firebase customers, suppliers 컬렉션
 */

import { Timestamp } from 'firebase/firestore';
import type {
  NormalizedMobile,
  NormalizedBusinessNumber,
  NormalizedPhone,
  FormattedMobile,
  FormattedBusinessNumber,
  FormattedPhone
} from './phoneNumber';

// SMS 수신자 정보 (저장용)
export interface SMSRecipient {
  name: string;
  mobile: NormalizedMobile; // 휴대폰번호 (정규화)
}

// SMS 수신자 정보 (표시용)
export interface SMSRecipientDisplay {
  name: string;
  mobile: FormattedMobile; // 휴대폰번호 (포맷된)
}

// SMS 수신자 구조 (person1 필수, person2 선택) - 저장용
export interface CustomerSMSRecipients {
  person1: SMSRecipient;
  person2?: SMSRecipient;
}

// SMS 수신자 구조 (표시용)
export interface CustomerSMSRecipientsDisplay {
  person1: SMSRecipientDisplay;
  person2?: SMSRecipientDisplay;
}

// 특가 상품 정보
export interface SpecialPrice {
  productId: string;             // 상품 ID
  productName: string;           // 상품명 (캐시)
  originalPrice: number;         // 원가
  discountedPrice: number;       // 기본 할인율 적용가
  specialPrice: number;          // 관리자 특별 설정가
  isActive: boolean;             // 특가 활성화
  startDate?: Timestamp;         // 특가 시작일
  endDate?: Timestamp;           // 특가 종료일
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

// 즐겨찾기 상품 정보
export interface FavoriteProduct {
  productId: string;             // 상품 ID
  productName: string;           // 상품명 (캐시)
  productImage?: string;         // 상품 이미지 URL
  displayOrder: number;          // 표시 순서
  isActive: boolean;             // 활성화 여부
}

// 연락처 정보 (더 이상 사용하지 않음 - 개별 필드로 대체)
export interface ContactInfo {
  mobile?: string;
  phone?: string;
  email?: string;
}

// 기본 회사 정보 (공통 필드) - 사업자등록번호를 문서 ID로 사용 (저장용)
export interface BaseCompany {
  // 사업자등록번호가 문서 ID가 되므로 별도 id 필드 불필요
  businessNumber: NormalizedBusinessNumber; // 사업자등록번호 (정규화)
  businessName: string; // 상호명
  president: string; // 대표자명
  businessAddress: string; // 사업장 주소
  businessType?: string; // 업태 (선택)
  businessItem?: string; // 종목 (선택)

  // 회사 연락처 (개별 필드로 변경, 모두 선택) - 정규화
  presidentMobile?: NormalizedMobile; // 대표자 휴대폰
  businessPhone?: NormalizedPhone;  // 회사 전화번호
  businessEmail?: string;  // 회사 이메일

  // SMS 수신자 (person1 필수, person2 선택)
  smsRecipient: CustomerSMSRecipients;

  // 상태
  isActive: boolean;

  // 메타데이터 (간소화)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 기본 회사 정보 (표시용)
export interface BaseCompanyDisplay {
  businessNumber: FormattedBusinessNumber; // 사업자등록번호 (포맷된)
  businessName: string; // 상호명
  president: string; // 대표자명
  businessAddress: string; // 사업장 주소
  businessType?: string; // 업태 (선택)
  businessItem?: string; // 종목 (선택)

  // 회사 연락처 (포맷된)
  presidentMobile?: FormattedMobile; // 대표자 휴대폰
  businessPhone?: FormattedPhone;  // 회사 전화번호
  businessEmail?: string;  // 회사 이메일

  // SMS 수신자 (포맷된)
  smsRecipient: CustomerSMSRecipientsDisplay;

  // 상태
  isActive: boolean;

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 고객사 정보 (customers 컬렉션) - 저장용
export interface Customer extends BaseCompany {
  customerType: string; // Settings에서 로드되는 고객사 유형
  discountRate: number; // 기본 할인율 (%)
  currentBalance: number; // 현재 미수금 (필드명 변경)

  // 새로운 필드들
  specialPrices: SpecialPrice[]; // 고객사별 특가 상품
  favoriteProducts: FavoriteProduct[]; // 즐겨찾기 상품
}

// 고객사 정보 (표시용)
export interface CustomerDisplay extends BaseCompanyDisplay {
  customerType: string;
  discountRate: number;
  currentBalance: number;
  specialPrices: SpecialPrice[];
  favoriteProducts: FavoriteProduct[];
}

// 공급사 정보 (suppliers 컬렉션) - 저장용
export interface Supplier extends BaseCompany {
  // 공급사는 기본 회사 정보와 SMS 수신자만 있으면 됨
  // paymentTerms, deliveryTerms, outstandingPayment, supplierCategory 제거
  supplierType?: string;
}

// 공급사 정보 (표시용)
export interface SupplierDisplay extends BaseCompanyDisplay {
  supplierType?: string;
}

// 통합 회사 타입 (저장용)
export type Company = Customer | Supplier;

// 통합 회사 타입 (표시용)
export type CompanyDisplay = CustomerDisplay | SupplierDisplay;

// 회사 구분 타입
export type CompanyType = 'customer' | 'supplier';

// 고객사 생성/수정용 폼 데이터 (입력용 - 문자열 허용)
export interface CustomerFormData {
  // 기본 정보
  businessNumber: string; // 입력 시에는 문자열로 받아서 정규화
  businessName: string;
  president: string;
  businessAddress: string;
  businessType?: string;
  businessItem?: string;

  // 회사 연락처 (입력 시에는 문자열로 받아서 정규화)
  presidentMobile?: string;
  businessPhone?: string;
  businessEmail?: string;

  // SMS 수신자 (입력용 - 문자열 허용)
  smsRecipient: {
    person1: {
      name: string;
      mobile: string; // 입력 시에는 문자열로 받아서 정규화
    };
    person2?: {
      name: string;
      mobile: string; // 입력 시에는 문자열로 받아서 정규화
    };
  };

  // 상태
  isActive: boolean;

  // 고객사 전용 필드
  customerType: string;
  discountRate: number;
  currentBalance: number;

  // 새로운 필드들
  specialPrices: SpecialPrice[];
  favoriteProducts: FavoriteProduct[];
}

// 공급사 생성/수정용 폼 데이터 (입력용 - 문자열 허용)
export interface SupplierFormData {
  // 기본 정보
  businessNumber: string; // 입력 시에는 문자열로 받아서 정규화
  businessName: string;
  president: string;
  businessAddress: string;
  businessType?: string;
  businessItem?: string;

  // 회사 연락처 (입력 시에는 문자열로 받아서 정규화)
  presidentMobile?: string;
  businessPhone?: string;
  businessEmail?: string;

  // SMS 수신자 (입력용 - 문자열 허용)
  smsRecipient: {
    person1: {
      name: string;
      mobile: string; // 입력 시에는 문자열로 받아서 정규화
    };
    person2?: {
      name: string;
      mobile: string; // 입력 시에는 문자열로 받아서 정규화
    };
  };

  // 상태
  isActive: boolean;

  // 공급사 전용 필드
  supplierType?: string;
}

// 통합 폼 데이터 타입
export type CompanyFormData = CustomerFormData | SupplierFormData;

// 검색/필터 조건
export interface CompanyFilter {
  isActive?: boolean;
  searchText?: string;

  // 페이지네이션
  page?: number;      // 페이지 번호 (0부터 시작)
  limit?: number;     // 페이지당 항목 수 (기본 25)
}

// 고객사 필터
export interface CustomerFilter extends CompanyFilter {
  customerType?: string;
}

// 공급사 필터
export interface SupplierFilter extends CompanyFilter {
  // 공급사는 단순화되어 특별한 필터가 없음
  supplierType?: string;
}

// API 응답 타입
export interface CompanyResponse<T = Company | Company[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 페이지네이션 응답 타입
export interface PaginatedCompanyResponse<T = Company[]> {
  success: boolean;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class CompanyServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CompanyServiceError';
    this.code = code;
  }
}

// 타입 변환 헬퍼 인터페이스
export interface CompanyTypeConverters {
  toStorage: (formData: CompanyFormData) => Customer | Supplier;
  toDisplay: (companyData: Company) => CompanyDisplay;
  toForm: (companyData: Company) => CompanyFormData;
}

// 사업자등록번호 유틸리티 함수 타입 (Deprecated - numberUtils 사용 권장)
export interface BusinessNumberUtils {
  format: (businessNumber: string) => string; // 하이픈 추가
  normalize: (businessNumber: string) => string; // 하이픈 제거 (문서 ID용)
  validate: (businessNumber: string) => boolean; // 유효성 검사
}

// 사업자등록번호 유틸리티 구현 (Deprecated - numberUtils.ts 사용 권장)
export const businessNumberUtils: BusinessNumberUtils = {
  format: (businessNumber: string): string => {
    // numberUtils.formatBusinessNumber를 사용하는 것을 권장
    const numbers = businessNumber.replace(/[^0-9]/g, '');
    if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
    }
    return businessNumber;
  },

  normalize: (businessNumber: string): string => {
    // numberUtils.normalizeBusinessNumber를 사용하는 것을 권장
    // 하이픈 포함 형식으로 정규화 (123-45-67890)
    const numbers = businessNumber.replace(/[^0-9]/g, '');
    if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
    }
    return businessNumber;
  },

  validate: (businessNumber: string): boolean => {
    // numberUtils.isValidBusinessNumber를 사용하는 것을 권장
    const numbers = businessNumber.replace(/[^0-9]/g, '');
    return numbers.length === 10 && /^\d{10}$/.test(numbers);
  }
};

// 타입 가드 함수들
export const isCustomer = (company: Company): company is Customer => {
  return 'customerType' in company;
};

export const isSupplier = (company: Company): company is Supplier => {
  return !('customerType' in company);
};

// 기본 고객사 타입 목록
export const DEFAULT_CUSTOMER_TYPES = [
  '일반고객',
  'VIP고객',
  '특별고객',
  '대량고객'
] as const;

// 기본 공급사 카테고리 목록 (단순화로 제거)
// export const DEFAULT_SUPPLIER_CATEGORIES = [];

// No default export needed - all exports are named exports