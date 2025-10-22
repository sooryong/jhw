/**
 * 파일 경로: /src/pages/orders/SaleOrderStatusPage.tsx
 * 작성 날짜: 2025-10-18
 * 주요 내용: 매출주문 접수 대시보드
 *   - Panel 1: 전체 매출주문 통계
 *   - Panel 2: 상품별 집계 통계
 * 관련 데이터: saleOrders
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Alert,
  Snackbar,
  IconButton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import saleOrderAggregationService from '../../services/saleOrderAggregationService';
import type {} from '../../types/saleOrder';
import type { ProductAggregation, SupplierAggregation } from '../../types/orderAggregation';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';

const SaleOrderStatusPage = () => {
  const navigate = useNavigate();
  const { orders, orderStats, cutoffInfo, loading: contextLoading, refreshData } = useSaleOrderContext();
  const [loading, setLoading] = useState(false);

  // 집계 데이터 (카테고리별, 상태별 로컬에서 관리)
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, number>>({});
  const [statusCounts, setStatusCounts] = useState({ placed: 0, confirmed: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // 스낵바
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // orders가 변경될 때마다 카테고리별 집계 계산
  useEffect(() => {
    calculateCategoryStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // 접수된 데이터 확인 및 메시지 표시
  useEffect(() => {
    if (!contextLoading && orders.length === 0 && cutoffInfo.openedAt) {
      showSnackbar('접수된 매출주문이 없습니다.', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextLoading]);

  // 현재 시간 실시간 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // 1초마다 갱신

    return () => clearInterval(timer);
  }, []);

  const calculateCategoryStats = async () => {
    if (orders.length === 0) {
      setCategoryAmounts({});
      setStatusCounts({ placed: 0, confirmed: 0 });
      return;
    }

    setLoading(true);
    try {
      // 상태별 건수 계산
      const placedCount = orders.filter(order => order.status === 'placed').length;
      const confirmedCount = orders.filter(order => order.status === 'confirmed').length;
      setStatusCounts({ placed: placedCount, confirmed: confirmedCount });

      // confirmed 상태만 상품 집계에 포함
      const confirmedOrders = orders.filter(order => order.status === 'confirmed');

      // 카테고리별 집계 수행
      const categories = await saleOrderAggregationService.aggregateByCategory(confirmedOrders);

      const aggregationData = {
        categories,
        orders,
        total: { regular: { count: 0, amount: 0 }, additional: { count: 0, amount: 0 }, pended: { count: 0, amount: 0 }, rejected: { count: 0, amount: 0 } },
        date: new Date()
      };

      // 카테고리별 금액 계산
      const categoryAmountsMap: Record<string, number> = {};

      Object.keys(aggregationData.categories).forEach(category => {
        const categoryData = aggregationData.categories[category];
        let categoryTotalAmount = 0;

        categoryData.suppliers.forEach((supplier: SupplierAggregation) => {
          supplier.products.forEach((product: ProductAggregation) => {
            const totalProductAmount = product.totalAmount;
            categoryTotalAmount += totalProductAmount;
          });
        });

        if (categoryTotalAmount > 0) {
          categoryAmountsMap[category] = categoryTotalAmount;
        }
      });

      setCategoryAmounts(categoryAmountsMap);

    } catch (error) {
      console.error('Error calculating category stats:', error);
      showSnackbar('카테고리별 집계 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    refreshData();
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8f9fa'
          }}
        >
          {/* 헤더 */}
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' }
                  }}
                  onClick={handleRefresh}
                >
                  매출주문 접수 현황
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 집계 시간 정보 패널 - 상단으로 이동 */}
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2
            }}>
              {/* 카드 1: 접수 시작 시간 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      접수 시작:
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {cutoffInfo.openedAt
                        ? cutoffInfo.openedAt.toLocaleString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })
                        : '-'}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 2: 현재 시간 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      현재 시간:
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                      {currentTime.toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 3: 상태 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60,
                    '&:last-child': { pb: 2 }
                  }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: cutoffInfo.status === 'open' ? 'info.main' : 'warning.main'
                      }}
                    >
                      {cutoffInfo.status === 'open' ? '일일식품 집계 중 ...' : '일일식품 집계 마감'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => navigate('/orders/daily-food-cutoff-settings')}
                      sx={{
                        p: 0.5,
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.light',
                          color: 'primary.dark'
                        }
                      }}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* 2-Card Layout */}
          <Box sx={{ px: 3, pb: 2, flexGrow: 1 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              {/* 좌카드: 매출주문 통계 */}
              <Box sx={{ flex: 1 }}>
                <Card
                  sx={{
                    borderLeft: 4,
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        color: 'primary.main'
                      }}
                    >
                      매출주문 접수 현황
                    </Typography>

                    {/* 통계 항목 */}
                    <Box sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: 2
                    }}>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          주문 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {orderStats.count.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          접수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {statusCounts.placed.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          확정
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {statusCounts.confirmed.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          상품 종류
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {orderStats.productTypes.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          상품 수량
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {orderStats.products.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          금액
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {orderStats.amount.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IconButton
                          size="small"
                          onClick={() => navigate('/orders/sale-order-management')}
                          sx={{
                            p: 1.5,
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'primary.light',
                              color: 'primary.dark'
                            }
                          }}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* 우카드: 카테고리별 집계 */}
              <Box sx={{ flex: 1 }}>
                <Card
                  sx={{
                    borderLeft: 4,
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        color: 'primary.main'
                      }}
                    >
                      매출주문 상품 집계
                    </Typography>

                    {/* 카테고리별 금액 */}
                    <Box sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: 2
                    }}>
                      {Object.keys(categoryAmounts).length > 0 ? (
                        <>
                          {Object.keys(categoryAmounts).map((category) => (
                            <Box
                              key={category}
                              sx={{
                                flex: 1,
                                p: 1.5,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {category}
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {categoryAmounts[category].toLocaleString()}
                              </Typography>
                            </Box>
                          ))}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IconButton
                              size="small"
                              onClick={() => navigate('/orders/sale-aggregation')}
                              sx={{
                                p: 1.5,
                                color: 'primary.main',
                                '&:hover': {
                                  bgcolor: 'primary.light',
                                  color: 'primary.dark'
                                }
                              }}
                            >
                              <ArrowForwardIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          카테고리별 집계 데이터가 없습니다.
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Snackbar 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SaleOrderStatusPage;
