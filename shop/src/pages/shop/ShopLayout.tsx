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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, logout: _logout } = useAuth();
  const { state: cartState, clearCart } = useCart();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_customerInitialized, _setCustomerInitialized] = useState(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitAction, setExitAction] = useState<'logout' | 'back' | null>(null);


  // 고객사 상호 조회
  useEffect(() => {
    const loadCustomerName = async () => {
      const customerParam = searchParams.get('customer');

      if (!customerParam || !user) {
        setCustomerName('');
        return;
      }

      // Admin/Staff: URL 파라미터에서 고객사명 읽기
      if (user.role === 'admin' || user.role === 'staff') {
        const customerNameParam = searchParams.get('name');
        if (customerNameParam && customerNameParam.trim()) {
          setCustomerName(decodeURIComponent(customerNameParam));
        } else {
          // name 파라미터 없으면 Firestore에서 조회
          try {
            const customer = await getCustomer(customerParam);
            if (customer) {
              setCustomerName(customer.businessName);
            }
          } catch (error) {
      // Error handled silently
            console.error('고객사 상호 조회 실패:', error);
            setCustomerName('');
          }
        }
      }
      // Customer: Firestore에서 고객사 조회
      else {
        try {
          const customer = await getCustomer(customerParam);
          if (customer) {
            setCustomerName(customer.businessName);
          }
        } catch (error) {
      // Error handled silently
          console.error('고객사 상호 조회 실패:', error);
          setCustomerName('');
        }
      }
    };

    loadCustomerName();
  }, [searchParams, user?.role, user]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleCloseWindow = () => {
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
      // Error handled silently
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
      // Error handled silently
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
      <Box sx={{ p: 2, bgcolor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" noWrap sx={{ color: '#FFFFFF', fontWeight: 700 }}>
          JHW 쇼핑몰
        </Typography>
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
        <Divider sx={{ borderColor: '#374151' }} />

        {/* 고객사명 표시 */}
        {customerName ? (
          <>
            <Box sx={{ py: 2, px: 2, bgcolor: '#111827', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="body1" sx={{ color: '#3B82F6', fontWeight: 600, fontSize: '0.95rem' }}>
                {customerName}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: '#374151' }} />
          </>
        ) : null}

        {/* 하단 버튼 영역: [←] [아이콘 사용자(역할)] */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 나가기 버튼 */}
            <IconButton
              onClick={handleLogout}
              size="small"
              sx={{
                color: '#9CA3AF',
                '&:hover': {
                  bgcolor: '#374151',
                  color: '#FFFFFF',
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>

            {/* 사용자 정보: 아이콘 + 이름(역할) */}
            {user?.role === 'customer' ? (
              // 고객사 사용자: 클릭 가능한 메뉴
              <Box sx={{ flexGrow: 1 }}>
                <ListItemButton
                  onClick={handleUserMenuToggle}
                  sx={{
                    borderRadius: 1,
                    py: 0.5,
                    px: 1,
                    color: '#D1D5DB',
                    display: 'flex',
                    justifyContent: 'center',
                    '&:hover': {
                      bgcolor: '#374151',
                    },
                  }}
                >
                  <PersonIcon sx={{ fontSize: '1.2rem', mr: 1 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {user?.name || user?.email}
                  </Typography>
                  {userMenuOpen ? <ExpandLessIcon sx={{ ml: 1 }} /> : <ExpandMoreIcon sx={{ ml: 1 }} />}
                </ListItemButton>

                {/* 고객사 사용자 메뉴 (비밀번호 변경, 로그아웃) */}
                <Collapse in={userMenuOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ mt: 0.5 }}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={handleChangePassword}
                        sx={{
                          pl: 2,
                          py: 0.75,
                          borderRadius: 1,
                          color: '#D1D5DB',
                          '&:hover': {
                            bgcolor: '#374151',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: '#9CA3AF' }}>
                          <KeyIcon sx={{ fontSize: '1.1rem' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="비밀번호 변경"
                          primaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={handleLogout}
                        sx={{
                          pl: 2,
                          py: 0.75,
                          borderRadius: 1,
                          color: '#D1D5DB',
                          '&:hover': {
                            bgcolor: '#374151',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: '#9CA3AF' }}>
                          <LogoutIcon sx={{ fontSize: '1.1rem' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="로그아웃"
                          primaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Collapse>
              </Box>
            ) : (
              // 직원/관리자: 클릭 불가능한 표시
              <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <PersonIcon sx={{ fontSize: '1.2rem', color: '#9CA3AF' }} />
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#D1D5DB', fontSize: '0.9rem' }}>
                  {user?.name || user?.email}
                  <Typography component="span" sx={{ color: '#6B7280', ml: 0.5 }}>
                    ({user?.role})
                  </Typography>
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
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
            JHW 쇼핑몰
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
            onClick={() => {
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop/cart?customer=${customerParam}` : '/shop/cart';
              navigate(targetPath);
            }}
            sx={{ color: 'primary.main' }}
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