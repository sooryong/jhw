/**
 * 파일 경로: /src/contexts/AuthContextProvider.tsx
 * 작성 날짜: 2025-09-25
 * 업데이트: 2025-09-30 (RBAC 권한 시스템 추가)
 * 주요 내용: JWS 플랫폼 인증 프로바이더 컴포넌트
 * 관련 데이터: 사용자 인증 상태, 로그인/로그아웃, 권한 관리
 */

import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AuthContext } from './AuthContext';
import type { AuthContextType } from './AuthContext';
import type { JWSUser, SMSRecipientInfo } from '../types/user';
import { customerLinkService } from '../services/customerLinkService';
import { getUserByAuthUid } from '../services/userService';
import type { Permission } from '../utils/rbac';
import * as rbac from '../utils/rbac';
import type { NormalizedMobile, NormalizedBusinessNumber } from '../types/phoneNumber';

// 프로바이더 컴포넌트
interface AuthProviderProps {
  children: ReactNode;
}

// LocalStorage 키 (Admin 앱 전용)
const USER_CACHE_KEY = 'jhw_admin_user_cache';
const USER_CACHE_TIME_KEY = 'jhw_admin_user_cache_time';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // LocalStorage에서 캐시된 user 읽기 (즉시 로딩)
  const getCachedUser = (): JWSUser | null => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      const cacheTime = localStorage.getItem(USER_CACHE_TIME_KEY);

      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        // 캐시가 24시간 이내면 사용
        if (age < 24 * 60 * 60 * 1000) {
          const cachedData = JSON.parse(cached);
          // Date 객체 복원
          return {
            ...cachedData,
            createdAt: cachedData.createdAt ? new Date(cachedData.createdAt) : new Date(),
            lastLogin: cachedData.lastLogin ? new Date(cachedData.lastLogin) : null,
            passwordChangedAt: cachedData.passwordChangedAt ? new Date(cachedData.passwordChangedAt) : undefined,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load cached user:', error);
    }
    return null;
  };

  const [user, setUser] = useState<JWSUser | null>(getCachedUser());
  const [loading, setLoading] = useState<boolean>(true);

  // User 상태 업데이트 시 LocalStorage에 캐싱
  const updateUserWithCache = (newUser: JWSUser | null) => {
    setUser(newUser);

    try {
      if (newUser) {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(newUser));
        localStorage.setItem(USER_CACHE_TIME_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(USER_CACHE_KEY);
        localStorage.removeItem(USER_CACHE_TIME_KEY);
      }
    } catch (error) {
      console.warn('Failed to cache user:', error);
    }
  };

  // Firebase 인증 상태 변경 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // 로그인된 사용자가 있는 경우 authUid로 Firestore에서 사용자 정보 조회
          const jwsUser = await getUserByAuthUid(firebaseUser.uid);

          if (jwsUser) {
            // SMS 수신자 정보 추가 조회 (customer 역할인 경우)
            if (jwsUser.role === 'customer') {
              try {
                const smsResult = await customerLinkService.findCustomersBySMSRecipient(jwsUser.mobile);
                if (smsResult) {
                  const primaryLink = smsResult.linkedCustomers.find(c => c.recipientRole === 'person1')
                                    || smsResult.linkedCustomers[0];

                  jwsUser.smsRecipientInfo = {
                    mobile: smsResult.mobile as NormalizedMobile,
                    name: smsResult.name,
                    linkedCustomerNumbers: smsResult.linkedCustomers.map(c => c.businessNumber as NormalizedBusinessNumber),
                    recipientRole: primaryLink.recipientRole,
                  };
                }
              } catch (error) {
                console.error('SMS 수신자 정보 조회 실패:', error);
              }
            }

            updateUserWithCache(jwsUser);
          } else {
            // Firestore에 사용자 정보가 없으면 로그아웃 처리
            try {
              await signOut(auth);
            } catch {
              // 로그아웃 오류는 조용히 처리
            }
            updateUserWithCache(null);
          }
        } else {
          // 로그인된 사용자가 없는 경우
          updateUserWithCache(null);
        }
      } catch {
        // 인증 상태 확인 오류는 조용히 처리
        updateUserWithCache(null);
      } finally {
        setLoading(false);
      }
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribe();
  }, []);

  // 로그인 함수
  const login = async (phoneNumber: string, password: string): Promise<void> => {
    try {
      setLoading(true);

      // 휴대폰번호를 이메일 형식으로 변환
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      const email = `${normalizedPhone}@jhw.local`;

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError: any) {
        // Firebase Auth 에러 처리
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          throw new Error('등록되지 않은 사용자입니다.\n\n사용자 등록은 관리자에게 문의하세요.');
        } else if (authError.code === 'auth/wrong-password') {
          throw new Error('비밀번호가 올바르지 않습니다.');
        } else if (authError.code === 'auth/too-many-requests') {
          throw new Error('로그인 시도가 너무 많습니다.\n잠시 후 다시 시도해주세요.');
        } else {
          throw new Error('로그인 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
        }
      }

      // authUid로 Firestore에서 사용자 정보 조회
      const jwsUser = await getUserByAuthUid(userCredential.user.uid);

      if (!jwsUser) {
        // Firebase Auth에는 계정이 있지만 Firestore에 사용자 정보가 없는 경우
        await signOut(auth);
        throw new Error('사용자 정보가 등록되지 않았습니다.\n\n관리자에게 문의하세요.');
      }

      // isActive 확인
      if (!jwsUser.isActive) {
        await signOut(auth);
        throw new Error('비활성화된 계정입니다.\n\n관리자에게 문의하세요.');
      }

      // SMS 수신자 정보 추가 조회 (customer 역할인 경우)
      if (jwsUser.role === 'customer') {
        try {
          const smsResult = await customerLinkService.findCustomersBySMSRecipient(jwsUser.mobile);
          if (smsResult) {
            const primaryLink = smsResult.linkedCustomers.find(c => c.recipientRole === 'person1')
                              || smsResult.linkedCustomers[0];

            jwsUser.smsRecipientInfo = {
              mobile: smsResult.mobile as NormalizedMobile,
              name: smsResult.name,
              linkedCustomerNumbers: smsResult.linkedCustomers.map(c => c.businessNumber as NormalizedBusinessNumber),
              recipientRole: primaryLink.recipientRole,
            };
          }
        } catch (error) {
          console.error('SMS 수신자 정보 조회 실패:', error);
        }
      }

      // 마지막 로그인 시간 업데이트 (문서 ID는 mobile)
      await updateDoc(doc(db, 'users', jwsUser.mobile), {
        lastLogin: serverTimestamp()
      });

      // lastLogin 업데이트
      jwsUser.lastLogin = new Date();

      updateUserWithCache(jwsUser);
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = async (): Promise<void> => {
    await signOut(auth);
    updateUserWithCache(null);
  };

  // 역할 확인 메서드
  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const isStaff = (): boolean => {
    return user?.role === 'staff';
  };

  const isCustomer = (): boolean => {
    return user?.role === 'customer';
  };

  // 세분화된 권한 확인 메서드
  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return rbac.hasPermission(user.role, permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return rbac.hasAnyPermission(user.role, permissions);
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return rbac.hasAllPermissions(user.role, permissions);
  };

  const canAccessPath = (path: string): boolean => {
    if (!user) return false;
    return rbac.canAccessPath(user.role, path);
  };

  // 사용자 정보 새로고침
  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setLoading(true);
        const jwsUser = await getUserByAuthUid(currentUser.uid);

        if (jwsUser) {
          // SMS 수신자 정보 추가 조회 (customer 역할인 경우)
          if (jwsUser.role === 'customer') {
            try {
              const smsResult = await customerLinkService.findCustomersBySMSRecipient(jwsUser.mobile);
              if (smsResult) {
                const primaryLink = smsResult.linkedCustomers.find(c => c.recipientRole === 'person1')
                                  || smsResult.linkedCustomers[0];

                jwsUser.smsRecipientInfo = {
                  mobile: smsResult.mobile as NormalizedMobile,
                  name: smsResult.name,
                  linkedCustomerNumbers: smsResult.linkedCustomers.map(c => c.businessNumber as NormalizedBusinessNumber),
                  recipientRole: primaryLink.recipientRole,
                };
              }
            } catch (error) {
              console.error('SMS 수신자 정보 조회 실패:', error);
            }
          }

          updateUserWithCache(jwsUser);
        }
      }
    } catch {
      // 사용자 정보 새로고침 오류는 조용히 처리
    } finally {
      setLoading(false);
    }
  };

  // 사용 가능한 고객사 목록 조회 (SMS 수신자 또는 직접 연결)
  const getAvailableCustomers = (): string[] => {
    if (user?.smsRecipientInfo) {
      // SMS 수신자인 경우 연결된 고객사 목록 반환
      return user.smsRecipientInfo.linkedCustomerNumbers;
    }
    // 기존 방식 (관리자가 직접 연결한 경우)
    return user?.linkedCustomers || [];
  };

  // SMS 수신자 사용자인지 확인
  const isSMSRecipientUser = (): boolean => {
    return !!user?.smsRecipientInfo;
  };

  // SMS 수신자 정보 조회
  const getSMSRecipientInfo = (): SMSRecipientInfo | null => {
    return user?.smsRecipientInfo || null;
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    getAvailableCustomers,
    isSMSRecipientUser,
    getSMSRecipientInfo,
    isAdmin,
    isStaff,
    isCustomer,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessPath
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};