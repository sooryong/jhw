/**
 * 파일 경로: /src/pages/dashboard/DashboardPage.tsx
 * 작성 날짜: 2025-10-08
 * 주요 내용: 대시보드 - 매출주문 집계 및 상품 집계 통계 패널
 * 관련 데이터: saleOrders, products, dailyOrderCycles
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Dashboard as DashboardIcon,
  ShoppingCart as ShoppingCartIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import orderAggregationService from '../../services/orderAggregationService';
import dailyOrderCycleService from '../../services/dailyOrderCycleService';
import type { OrderAggregationData } from '../../types/orderAggregation';
import type { SaleOrder } from '../../types/saleOrder';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [aggregationData, setAggregationData] = useState<OrderAggregationData | null>(null);

  // 현재 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60초

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // resetAt 기준으로 매출주문 조회
      const cycleStatus = await dailyOrderCycleService.getStatus();
      const orders = await orderAggregationService.getActiveOrdersFromTime(cycleStatus.resetAt);
      setSaleOrders(orders);

      // 상품 집계 데이터 조회
      const data = await orderAggregationService.getActiveOrderAggregationData();
      setAggregationData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    // 최소 500ms 로딩 표시
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  // 매출주문 집계 통계 계산
  const getSaleOrderStats = () => {
    const regularOrders = saleOrders.filter(o => o.orderPhase === 'regular');
    const additionalOrders = saleOrders.filter(o => o.orderPhase === 'additional');
    const rejectedOrders = saleOrders.filter(o => o.status === 'rejected' || o.status === 'pended');

    const regularAmount = regularOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const additionalAmount = additionalOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const rejectedAmount = rejectedOrders.reduce((sum, o) => sum + o.finalAmount, 0);

    return {
      total: {
        count: saleOrders.length,
        amount: regularAmount + additionalAmount
      },
      regular: {
        count: regularOrders.length,
        amount: regularAmount
      },
      additional: {
        count: additionalOrders.length,
        amount: additionalAmount
      },
      rejected: {
        count: rejectedOrders.length,
        amount: rejectedAmount
      }
    };
  };

  // 상품 집계 통계 계산
  const getProductAggregationStats = () => {
    if (!aggregationData) {
      return {
        total: { quantity: 0, amount: 0 },
        dailyFood: { quantity: 0, amount: 0 },
        frozenFood: { quantity: 0, amount: 0 },
        dryGoods: { quantity: 0, amount: 0 }
      };
    }

    const categories = ['일일식품', '냉동식품', '공산품'];
    const categoryStats = categories.map(categoryName => {
      const catData = aggregationData.categories[categoryName];
      if (!catData) return { category: categoryName, quantity: 0, amount: 0 };

      const quantity = catData.suppliers.reduce(
        (sum, supplier) => sum + supplier.totalPlacedQuantity + supplier.totalConfirmedQuantity,
        0
      );
      const amount = (catData.placedAmount || 0) + (catData.confirmedAmount || 0);

      return { category: categoryName, quantity, amount };
    });

    const totalQuantity = categoryStats.reduce((sum, cat) => sum + cat.quantity, 0);
    const totalAmount = categoryStats.reduce((sum, cat) => sum + cat.amount, 0);

    return {
      total: { quantity: totalQuantity, amount: totalAmount },
      dailyFood: categoryStats[0],
      frozenFood: categoryStats[1],
      dryGoods: categoryStats[2]
    };
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DashboardIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 600,
                      cursor: 'pointer',
                      '&:hover': {
                        color: 'primary.main'
                      }
                    }}
                    onClick={handleRefresh}
                  >
                    대시보드
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5.5 }}>
                  {format(currentTime, 'yyyy년 MM월 dd일 HH:mm')}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                {refreshing ? <CircularProgress size={16} /> : '새로고침'}
              </Button>
            </Box>
          </Box>

          {/* 로딩 */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {/* 에러 */}
          {error && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {/* 대시보드 패널 */}
          {!loading && !error && (
            <>
              {/* 매출주문 집계 패널 */}
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <ShoppingCartIcon sx={{ mr: 1, color: 'primary.main', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    매출주문 집계
                  </Typography>
                </Box>

                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    {/* 합계 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          bgcolor: 'rgba(5, 150, 105, 0.1)',
                          border: 1,
                          borderColor: 'primary.main',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          합계
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', my: 0.5 }}>
                          {getSaleOrderStats().total.count}건
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {getSaleOrderStats().total.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 정규 매출주문 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          정규 매출주문
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'info.main', my: 0.5 }}>
                          {getSaleOrderStats().regular.count}건
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getSaleOrderStats().regular.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 추가 매출주문 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          추가 매출주문
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.main', my: 0.5 }}>
                          {getSaleOrderStats().additional.count}건
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getSaleOrderStats().additional.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 거절/보류 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          거절/보류
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'error.main', my: 0.5 }}>
                          {getSaleOrderStats().rejected.count}건
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getSaleOrderStats().rejected.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>

              {/* 매출주문 상품 집계 패널 */}
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <CategoryIcon sx={{ mr: 1, color: 'primary.main', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    매출주문 상품 집계
                  </Typography>
                </Box>

                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    {/* 합계 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          bgcolor: 'rgba(5, 150, 105, 0.1)',
                          border: 1,
                          borderColor: 'primary.main',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          합계
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', my: 0.5 }}>
                          {getProductAggregationStats().total.quantity.toLocaleString('ko-KR')}개
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {getProductAggregationStats().total.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 일일식품 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          일일식품
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, my: 0.5 }}>
                          {getProductAggregationStats().dailyFood.quantity.toLocaleString('ko-KR')}개
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getProductAggregationStats().dailyFood.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 냉동식품 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          냉동식품
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, my: 0.5 }}>
                          {getProductAggregationStats().frozenFood.quantity.toLocaleString('ko-KR')}개
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getProductAggregationStats().frozenFood.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>

                    {/* 공산품 */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          공산품
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, my: 0.5 }}>
                          {getProductAggregationStats().dryGoods.quantity.toLocaleString('ko-KR')}개
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getProductAggregationStats().dryGoods.amount.toLocaleString('ko-KR')}원
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default DashboardPage;
