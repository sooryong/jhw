/**
 * 파일 경로: /src/theme/shopTheme.ts
 * 작성 날짜: 2025-10-01
 * 주요 내용: JWS 쇼핑몰 전용 테마 (아마존 스타일)
 * 특징: JWS 플랫폼과 차별화된 색상
 */

import { createTheme } from '@mui/material/styles';

// JWS 쇼핑몰 색상 테마 (Modern B2B 스타일)
export const shopTheme = createTheme({
  palette: {
    primary: {
      main: '#2563EB',        // 블루 (메인)
      light: '#3B82F6',
      dark: '#1E40AF',
      contrastText: '#fff',
    },
    secondary: {
      main: '#F59E0B',        // 오렌지 (강조)
      light: '#FBBF24',
      dark: '#D97706',
      contrastText: '#fff',
    },
    success: {
      main: '#00A650',        // 진한 초록 (재고 있음)
      light: '#33B873',
      dark: '#008540',
    },
    warning: {
      main: '#F59E0B',        // 골드 (경고)
      light: '#FBBF24',
      dark: '#D97706',
    },
    error: {
      main: '#DC2626',        // 빨강 (재고 없음)
      light: '#EF4444',
      dark: '#B91C1C',
    },
    background: {
      default: '#F9FAFB',     // 밝은 회색
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(255, 153, 0, 0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#F3F4F6',
        },
      },
    },
  },
});
