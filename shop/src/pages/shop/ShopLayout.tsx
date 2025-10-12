/**
 * 파일 경로: /src/pages/shop/ShopLayout.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 쇼핑몰 공통 레이아웃
 * 관련 데이터: 쇼핑몰 전체 구조
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import MobileProductList from './MobileProductList';
import OrderHistoryPage from './OrderHistoryPage';
import OrderDetailPage from './OrderDetailPage';
import FavoriteEditPage from './FavoriteEditPage';
import ProductDetailPage from './ProductDetailPage';
import CartPage from './CartPage';
import ChangePasswordPage from './ChangePasswordPage';
import BottomNavigation from './components/BottomNavigation';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
  Badge,
  ThemeProvider,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { shopTheme } from '../../theme/shopTheme';
import {
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  Star as StarIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ShoppingCart as ShoppingCartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowBack as ArrowBackIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { CustomerProvider } from '../../contexts/CustomerContext';
import { getCustomer } from '../../services/customerService';

const DRAWER_WIDTH = 240;

// 메뉴 아이템 정의
const menuItems = [
  {
    text: '주문하기',
    icon: <HomeIcon />,
    path: '/shop',
  },
  {
    text: '즐겨찾기 편집',
    icon: <StarIcon />,
    path: '/shop/favorites',
  },
  {
    text: '주문 이력',
    icon: <ReceiptIcon />,
    path: '/shop/orders',
  },
];

const ShopLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { state: cartState, clearCart } = useCart();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [customerInitialized, setCustomerInitialized] = useState(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitAction, setExitAction] = useState<'logout' | 'back' | null>(null);


  // 대리 쇼핑: URL에서 customer 파라미터 읽어서 고객사명 표시 (한 번만 실행)
  useEffect(() => {
    const customerParam = searchParams.get('customer');
    const customerNameParam = searchParams.get('name');

    // 이미 초기화되었거나, 파라미터가 없거나, 사용자 정보가 없으면 무시
    if (customerInitialized || !customerParam || !user) {
      return;
    }

    // admin/staff가 대리 쇼핑으로 진입한 경우
    if (user.role === 'admin' || user.role === 'staff') {
      // URL에서 받은 고객사명을 즉시 표시 (Firestore 조회 생략)
      if (customerNameParam && customerNameParam.trim()) {
        setCustomerName(decodeURIComponent(customerNameParam));
      }
      setCustomerInitialized(true);
    } else {
      setCustomerInitialized(true);
    }
  }, [searchParams, user, customerInitialized]);

  // 고객사 상호 조회 (customer role만)
  useEffect(() => {
    // admin/staff는 URL 파라미터에서 이미 설정됨
    if (user?.role === 'admin' || user?.role === 'staff') {
      return;
    }

    const loadCustomerName = async () => {
      const customerParam = searchParams.get('customer');
      if (!customerParam) {
        setCustomerName('');
        return;
      }

      try {
        const customer = await getCustomer(customerParam);
        if (customer) {
          setCustomerName(customer.businessName);
        }
      } catch (error) {
        console.error('고객사 상호 조회 실패:', error);
        setCustomerName('');
      }
    };

    loadCustomerName();
  }, [searchParams, user?.role]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (path: string) => {
    // customer 파라미터 유지
    const customerParam = searchParams.get('customer');
    const targetPath = customerParam ? `${path}?customer=${customerParam}` : path;
    navigate(targetPath);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleCloseWindow = () => {
    // 장바구니에 상품이 있으면 확인 창 표시
    if (cartState.totalItems > 0) {
      setExitAction('back');
      setExitDialogOpen(true);
      return;
    }

    // Admin/Staff: 대리쇼핑 페이지로 돌아가기
    navigate('/proxy-shopping');
  };

  const handleLogout = async () => {
    // 장바구니에 상품이 있으면 확인 창 표시
    if (cartState.totalItems > 0) {
      setExitAction('logout');
      setExitDialogOpen(true);
      return;
    }

    try {
      // Customer: 고객사 선택 페이지로 이동 (로그아웃하지 않음)
      navigate('/shop/select-customer');
    } catch (error) {
      console.error('페이지 이동 실패:', error);
    }
  };

  const handleChangePassword = () => {
    // customer 파라미터 유지
    const customerParam = searchParams.get('customer');
    const targetPath = customerParam ? `/shop/change-password?customer=${customerParam}` : '/shop/change-password';
    navigate(targetPath);
    setUserMenuOpen(false);
  };

  const handleExitConfirm = async () => {
    setExitDialogOpen(false);

    // 장바구니 초기화
    clearCart();

    try {
      if (exitAction === 'back') {
        // Admin/Staff: 대리쇼핑 페이지로 돌아가기
        navigate('/proxy-shopping');
      } else if (exitAction === 'logout') {
        // Customer: 고객사 선택 페이지로 이동 (로그아웃하지 않음)
        navigate('/shop/select-customer');
      }
    } catch (error) {
      console.error('종료 처리 실패:', error);
    } finally {
      setExitAction(null);
    }
  };

  const handleExitCancel = () => {
    setExitDialogOpen(false);
    setExitAction(null);
  };

  const handleUserMenuToggle = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  // 사이드바 내용
  const drawerContent = (
    <Box sx={{ bgcolor: '#1F2937', minHeight: '100vh', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <Box sx={{ p: 2, bgcolor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" noWrap sx={{ color: '#FFFFFF', fontWeight: 700 }}>
            JWS 쇼핑몰
          </Typography>
          {customerName && (
            <Typography variant="body1" sx={{ color: '#3B82F6', fontWeight: 600, mt: 1 }}>
              {customerName}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#374151' }} />

      {/* 메인 메뉴 */}
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleMenuClick(item.path)}
              sx={{
                color: '#D1D5DB',
                '&:hover': {
                  bgcolor: '#374151',
                },
                '&.Mui-selected': {
                  bgcolor: '#2563EB',
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: '#1E40AF',
                  },
                  '& .MuiListItemIcon-root': {
                    color: '#FFFFFF',
                  },
                  '& .MuiListItemText-secondary': {
                    color: '#E0E7FF',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: '#9CA3AF' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ borderColor: '#374151' }} />

      {/* 하단 사용자 메뉴 */}
      <Box sx={{ mt: 'auto' }}>
        <List>
          {/* Admin/Staff: 대리 쇼핑으로 돌아가기 버튼 */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={handleCloseWindow}
                  sx={{
                    color: '#3B82F6',
                    '&:hover': {
                      bgcolor: '#374151',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: '#3B82F6' }}>
                    <ArrowBackIcon />
                  </ListItemIcon>
                  <ListItemText primary="대리 쇼핑으로" />
                </ListItemButton>
              </ListItem>
              <Divider sx={{ borderColor: '#374151' }} />
              <ListItem sx={{ py: 1.5, px: 2, justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, color: '#D1D5DB' }}>
                    {user?.name || user?.email}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    {user?.role}
                  </Typography>
                </Box>
              </ListItem>
            </>
          )}

          {/* Customer: 확장 가능한 사용자 메뉴 */}
          {user?.role === 'customer' && (
            <>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={handleUserMenuToggle}
                  sx={{
                    color: '#D1D5DB',
                    '&:hover': {
                      bgcolor: '#374151',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: '#9CA3AF' }}>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary={user?.name || '사용자'} />
                  {userMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>
              </ListItem>
              <Collapse in={userMenuOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={handleChangePassword}
                      sx={{
                        pl: 4,
                        color: '#D1D5DB',
                        '&:hover': {
                          bgcolor: '#374151',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: '#9CA3AF' }}>
                        <KeyIcon />
                      </ListItemIcon>
                      <ListItemText primary="비밀번호 변경" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={handleLogout}
                      sx={{
                        pl: 4,
                        color: '#D1D5DB',
                        '&:hover': {
                          bgcolor: '#374151',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: '#9CA3AF' }}>
                        <LogoutIcon />
                      </ListItemIcon>
                      <ListItemText primary="쇼핑몰 종료" />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
        </List>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={shopTheme}>
      <CustomerProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* 앱바 (모바일용) */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          display: { xs: 'block', md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="메뉴 열기"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            JWS 쇼핑몰
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {customerName && (
            <Typography
              variant="caption"
              sx={{
                mr: 1.5,
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.7rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
              }}
            >
              {customerName}
            </Typography>
          )}
          <IconButton
            color="inherit"
            onClick={() => {
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop/cart?customer=${customerParam}` : '/shop/cart';
              navigate(targetPath);
            }}
          >
            <Badge badgeContent={cartState.totalItems} color="error">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* 모바일 드로어 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // 모바일 성능 향상
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 데스크톱 드로어 */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* 메인 컨텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          mt: { xs: 7, md: 0 }, // 모바일 앱바 높이만큼 마진
          mb: { xs: 8, md: 0 }, // 모바일 하단 네비게이션 바 높이만큼 마진
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >

        <Routes>
          <Route path="/" element={<MobileProductList />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/favorites" element={<FavoriteEditPage />} />
          <Route path="/favorites/product/:productId" element={<ProductDetailPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/shop" replace />} />
        </Routes>
      </Box>

      {/* 모바일 하단 네비게이션 바 */}
      <BottomNavigation />

      {/* 종료 확인 다이얼로그 */}
      <Dialog
        open={exitDialogOpen}
        onClose={handleExitCancel}
        aria-labelledby="exit-dialog-title"
        aria-describedby="exit-dialog-description"
      >
        <DialogTitle id="exit-dialog-title">
          {exitAction === 'back' ? '대리 쇼핑으로 돌아가기' : '쇼핑몰 종료'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="exit-dialog-description">
            장바구니에 <strong>{cartState.totalItems}개</strong>의 상품이 담겨 있습니다.
            <br />
            {exitAction === 'back' ? '대리 쇼핑으로 돌아가면' : '종료하면'} 장바구니가 초기화됩니다.
          </DialogContentText>
          <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
            ⚠️ 선택한 상품이 모두 삭제됩니다. 계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExitCancel} autoFocus>
            취소
          </Button>
          <Button onClick={handleExitConfirm} color="error" variant="contained">
            {exitAction === 'back' ? '대리 쇼핑으로' : '종료'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
      </CustomerProvider>
    </ThemeProvider>
  );
};

export default ShopLayout;