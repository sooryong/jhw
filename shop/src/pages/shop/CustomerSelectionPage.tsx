/**
 * 파일 경로: /src/pages/shop/CustomerSelectionPage.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 고객사 선택 페이지 (다중 고객사 지원)
 * 관련 데이터: users.customerBusinessNumbers, customers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Business as BusinessIcon,
  ArrowForward as ArrowForwardIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { customerService } from '../../services/customerService';
import { getOrderStatsByCustomers, type OrderStatsByCustomer } from '../../services/saleOrderService';
import type { Customer } from '../../types/company';

const CustomerSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, getAvailableCustomers, isSMSRecipientUser, getSMSRecipientInfo, logout } = useAuth();

  // 상태 관리
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<Record<string, OrderStatsByCustomer>>({});

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let validCustomers: Customer[] = [];
      let businessNumbers: string[] = [];

      // Admin/Staff: 모든 고객사 조회
      if (user?.role === 'admin' || user?.role === 'staff') {
        const allCustomers = await customerService.getCustomers({ isActive: true });
        validCustomers = allCustomers;
        businessNumbers = allCustomers.map(c => c.businessNumber);
      }
      // Customer: 연결된 고객사만 조회
      else {
        const availableBusinessNumbers = getAvailableCustomers();
        if (availableBusinessNumbers.length === 0) {
          setError('연결된 고객사가 없습니다. 관리자에게 문의하세요.');
          return;
        }

        // 단일 고객사인 경우 자동 선택 후 리다이렉트
        if (availableBusinessNumbers.length === 1) {
          const businessNumber = availableBusinessNumbers[0];
          navigate(`/shop?customer=${businessNumber}`, { replace: true });
          return;
        }

        // 연결된 고객사들의 상세 정보 조회
        const customerPromises = availableBusinessNumbers.map(businessNumber =>
          customerService.getCustomer(businessNumber)
        );

        const customerResults = await Promise.all(customerPromises);
        validCustomers = customerResults.filter(customer => customer !== null) as Customer[];
        businessNumbers = availableBusinessNumbers;
      }

      setCustomers(validCustomers);

      // 주문 통계 조회 (resetAt 이후 현재까지: 건수, 수량, 금액)
      const stats = await getOrderStatsByCustomers(businessNumbers);
      setOrderStats(stats);

    } catch (err) {
      console.error('고객사 목록 로드 실패:', err);
      setError('고객사 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.role, getAvailableCustomers, navigate]);

  // 데이터 로드
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSelectCustomer = (businessNumber: string) => {
    try {
      setSelecting(businessNumber);

      // URL 파라미터로 고객사 선택 후 쇼핑몰 메인으로 이동
      navigate(`/shop?customer=${businessNumber}`, { replace: true });

    } catch (error) {
      console.error('고객사 선택 실패:', error);
      setError('고객사 선택에 실패했습니다.');
    } finally {
      setSelecting(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('로그아웃 실패:', error);
      setError('로그아웃에 실패했습니다.');
    }
  };

  // 비로그인 사용자는 로그인 페이지로 리다이렉트
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // URL에서 현재 선택된 고객사 읽기
  const urlParams = new URLSearchParams(window.location.search);
  const currentSelected = urlParams.get('customer');

  return (
    <Container maxWidth={false} sx={{ width: '80%', py: { xs: 2, sm: 3 } }}>
      {/* 헤더 */}
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        {/* 상단: 제목 + 로그아웃 */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1
        }}>
          {/* 좌측: 아이콘 + 제목 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BusinessIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' } }}>
              고객사 선택
            </Typography>
          </Box>

          {/* 우측: 로그아웃 버튼 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              로그아웃
            </Typography>
            <IconButton onClick={handleLogout} color="error">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 하단: 설명문 (전체 너비) */}
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          {user.role === 'customer'
            ? `${user.name}님, 쇼핑몰을 이용할 고객사를 선택해주세요.`
            : `${user.name}님 (${user.role}), 대리 쇼핑할 고객사를 선택해주세요.`
          }
          {isSMSRecipientUser() && ` 📱 SMS 수신자로 등록된 고객사: ${getAvailableCustomers().length}개`}
        </Typography>
      </Box>
      {/* 현재 선택된 고객사 안내 */}
      {currentSelected && (
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 }, bgcolor: 'primary.50' }}>
          <Typography variant="body2" color="primary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            현재 선택된 고객사: {customers.find(c => c.businessNumber === currentSelected)?.businessName || currentSelected}
          </Typography>
        </Paper>
      )}
      {/* 고객사 카드 목록 */}
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {customers.map((customer) => {
          const businessNumber = customer.businessNumber;
          const isSelected = currentSelected === businessNumber;
          const isSelecting = selecting === businessNumber;

          // SMS 수신자 정보 확인
          const smsInfo = getSMSRecipientInfo();
          const recipientRole = smsInfo?.linkedCustomerNumbers.includes(businessNumber)
            ? smsInfo.recipientRole
            : null;

          return (
            <Grid key={customer.businessNumber} size={{ xs: 12 }}>
              <Card
                elevation={isSelected ? 8 : 2}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'stretch', md: 'center' },
                  border: 1,
                  borderColor: isSelected ? 'primary.main' : 'rgba(0, 0, 0, 0.12)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                  // 모바일 터치 최적화
                  '@media (hover: none)': {
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                  },
                }}
                onClick={() => !isSelecting && handleSelectCustomer(businessNumber)}
              >
                {/* 칼럼 1: 주담당자 배지 + 회사이름 */}
                <Box sx={{
                  flex: '0 0 auto',
                  width: { xs: '100%', md: '25%' },
                  p: { xs: 2, sm: 3 }
                }}>
                  {/* 배지 */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    {isSelected && (
                      <Chip
                        label="현재 선택됨"
                        color="primary"
                        size="small"
                      />
                    )}
                    {recipientRole && (
                      <Chip
                        label={recipientRole === 'person1' ? '주 담당자' : '부 담당자'}
                        color={recipientRole === 'person1' ? 'success' : 'info'}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* 회사이름 */}
                  <Typography variant="h6" component="h2" sx={{
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    fontWeight: 600
                  }}>
                    {customer.businessName}
                  </Typography>
                </Box>

                {/* 칼럼 2: 사업자번호, 대표자, 고객유형 */}
                <Box sx={{
                  flex: '0 0 auto',
                  width: { xs: '100%', md: '25%' },
                  p: { xs: 2, sm: 3 }
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    사업자번호: {customer.businessNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    대표자: {customer.president}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    고객 유형: {customer.customerType}
                  </Typography>
                </Box>

                {/* 칼럼 3: 즐겨찾기 상품, 주문 통계 */}
                <Box sx={{
                  flex: '0 0 auto',
                  width: { xs: '100%', md: '25%' },
                  p: { xs: 2, sm: 3 }
                }}>
                  <Typography variant="body2" color="primary" sx={{
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 600,
                    mb: 0.75
                  }}>
                    즐겨찾기 상품: {customer.favoriteProducts?.length || 0}개
                  </Typography>
                  <Typography variant="body2" color="secondary" sx={{
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 600,
                    mb: 0.75
                  }}>
                    주문 수량: {orderStats[businessNumber]?.orderCount || 0}건 {orderStats[businessNumber]?.totalQuantity || 0}개
                  </Typography>
                  <Typography variant="body2" color="secondary" sx={{
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 600
                  }}>
                    합계 금액: ₩{(orderStats[businessNumber]?.totalAmount || 0).toLocaleString()}
                  </Typography>
                </Box>

                {/* 칼럼 4: 쇼핑하기 버튼 */}
                <Box sx={{
                  flex: '0 0 auto',
                  width: { xs: '100%', md: '25%' },
                  p: { xs: 2, sm: 3 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Button
                    fullWidth
                    variant={isSelected ? "outlined" : "contained"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCustomer(businessNumber);
                    }}
                    disabled={isSelecting}
                    endIcon={isSelecting ? <CircularProgress size={20} /> : <ArrowForwardIcon />}
                    sx={{
                      minHeight: { xs: 44, sm: 48 },
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}
                  >
                    {isSelecting ? '쇼핑하는 중...' : isSelected ? '다시 쇼핑하기' : '쇼핑하기'}
                  </Button>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      {/* 안내 메시지 */}
      <Box mt={4}>
        <Alert severity="info">
          <Typography variant="body2">
            • 선택한 고객사의 즐겨찾기 상품과 주문 이력을 확인할 수 있습니다.<br/>
            • 언제든 쇼핑몰 상단에서 고객사를 변경할 수 있습니다.
          </Typography>
        </Alert>
      </Box>
    </Container>
  );
};

export default CustomerSelectionPage;