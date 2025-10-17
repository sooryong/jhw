/**
 * 파일 경로: /src/pages/dashboard/DashboardPage.tsx
 * 작성 날짜: 2025-10-08
 * 주요 내용: 대시보드 - 매출주문 집계 및 상품 집계 통계 패널
 * 관련 데이터: saleOrders, products, dailyOrderCycles
 */

import { useState, useEffect } from 'react';
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
  Category as CategoryIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import orderAggregationService from '../../services/orderAggregationService';
import dailyOrderCycleService from '../../services/dailyOrderCycleService';
import purchaseOrderService from '../../services/purchaseOrderService';
import productService from '../../services/productService';
import type { OrderAggregationData } from '../../types/orderAggregation';
import type { SaleOrder } from '../../types/saleOrder';
import type { PurchaseOrder } from '../../types/purchaseOrder';

const DashboardPage = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [aggregationData, setAggregationData] = useState<OrderAggregationData | null>(null);
  const [dailyFoodPurchaseOrders, setDailyFoodPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dailyFoodPurchaseAmount, setDailyFoodPurchaseAmount] = useState<number>(0);

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

      // 일일식품 매입주문 조회 및 금액 계산
      const purchaseOrdersList = await purchaseOrderService.getPurchaseOrders({
        category: '일일식품',
        startDate: cycleStatus.resetAt || undefined
      });
      setDailyFoodPurchaseOrders(purchaseOrdersList);

      // 매입금액 계산
      let purchaseAmount = 0;
      for (const order of purchaseOrdersList) {
        for (const item of order.orderItems || []) {
          try {
            const product = await productService.getProduct(item.productId);
            if (product && product.purchasePrice) {
              purchaseAmount += product.purchasePrice * item.quantity;
            }
          } catch (error) {
      // Error handled silently
            console.error(`상품 ${item.productId} 정보 조회 실패:`, error);
          }
        }
      }
      setDailyFoodPurchaseAmount(purchaseAmount);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Firestore 실시간 리스너 설정
    let unsubscribeSaleOrders: (() => void) | null = null;
    let unsubscribePurchaseOrders: (() => void) | null = null;

    const setupListeners = async () => {
      const status = await dailyOrderCycleService.getStatus();
      const resetAt = status.resetAt || new Date(new Date().setHours(0, 0, 0, 0));

      // 매출주문 리스너
      const saleOrdersQuery = query(
        collection(db, 'saleOrders'),
        where('placedAt', '>=', Timestamp.fromDate(resetAt))
      );

      unsubscribeSaleOrders = onSnapshot(saleOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadData();
        }
      });

      // 매입주문 리스너
      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('placedAt', '>=', Timestamp.fromDate(resetAt)),
        where('category', '==', '일일식품')
      );

      unsubscribePurchaseOrders = onSnapshot(purchaseOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadData();
        }
      });
    };

    setupListeners();

    return () => {
      if (unsubscribeSaleOrders) {
        unsubscribeSaleOrders();
      }
      if (unsubscribePurchaseOrders) {
        unsubscribePurchaseOrders();
      }
    };
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

  // 일일식품 매입주문 집계 통계 계산
  const getDailyFoodPurchaseOrderStats = () => {
    const orderCount = dailyFoodPurchaseOrders.length;

    // 상품 종류 수 계산 (중복 제거)
    const uniqueProducts = new Set<string>();
    dailyFoodPurchaseOrders.forEach(order => {
      order.orderItems.forEach(item => {
        uniqueProducts.add(item.productId);
      });
    });
    const productTypes = uniqueProducts.size;

    // 상품 수량 합계 계산
    const totalQuantity = dailyFoodPurchaseOrders.reduce((sum, order) => {
      return sum + order.orderItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    return {
      orderCount,
      productTypes,
      totalQuantity,
      amount: dailyFoodPurchaseAmount
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
                    <Grid size={{ xs: 12, md: 3.3 }}>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(5, 150, 105, 0.1)',
                          border: 1,
                          borderColor: 'primary.main',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          합계
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getSaleOrderStats().total.count}건
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getSaleOrderStats().total.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 정규 매출주문 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          정규 매출주문
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600, color: 'info.main' }}>
                            {getSaleOrderStats().regular.count}건
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getSaleOrderStats().regular.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 추가 매출주문 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          추가 매출주문
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.main' }}>
                            {getSaleOrderStats().additional.count}건
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getSaleOrderStats().additional.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 거절/보류 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          거절/보류
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600, color: 'error.main' }}>
                            {getSaleOrderStats().rejected.count}건
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getSaleOrderStats().rejected.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
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
                    <Grid size={{ xs: 12, md: 3.3 }}>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(5, 150, 105, 0.1)',
                          border: 1,
                          borderColor: 'primary.main',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          합계
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getProductAggregationStats().total.quantity.toLocaleString('ko-KR')}개
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getProductAggregationStats().total.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 일일식품 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          일일식품
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().dailyFood.quantity.toLocaleString('ko-KR')}개
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().dailyFood.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 냉동식품 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          냉동식품
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().frozenFood.quantity.toLocaleString('ko-KR')}개
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().frozenFood.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 공산품 */}
                    <Grid size={{ xs: 12, md: 2.9 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          공산품
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().dryGoods.quantity.toLocaleString('ko-KR')}개
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getProductAggregationStats().dryGoods.amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>

              {/* 일일식품 매입주문 집계 패널 */}
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <LocalShippingIcon sx={{ mr: 1, color: 'primary.main', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    일일식품 매입주문 집계
                  </Typography>
                </Box>

                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    {/* 합계 카드 */}
                    <Grid size={{ xs: 12, md: 3.3 }}>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(5, 150, 105, 0.1)',
                          border: 1,
                          borderColor: 'primary.main',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          합계
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getDailyFoodPurchaseOrderStats().orderCount}건
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {getDailyFoodPurchaseOrderStats().amount.toLocaleString('ko-KR')}원
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 상품 종류 */}
                    <Grid size={{ xs: 12, md: 4.35 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          상품 종류
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getDailyFoodPurchaseOrderStats().productTypes}종
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* 상품 수량 */}
                    <Grid size={{ xs: 12, md: 4.35 }}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          상품 수량
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {getDailyFoodPurchaseOrderStats().totalQuantity.toLocaleString('ko-KR')}개
                          </Typography>
                        </Box>
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
