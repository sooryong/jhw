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

// 고객사 사용자 알림 설정
export interface CustomerUserNotificationPreferences {
  receiveOrderNotifications: boolean; // 주문 관련 SMS 수신
  receivePaymentNotifications: boolean; // 결제 관련 SMS 수신
  receivePromotionNotifications: boolean; // 프로모션 SMS 수신
}

// 고객사 내 사용자 역할
export type CustomerUserRole = 'primary' | 'secondary' | 'member';
// primary: 주 담당자 (person1), secondary: 부 담당자 (person2), member: 일반 구성원

// SMS 수신자 정보 (customer 역할 전용) - 저장용
export interface SMSRecipientInfo {
  mobile: NormalizedMobile; // SMS 수신자 휴대폰번호 (정규화)
  name: string; // SMS 수신자 이름
  linkedCustomerNumbers: NormalizedBusinessNumber[]; // 연결된 고객사 사업자번호 목록 (정규화)
  recipientRole: 'person1' | 'person2'; // SMS 수신자 역할 (Deprecated - customerRole 사용 권장)
  customerRole: CustomerUserRole; // 고객사 내 역할
  notificationPreferences: CustomerUserNotificationPreferences; // 알림 설정
}

// SMS 수신자 정보 (표시용)
export interface SMSRecipientInfoDisplay {
  mobile: FormattedMobile; // SMS 수신자 휴대폰번호 (포맷된)
  name: string; // SMS 수신자 이름
  linkedCustomerNumbers: FormattedBusinessNumber[]; // 연결된 고객사 사업자번호 목록 (포맷된)
  recipientRole: 'person1' | 'person2'; // SMS 수신자 역할 (Deprecated)
  customerRole: CustomerUserRole; // 고객사 내 역할
  notificationPreferences: CustomerUserNotificationPreferences; // 알림 설정
}

// JWS 사용자 정보 (SMS 수신자 기반 인증 지원) - 저장용
export interface JWSUser {
  uid: string;
  name: string;
  mobile: NormalizedMobile; // 휴대폰번호 (정규화)
  role: UserRole;
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
  role: UserRole;
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
  role: UserRole;
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

// 타입 alias (간편한 사용을 위해)
export type User = JWSUser;
export type UserDisplay = JWSUserDisplay;
export type UserFormData = JWSUserFormData;