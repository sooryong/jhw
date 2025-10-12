/**
 * 파일 경로: /src/pages/shop/components/BottomNavigation.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 모바일 전용 하단 네비게이션 바 (3개 메뉴)
 * 관련 데이터: 쇼핑몰 네비게이션
 * 업데이트: 즐겨찾기 제거, 주문이력 추가
 */

import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Paper,
  BottomNavigation as MuiBottomNavigation,
  BottomNavigationAction,
  Badge,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Home as HomeIcon,
  ShoppingCart as ShoppingCartIcon,
  Star as StarIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { useCart } from '../../../contexts/CartContext';

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { state: cartState } = useCart();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 모바일이 아니면 렌더링하지 않음
  if (!isMobile) {
    return null;
  }

  const getValue = () => {
    const path = location.pathname;
    if (path === '/shop' || path === '/shop/') return 0;
    if (path.startsWith('/shop/favorites')) return 1;
    if (path.startsWith('/shop/cart')) return 2;
    if (path.startsWith('/shop/orders')) return 3;
    return 0;
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    // customer 파라미터 유지
    const customerParam = searchParams.get('customer');

    const getPath = (path: string) => {
      return customerParam ? `${path}?customer=${customerParam}` : path;
    };

    switch (newValue) {
      case 0:
        navigate(getPath('/shop'));
        break;
      case 1:
        navigate(getPath('/shop/favorites'));
        break;
      case 2:
        navigate(getPath('/shop/cart'));
        break;
      case 3:
        navigate(getPath('/shop/orders'));
        break;
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={3}
    >
      <MuiBottomNavigation
        showLabels
        value={getValue()}
        onChange={handleChange}
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 80,
            padding: '6px 12px 8px',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.8rem',
            marginTop: '4px',
          },
          '& .Mui-selected': {
            color: 'primary.main',
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.8rem',
              fontWeight: 600,
            },
          },
        }}
      >
        <BottomNavigationAction
          label="주문하기"
          icon={<HomeIcon />}
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        />
        <BottomNavigationAction
          label="즐겨찾기"
          icon={<StarIcon />}
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        />
        <BottomNavigationAction
          label="장바구니"
          icon={
            <Badge badgeContent={cartState.totalItems} color="error" max={99}>
              <ShoppingCartIcon />
            </Badge>
          }
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        />
        <BottomNavigationAction
          label="주문내역"
          icon={<ReceiptIcon />}
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        />
      </MuiBottomNavigation>
    </Paper>
  );
};

export default BottomNavigation;
