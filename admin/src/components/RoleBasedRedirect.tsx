/**
 * 파일 경로: /src/components/RoleBasedRedirect.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 사용자 역할에 따른 리다이렉트 컴포넌트
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';
import type { UserRole } from '../types/user';

// 역할 우선순위 계산 (admin > staff > customer > supplier)
const getPrimaryRole = (roles: UserRole[]): UserRole => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('staff')) return 'staff';
  if (roles.includes('customer')) return 'customer';
  if (roles.includes('supplier')) return 'supplier';
  return 'staff'; // 기본값
};

const RoleBasedRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  // 로딩 중일 때
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 역할별 리다이렉트 (우선순위 기반)
  const primaryRole = getPrimaryRole(user.roles);

  switch (primaryRole) {
    case 'admin':
    case 'staff':
      return <Navigate to="/orders/sale-order-status" replace />;
    case 'customer':
    default:
      // customer는 플랫폼 접근 불가 - 로그인 페이지로
      return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;