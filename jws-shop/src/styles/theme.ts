/**
 * 파일 경로: /src/styles/theme.ts
 * 작성 날짜: 2025-09-22
 * 주요 내용: JWS 플랫폼 Material-UI 테마 설정 - 표준 MUI 디자인
 * 관련 데이터: Material-UI 테마, 표준 레이아웃, JWS 디자인 시스템
 */

import { createTheme } from '@mui/material/styles';

// JWS 브랜드 색상
export const JWS_BRAND_COLORS = {
  green: '#059669',
  greenLight: '#10b981',
  greenDark: '#047857',
} as const;

// JWS 플랫폼 테마 생성 (표준 MUI 디자인)
export const jwsTheme = createTheme({
  // 색상 팔레트 - JWS 그린 기반
  palette: {
    mode: 'light',
    primary: {
      main: JWS_BRAND_COLORS.green,
      light: JWS_BRAND_COLORS.greenLight,
      dark: JWS_BRAND_COLORS.greenDark,
    },
    secondary: {
      main: '#047857',
      light: '#10b981',
      dark: '#065f46',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#f44336',
      dark: '#c62828',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  },

  // 타이포그래피 (표준 MUI)
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.125rem',
      fontWeight: 300,
      lineHeight: 1.167,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 400,
      lineHeight: 1.167,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 400,
      lineHeight: 1.235,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.334,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.6,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'uppercase' as const,
    },
  },

  // 표준 MUI 간격 시스템
  spacing: 8,

  // 표준 MUI 컴포넌트 설정
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
        },
      },
    },
  },
});

export default jwsTheme;