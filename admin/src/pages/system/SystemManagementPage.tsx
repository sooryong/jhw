/**
 * 시스템 관리 페이지
 * 작성 날짜: 2025-09-23
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Grid,
} from '@mui/material';
import {
  Sms as SmsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SystemMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  implemented: boolean;
}

const SystemManagementPage: React.FC = () => {
  const navigate = useNavigate();

  const systemMenuItems: SystemMenuItem[] = [
    {
      title: 'SMS 센터',
      description: 'SMS 발송, 사용량 모니터링, 잔액 관리',
      icon: <SmsIcon color="primary" />,
      path: '/sms',
      implemented: true,
    },
    {
      title: '사용자 관리',
      description: '시스템 사용자 계정 및 권한 관리',
      icon: <PeopleIcon color="secondary" />,
      path: '/system/users',
      implemented: false,
    },
    {
      title: '코드 관리',
      description: '공통 코드 및 기준 코드 관리',
      icon: <CodeIcon color="info" />,
      path: '/system/codes',
      implemented: false,
    },
    {
      title: '보안 설정',
      description: '로그인 정책, 비밀번호 정책 설정',
      icon: <SecurityIcon color="warning" />,
      path: '/system/security',
      implemented: false,
    },
    {
      title: '백업 및 복구',
      description: '데이터 백업 및 복구 관리',
      icon: <StorageIcon color="success" />,
      path: '/system/backup',
      implemented: false,
    },
    {
      title: '시스템 설정',
      description: '기본 설정 및 환경 변수 관리',
      icon: <SettingsIcon />,
      path: '/system/settings',
      implemented: false,
    },
  ];

  const handleMenuClick = (item: SystemMenuItem) => {
    if (item.implemented) {
      navigate(item.path);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        onClick={() => window.location.reload()}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            color: 'primary.main'
          }
        }}
      >
        시스템 관리
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        시스템 운영에 필요한 각종 관리 기능을 제공합니다.
      </Typography>

      <Grid container spacing={3}>
        {systemMenuItems.map((item, index) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
            <Card
              sx={{
                height: '100%',
                cursor: item.implemented ? 'pointer' : 'default',
                opacity: item.implemented ? 1 : 0.6,
                '&:hover': {
                  transform: item.implemented ? 'translateY(-2px)' : 'none',
                  boxShadow: item.implemented ? 4 : 1,
                },
                transition: 'all 0.3s ease',
              }}
              onClick={() => handleMenuClick(item)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {item.icon}
                  <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                    {item.title}
                  </Typography>
                  {!item.implemented && (
                    <Typography variant="caption" color="text.secondary">
                      개발중
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </CardContent>
              {item.implemented && (
                <CardActions>
                  <Button
                    size="small"
                    endIcon={<ChevronRightIcon />}
                    onClick={() => handleMenuClick(item)}
                  >
                    이동
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          빠른 작업
        </Typography>
        <Card>
          <List>
            <ListItemButton
              onClick={() => navigate('/sms')}
              disabled={false}
            >
              <ListItemIcon>
                <SmsIcon />
              </ListItemIcon>
              <ListItemText
                primary="SMS 센터"
                secondary="SMS 발송 및 관리"
              />
              <ChevronRightIcon />
            </ListItemButton>
            <Divider />
            <ListItemButton disabled>
              <ListItemIcon>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText
                primary="사용자 관리"
                secondary="사용자 계정 및 권한 설정"
              />
              <Typography variant="caption" color="text.secondary">
                개발중
              </Typography>
            </ListItemButton>
            <Divider />
            <ListItemButton disabled>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary="시스템 설정"
                secondary="기본 환경 설정"
              />
              <Typography variant="caption" color="text.secondary">
                개발중
              </Typography>
            </ListItemButton>
          </List>
        </Card>
      </Box>
    </Box>
  );
};

export default SystemManagementPage;