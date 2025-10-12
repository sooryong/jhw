/**
 * 파일 경로: /src/contexts/AuthContext.tsx
 * 작성 날짜: 2025-09-22
 * 업데이트: 2025-09-30 (RBAC 권한 시스템 추가)
 * 주요 내용: JWS 플랫폼 인증 컨텍스트 타입 정의
 * 관련 데이터: 사용자 인증 상태, 로그인/로그아웃, 권한 관리
 */

import { createContext, useContext } from 'react';
import type { JWSUser } from '../types/user';
import type { Permission } from '../utils/rbac';

export interface AuthContextType {
  // 인증 상태
  user: JWSUser | null;
  loading: boolean;

  // 인증 메서드
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // 고객사 조회 메서드 (다중 고객사 지원)
  getAvailableCustomers: () => string[];

  // SMS 수신자 기반 메서드
  isSMSRecipientUser: () => boolean;
  getSMSRecipientInfo: () => import('../types/user').SMSRecipientInfo | null;

  // 권한 확인 메서드 (역할 기반)
  isAdmin: () => boolean;
  isStaff: () => boolean;
  isCustomer: () => boolean;

  // 권한 확인 메서드 (세분화된 권한)
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canAccessPath: (path: string) => boolean;
}

// 컨텍스트 생성
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// useAuth 훅
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};