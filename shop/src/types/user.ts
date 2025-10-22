/**
 * 파일 경로: /src/types/user.ts
 * 업데이트: 2025-09-29
 * 주요 내용: 사용자 관련 타입 정의 (번호 정규화 규칙 적용)
 */

import type {
  NormalizedMobile,
  NormalizedBusinessNumber,
  FormattedMobile,
  FormattedBusinessNumber
} from './phoneNumber';

// 사용자 역할 (고객사, 공급사 추가)
export type UserRole = 'admin' | 'staff' | 'customer' | 'supplier';

// 다중 역할 지원을 위한 타입
export type UserRoles = UserRole[];

// SMS 수신자 정보 (customer 역할 전용) - 저장용
export interface SMSRecipientInfo {
  mobile: NormalizedMobile; // SMS 수신자 휴대폰번호 (정규화)
  name: string; // SMS 수신자 이름
  linkedCustomerNumbers: NormalizedBusinessNumber[]; // 연결된 고객사 사업자번호 목록 (정규화)
  recipientRole: 'person1' | 'person2'; // SMS 수신자 역할
}

// SMS 수신자 정보 (표시용)
export interface SMSRecipientInfoDisplay {
  mobile: FormattedMobile; // SMS 수신자 휴대폰번호 (포맷된)
  name: string; // SMS 수신자 이름
  linkedCustomerNumbers: FormattedBusinessNumber[]; // 연결된 고객사 사업자번호 목록 (포맷된)
  recipientRole: 'person1' | 'person2'; // SMS 수신자 역할
}

// JWS 사용자 정보 (SMS 수신자 기반 인증 지원) - 저장용
export interface JWSUser {
  uid: string;
  name: string;
  mobile: NormalizedMobile; // 휴대폰번호 (정규화)
  roles: UserRoles; // 다중 역할 지원 (배열) - 우선순위: admin > staff > customer > supplier
  email?: string; // 이메일 (선택사항)

  // customer 역할 전용 필드들
  smsRecipientInfo?: SMSRecipientInfo; // SMS 수신자 정보 (customer 역할일 때만)
  linkedCustomers?: NormalizedBusinessNumber[]; // 연결된 고객사 목록 (정규화)

  // supplier 역할 전용 필드들
  linkedSuppliers?: NormalizedBusinessNumber[]; // 연결된 공급사 목록 (정규화)

  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date | null; // 마지막 로그인 시간
  requiresPasswordChange: boolean;
  passwordChangedAt?: Date; // 비밀번호 변경 시간
}

// JWS 사용자 정보 (표시용)
export interface JWSUserDisplay {
  uid: string;
  name: string;
  mobile: FormattedMobile; // 휴대폰번호 (포맷된)
  roles: UserRoles; // 다중 역할 지원 (배열) - 우선순위: admin > staff > customer > supplier
  email?: string; // 이메일 (선택사항)

  // customer 역할 전용 필드들
  smsRecipientInfo?: SMSRecipientInfoDisplay; // SMS 수신자 정보 (customer 역할일 때만)
  linkedCustomers?: FormattedBusinessNumber[]; // 연결된 고객사 목록 (포맷된)

  // supplier 역할 전용 필드들
  linkedSuppliers?: FormattedBusinessNumber[]; // 연결된 공급사 목록 (포맷된)

  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date | null; // 마지막 로그인 시간
  requiresPasswordChange: boolean;
  passwordChangedAt?: Date; // 비밀번호 변경 시간
}

// 사용자 생성/수정 폼 데이터 (입력용 - 문자열 허용)
export interface JWSUserFormData {
  name: string;
  mobile: string; // 입력 시에는 문자열로 받아서 정규화
  roles: UserRole[]; // 다중 역할 선택
  email?: string;
  linkedCustomers?: string[]; // 입력 시에는 문자열로 받아서 정규화
  linkedSuppliers?: string[]; // 입력 시에는 문자열로 받아서 정규화
  isActive: boolean;
}

// 타입 변환 헬퍼 타입
export interface UserTypeConverters {
  toStorage: (formData: JWSUserFormData) => Omit<JWSUser, 'uid' | 'createdAt' | 'lastLogin' | 'requiresPasswordChange' | 'passwordChangedAt'>;
  toDisplay: (userData: JWSUser) => JWSUserDisplay;
  toForm: (userData: JWSUser) => JWSUserFormData;
}