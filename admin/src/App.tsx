/**
 * 파일 경로: /src/App.tsx
 * 작성 날짜: 2025-09-22
 * 주요 내용: JHW 플랫폼 메인 애플리케이션 - 완전 새로운 TSX 구현
 * 관련 데이터: 전체 애플리케이션 구조, 라우팅, 테마
 */

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';

// 테마
import { jhwTheme } from './styles/theme';

// 라우터
import AppRouter from './router/AppRouter';

// 컨텍스트
import { AuthProvider } from './contexts/AuthContextProvider';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={jhwTheme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={4000}
        dense
      >
        <AuthProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;