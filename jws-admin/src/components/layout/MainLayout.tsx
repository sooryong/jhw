/**
 * 파일 경로: /src/components/layout/MainLayout.tsx
 * 작성 날짜: 2025-09-23
 * 주요 내용: JWS 플랫폼 메인 레이아웃 컴포넌트 (완전 재작성)
 * 관련 데이터: 사이드바, 메인 콘텐츠 영역, 최적화된 레이아웃
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
} from '@mui/icons-material';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_WIDTH = 240;

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // 화면 크기 변경 시 사이드바 상태 조정
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 모바일 오버레이 */}
      {isMobile && sidebarOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1200,
          }}
          onClick={handleSidebarClose}
        />
      )}

      {/* 사이드바 */}
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />

      {/* 메인 콘텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          ml: {
            xs: 0,
            md: sidebarOpen ? `${SIDEBAR_WIDTH}px` : 0
          },
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          position: 'relative',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* 햄버거 메뉴 (사이드바 닫힘 시) */}
        {!sidebarOpen && (
          <IconButton
            onClick={handleSidebarToggle}
            sx={{
              position: 'fixed',
              top: 16,
              left: 16,
              zIndex: 1100,
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': {
                bgcolor: 'background.paper',
                boxShadow: 4,
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* 콘텐츠 영역 */}
        <Box
          sx={{
            width: '100%',
            height: '100vh',
            overflow: 'auto',
            pt: !sidebarOpen ? 7 : 0, // 햄버거 메뉴 공간 확보
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;