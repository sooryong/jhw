/**
 * 파일 경로: /src/App.tsx
 * 작성 날짜: 2025-10-12
 * 주요 내용: JHW Shop v2.1 메인 애플리케이션
 * 관련 데이터: 쇼핑몰 전용 앱, 라우팅, 테마
 */

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';

// 테마
import { jhwTheme } from './styles/theme';

// 라우터
import ShopRouter from './router/ShopRouter';

// 컨텍스트
import { AuthProvider } from './contexts/AuthContextProvider';
import CartProvider from './contexts/CartContext';
import { CustomerProvider } from './contexts/CustomerContext';

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
          <CustomerProvider>
            <CartProvider>
              <BrowserRouter>
                <ShopRouter />
              </BrowserRouter>
            </CartProvider>
          </CustomerProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;