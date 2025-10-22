/**
 * 파일 경로: /src/components/layout/Sidebar.tsx
 * 작성 날짜: 2025-09-22
 * 주요 내용: JHW 플랫폼 사이드바 컴포넌트
 * 관련 데이터: 메인 메뉴, 네비게이션, 사용자 정보
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  Collapse,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Dashboard,
  Sms,
  Inventory,
  LocalShipping,
  Assessment,
  Settings,
  Business as BusinessIcon,
  People as PeopleIcon,
  ManageAccounts as ManageAccountsIcon,
  Logout,
  ChevronLeft,
  ExpandLess,
  ExpandMore,
  Key,
  Assignment,
  MoveToInbox,
  Person,
  ListAlt,
  BarChart,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import JHWLogo from '../../assets/JHWLogo';
import type { UserRole } from '../../types/user';

// 역할 우선순위 계산 (admin > staff > customer > supplier)
const getPrimaryRole = (roles: UserRole[]): UserRole => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('staff')) return 'staff';
  if (roles.includes('customer')) return 'customer';
  if (roles.includes('supplier')) return 'supplier';
  return 'staff'; // 기본값
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface SubMenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  implemented: boolean;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path?: string;
  implemented: boolean;
  subItems?: SubMenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({});
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // 현재 경로에 따라 해당하는 메뉴를 자동으로 펼치기
  useEffect(() => {
    const currentPath = location.pathname;

    // 경로에 따라 펼쳐야 할 메뉴 결정
    const pathToMenuMap: { [key: string]: string } = {
      '/orders/sale-order-status': '매출주문 접수',
      '/orders/sale-order-management': '매출주문 접수',
      '/orders/sale-aggregation': '매출주문 접수',
      '/orders/daily-food-cutoff-settings': '일일식품 발주',
      '/orders/daily-food-purchase-aggregation': '일일식품 발주',
      '/orders/daily-food-purchase-orders': '일일식품 발주',
      '/customers': '기준정보 관리',
      '/suppliers': '기준정보 관리',
      '/products': '기준정보 관리',
      '/users': '시스템 설정',
      '/sms': '시스템 설정',
    };

    const menuToExpand = pathToMenuMap[currentPath];
    if (menuToExpand) {
      setExpandedMenus((prev) => ({
        ...prev,
        [menuToExpand]: true,
      }));
    }
  }, [location.pathname]);

  // 역할별 메뉴 구성
  const getMenuItems = (): MenuItem[] => {
    const isAdminOrStaff = user?.roles.includes('admin') || user?.roles.includes('staff');

    const baseItems: MenuItem[] = [];

    // admin/staff 전용 메뉴
    if (isAdminOrStaff) {
      baseItems.push(
        {
          text: '매출주문 접수',
          icon: <Assignment />,
          implemented: true,
          subItems: [
            {
              text: '접수 현황',
              icon: <Dashboard />,
              path: '/orders/sale-order-status',
              implemented: true,
            },
            {
              text: '주문 접수',
              icon: <ListAlt />,
              path: '/orders/sale-order-management',
              implemented: true,
            },
            {
              text: '상품 집계',
              icon: <BarChart />,
              path: '/orders/sale-aggregation',
              implemented: true,
            },
          ],
        },
        {
          text: '일일식품 발주',
          icon: <LocalShipping />,
          implemented: true,
          subItems: [
            {
              text: '마감 설정',
              icon: <Dashboard />,
              path: '/orders/daily-food-cutoff-settings',
              implemented: true,
            },
            {
              text: '매입 집계',
              icon: <BarChart />,
              path: '/orders/daily-food-purchase-aggregation',
              implemented: true,
            },
            {
              text: '매입 발주',
              icon: <ListAlt />,
              path: '/orders/daily-food-purchase-orders',
              implemented: true,
            },
          ],
        },
        {
          text: '입고 관리',
          icon: <MoveToInbox />,
          path: '/orders/inbound',
          implemented: true,
        },
        {
          text: '출하 관리',
          icon: <LocalShipping />,
          path: '/orders/outbound',
          implemented: true,
        },
        {
          text: '매입원장 관리',
          icon: <Assessment />,
          path: '/ledgers/purchase',
          implemented: true,
        },
        {
          text: '매출원장 관리',
          icon: <Assessment />,
          path: '/ledgers/sales',
          implemented: true,
        },
        {
          text: '기준정보 관리',
          icon: <BusinessIcon />,
          implemented: user?.roles.includes('admin'),
          subItems: [
            {
              text: '고객사 관리',
              icon: <PeopleIcon />,
              path: '/customers',
              implemented: user?.roles.includes('admin'),
            },
            {
              text: '공급사 관리',
              icon: <BusinessIcon />,
              path: '/suppliers',
              implemented: user?.roles.includes('admin'),
            },
            {
              text: '상품 관리',
              icon: <Inventory />,
              path: '/products',
              implemented: user?.roles.includes('admin'),
            },
          ],
        }
      );
    }

    // 시스템 설정
    if (isAdminOrStaff) {
      baseItems.push({
        text: '시스템 설정',
        icon: <Settings />,
        implemented: true,
        subItems: [
          {
            text: '사용자 설정',
            icon: <ManageAccountsIcon />,
            path: '/users',
            implemented: user?.roles.includes('admin'),
          },
          {
            text: 'SMS 센터',
            icon: <Sms />,
            path: '/sms',
            implemented: true,
          },
        ],
      });
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  const handleMenuClick = (path: string, implemented: boolean) => {
    if (implemented && path) {
      navigate(path);
    }
  };

  const handleMenuToggle = (menuText: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuText]: !prev[menuText]
    }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // RoleBasedRedirect가 /login으로 리다이렉트
    } catch {
      // Error handled silently
      // 로그아웃 오류 처리
    }
    setUserMenuAnchor(null);
  };

  const handleChangePassword = () => {
    navigate('/change-my-password');
    setUserMenuAnchor(null);
  };

  const drawerWidth = 240;

  return (
    <Box
      className="sidebar-container no-print"
      sx={{
        width: drawerWidth,
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 1200,
        '@media print': {
          display: 'none !important',
        },
      }}
    >
        {/* 헤더 영역 */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <JHWLogo sx={{ width: 32, height: 32, mr: 1.5 }} />
            <Typography
              variant="h6"
              onClick={() => window.location.reload()}
              sx={{
                color: 'primary.main',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.dark'
                }
              }}
            >
              JHW 플랫폼
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <ChevronLeft />
          </IconButton>
        </Box>

        <Divider />

        {/* 메뉴 리스트 */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List sx={{ pt: 1 }}>
            {menuItems.map((item) => (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      if (item.subItems) {
                        handleMenuToggle(item.text);
                      } else {
                        handleMenuClick(item.path!, item.implemented);
                      }
                    }}
                    disabled={!item.implemented}
                    selected={item.path ? location.pathname === item.path : false}
                    sx={{
                      mx: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(5, 150, 105, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(5, 150, 105, 0.2)',
                        },
                      },
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      '&.Mui-disabled': {
                        opacity: 0.5,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: (item.path && location.pathname === item.path) ? 'primary.main' : 'text.secondary',
                        minWidth: 40,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontSize: '0.9rem',
                          fontWeight: (item.path && location.pathname === item.path) ? 600 : 400,
                          color: (item.path && location.pathname === item.path) ? 'primary.main' : 'text.primary',
                        },
                      }}
                    />
                    {item.subItems && (
                      expandedMenus[item.text] ? <ExpandLess /> : <ExpandMore />
                    )}
                  </ListItemButton>
                </ListItem>

                {/* 하위 메뉴 */}
                {item.subItems && (
                  <Collapse in={expandedMenus[item.text]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((subItem) => (
                        <ListItem key={subItem.text} disablePadding>
                          <ListItemButton
                            onClick={() => handleMenuClick(subItem.path, subItem.implemented)}
                            disabled={!subItem.implemented}
                            selected={location.pathname === subItem.path}
                            sx={{
                              pl: 4,
                              mx: 1,
                              mb: 0.5,
                              borderRadius: 1,
                              '&.Mui-selected': {
                                bgcolor: 'rgba(5, 150, 105, 0.1)',
                                '&:hover': {
                                  bgcolor: 'rgba(5, 150, 105, 0.2)',
                                },
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                              '&.Mui-disabled': {
                                opacity: 0.5,
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                color: location.pathname === subItem.path ? 'primary.main' : 'text.secondary',
                                minWidth: 40,
                              }}
                            >
                              {subItem.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={subItem.text}
                              sx={{
                                '& .MuiListItemText-primary': {
                                  fontSize: '0.85rem',
                                  fontWeight: location.pathname === subItem.path ? 600 : 400,
                                  color: location.pathname === subItem.path ? 'primary.main' : 'text.primary',
                                },
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}

                {/* 매출원장 관리 다음에 구분선 추가 */}
                {item.text === '매출원장 관리' && (
                  <Divider sx={{ my: 1.5, mx: 2 }} />
                )}
              </React.Fragment>
            ))}
          </List>
        </Box>

        <Divider />

        {/* 사용자 정보 */}
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            sx={{
              borderRadius: 1,
              p: 1,
              mb: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mr: 1.5 }}>
              <Person />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.name} ({user ? getPrimaryRole(user.roles) : ''})
              </Typography>
            </Box>
          </ListItemButton>

          {/* 사용자 메뉴 */}
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={() => setUserMenuAnchor(null)}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={handleChangePassword}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Key />
              </ListItemIcon>
              <ListItemText primary="비밀번호 변경" />
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="로그아웃" />
            </MenuItem>
          </Menu>
        </Box>
    </Box>
  );
};

export default Sidebar;