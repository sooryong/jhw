/**
 * 파일 경로: /src/components/RoleBasedRedirect.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 사용자 역할에 따른 리다이렉트 컴포넌트
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

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

  // 역할별 리다이렉트
  switch (user.role) {
    case 'customer':
      return <Navigate to="/shop" replace />;
    case 'admin':
    case 'staff':
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

export default RoleBasedRedirect;