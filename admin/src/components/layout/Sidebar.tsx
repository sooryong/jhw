/**
 * 파일 경로: /src/components/layout/Sidebar.tsx
 * 작성 날짜: 2025-09-22
 * 주요 내용: JHW 플랫폼 사이드바 컴포넌트
 * 관련 데이터: 메인 메뉴, 네비게이션, 사용자 정보
 */

import React, { useState } from 'react';
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
  Store,
  ShoppingCart,
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
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import JHWLogo from '../../assets/JHWLogo';

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

  // 역할별 메뉴 구성
  const getMenuItems = (): MenuItem[] => {
    const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';
    const isCustomer = user?.role === 'customer';

    const baseItems: MenuItem[] = [
      {
        text: '대시보드',
        icon: <Dashboard />,
        path: '/dashboard',
        implemented: true,
      },
    ];

    // admin 전용: 일일주문 확정
    if (user?.role === 'admin') {
      baseItems.push({
        text: '일일주문 확정',
        icon: <Assignment />,
        path: '/orders/management',
        implemented: true,
      });
    }

    // admin/staff 전용 메뉴
    if (isAdminOrStaff) {
      baseItems.push(
        {
          text: '일일주문 입고',
          icon: <MoveToInbox />,
          path: '/orders/inbound',
          implemented: true,
        },
        {
          text: '일일주문 출하',
          icon: <LocalShipping />,
          path: '/outbound',
          implemented: false,
        },
        {
          text: '원장 관리',
          icon: <Assessment />,
          implemented: true,
          subItems: [
            {
              text: '매입 원장',
              icon: <Assessment />,
              path: '/ledgers/purchase',
              implemented: true,
            },
            {
              text: '매출 원장',
              icon: <Assessment />,
              path: '/ledgers/sales',
              implemented: false,
            },
          ],
        },
        {
          text: '기준정보 관리',
          icon: <BusinessIcon />,
          implemented: user?.role === 'admin',
          subItems: [
            {
              text: '고객사 관리',
              icon: <PeopleIcon />,
              path: '/customers',
              implemented: user?.role === 'admin',
            },
            {
              text: '공급사 관리',
              icon: <BusinessIcon />,
              path: '/suppliers',
              implemented: user?.role === 'admin',
            },
            {
              text: '상품 관리',
              icon: <Inventory />,
              path: '/products',
              implemented: user?.role === 'admin',
            },
          ],
        }
      );
    }

    // admin 전용: 시스템 설정
    if (user?.role === 'admin') {
      baseItems.push({
        text: '시스템 설정',
        icon: <Settings />,
        implemented: true,
        subItems: [
          {
            text: '사용자 설정',
            icon: <ManageAccountsIcon />,
            path: '/users',
            implemented: true,
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
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role}
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