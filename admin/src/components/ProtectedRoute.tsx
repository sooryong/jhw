/**
 * 파일 경로: /src/components/ProtectedRoute.tsx
 * 작성 날짜: 2025-09-22
 * 업데이트: 2025-09-30 (RBAC 권한 시스템 추가)
 * 주요 내용: 보호된 라우트 컴포넌트 - 인증 확인
 * 관련 데이터: 인증 상태 확인, 리다이렉트 처리
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/user';
import type { Permission } from '../utils/rbac';

// 역할 우선순위 계산 (admin > staff > customer > supplier)
// const getPrimaryRole = (roles: UserRole[]): UserRole => {
//   if (roles.includes('admin')) return 'admin';
//   if (roles.includes('staff')) return 'staff';
//   if (roles.includes('customer')) return 'customer';
//   if (roles.includes('supplier')) return 'supplier';
//   return 'staff'; // 기본값
// };

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[]; // 접근 허용할 역할들
  requiredPermissions?: Permission[]; // 필요한 권한들 (하나라도 있으면 접근 가능)
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermissions }) => {
  const { user, loading, hasAnyPermission, isCustomer } = useAuth();
  const location = useLocation();

  // 로딩 중일 때 (LocalStorage 캐시가 없는 경우만)
  // LocalStorage에 user 캐시가 있으면 즉시 렌더링하고, Firestore 검증은 백그라운드로 처리
  if (loading && !user) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          인증 상태를 확인하고 있습니다...
        </Typography>
      </Box>
    );
  }

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 비밀번호 변경이 필요한 경우 (비밀번호 변경 페이지가 아닌 경우에만)
  if (user.requiresPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // 고객사 사용자의 쇼핑몰 접근 시 URL 확인 (단순화된 로직)
  if (user.roles.includes('customer') &&
      location.pathname.startsWith('/shop') &&
      location.pathname !== '/shop/select-customer') {

    const urlParams = new URLSearchParams(location.search);
    const customerParam = urlParams.get('customer');

    // URL에 customer 파라미터 없으면 선택 페이지로
    if (!customerParam) {
      return <Navigate to="/shop/select-customer" replace />;
    }

    // 연결된 고객사 목록 가져오기
    let linkedCustomers: string[] = [];
    if (user.smsRecipientInfo) {
      linkedCustomers = user.smsRecipientInfo.linkedCustomerNumbers;
    } else {
      linkedCustomers = user.linkedCustomers || [];
    }

    // 연결된 고객사가 없는 경우
    if (linkedCustomers.length === 0) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, p: 3 }}>
          <Typography variant="h5" color="error">접근 권한 없음</Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            연결된 고객사가 없습니다.<br />관리자에게 고객사 연결을 요청해주세요.
          </Typography>
        </Box>
      );
    }

    // URL의 고객사가 연결 목록에 없으면 선택 페이지로
    if (!linkedCustomers.includes(customerParam)) {
      return <Navigate to="/shop/select-customer" replace />;
    }
  }

  // 권한 기반 접근 제어 (우선순위 1: 세분화된 권한)
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAnyPermission(requiredPermissions)) {
      // customer 역할이 권한 없는 페이지 접근 시 쇼핑몰로 리다이렉트
      if (isCustomer()) {
        return <Navigate to="/shop" replace />;
      }
      // 관리자/직원이 권한 없는 페이지 접근 시 대시보드로 리다이렉트
      return <Navigate to="/dashboard" replace />;
    }
  }
  // 역할별 접근 제어 (우선순위 2: 역할 기반)
  else if (allowedRoles && !user.roles.some(role => allowedRoles.includes(role))) {
    // customer 역할이 관리자 페이지에 접근 시 쇼핑몰로 리다이렉트
    if (isCustomer()) {
      return <Navigate to="/shop" replace />;
    }
    // 관리자/직원이 허용되지 않은 페이지 접근 시 대시보드로 리다이렉트
    return <Navigate to="/dashboard" replace />;
  }

  // 인증된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
};

export default ProtectedRoute;