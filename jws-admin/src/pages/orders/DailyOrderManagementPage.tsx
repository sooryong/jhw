/**
 * 파일 경로: /src/pages/orders/DailyOrderManagementPage.tsx
 * 작성 날짜: 2025-10-10
 * 업데이트: v1.4 - 3-패널 통합 워크플로우
 * 주요 내용: 일일주문 확정 대시보드 - 3개 패널 레이아웃
 *   - Panel 1: 정규 매출주문 집계 + 정규 주문 마감
 *   - Panel 2: 일일식품 집계 (매출주문 + 매입주문)
 *   - Panel 3: 일일주문 종합 (추가 주문 + 합계 + 일일주문 마감)
 * 관련 데이터: saleOrders, products, suppliers, purchaseOrders, dailyOrderCycles
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Assignment as AssignmentIcon,
  ErrorOutline as ErrorOutlineIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import dailySaleOrderFlowService from '../../services/dailySaleOrderFlowService';
import dailySaleOrderAggregationService from '../../services/dailySaleOrderAggregationService';
import purchaseOrderService from '../../services/purchaseOrderService';
import productService from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';

const DailyOrderManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // 집계 데이터
  const [totalOrders, setTotalOrders] = useState({ count: 0, products: 0, amount: 0 });
  const [regularOrders, setRegularOrders] = useState({ count: 0, products: 0, amount: 0 });
  const [additionalOrders, setAdditionalOrders] = useState({ count: 0, products: 0, amount: 0 });
  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState(0);

  // 일일식품 집계 데이터
  const [dailyFoodStats, setDailyFoodStats] = useState({ products: 0, saleAmount: 0, purchaseOrders: 0, purchaseAmount: 0, confirmedCount: 0 });

  // 마감 상태
  const [isClosed, setIsClosed] = useState(false);
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [closedAt, setClosedAt] = useState<Date | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // Panel 2, 3 마감 상태 (일일주문 마감 활성화 조건)
  const [isPurchaseOrdersClosed, setIsPurchaseOrdersClosed] = useState(false);
  const [isAdditionalOrdersClosed, setIsAdditionalOrdersClosed] = useState(false);

  // 스낵바
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // 현재 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. 흐름 상태 조회
      const flowStatus = await dailySaleOrderFlowService.getStatus();
      setIsClosed(flowStatus.isConfirmed);
      setResetAt(flowStatus.resetAt);
      setClosedAt(flowStatus.lastConfirmedAt);

      // 2. 매출주문 집계
      const aggregationData = await dailySaleOrderAggregationService.getActiveOrderAggregationData();

      // 정규 주문
      const regular = {
        count: aggregationData.total.regular.count,
        products: Object.keys(aggregationData.categories).reduce((sum, cat) => {
          const regularProducts = aggregationData.categories[cat].suppliers
            .flatMap(sup => sup.products)
            .filter(p => p.placedQuantity > 0);
          return sum + regularProducts.length;
        }, 0),
        amount: aggregationData.total.regular.amount
      };
      setRegularOrders(regular);

      // 추가 주문
      const additional = {
        count: aggregationData.total.additional.count,
        products: Object.keys(aggregationData.categories).reduce((sum, cat) => {
          const additionalProducts = aggregationData.categories[cat].suppliers
            .flatMap(sup => sup.products)
            .filter(p => p.confirmedQuantity > 0);
          return sum + additionalProducts.length;
        }, 0),
        amount: aggregationData.total.additional.amount
      };
      setAdditionalOrders(additional);

      // 전체 집계 (정규 + 추가)
      const total = {
        count: regular.count + additional.count,
        products: regular.products + additional.products,
        amount: regular.amount + additional.amount
      };
      setTotalOrders(total);

      // 3. 일일식품 카테고리 집계 (정규 매출주문)
      const dailyFoodCategory = aggregationData.categories['일일식품'];
      if (dailyFoodCategory) {
        // 매출주문 집계
        const products = dailyFoodCategory.suppliers.reduce((sum, sup) =>
          sum + sup.products.filter(p => p.placedQuantity > 0).length, 0
        );
        const saleAmount = dailyFoodCategory.suppliers.reduce((sum, sup) =>
          sum + sup.products.reduce((pSum, p) => pSum + p.placedAmount, 0), 0
        );
        const purchaseOrdersCount = dailyFoodCategory.suppliers.length;

        // 매입주문 금액 및 확정 건수 계산 (실제 매입주문 데이터 조회)
        let purchaseAmount = 0;
        let confirmedCount = 0;
        try {
          // resetAt 이후의 일일식품 매입주문 조회
          const purchaseOrdersList = await purchaseOrderService.getPurchaseOrders({
            category: '일일식품',
            startDate: flowStatus.resetAt || undefined
          });

          // 각 매입주문의 금액 계산 및 확정 건수 계산
          for (const order of purchaseOrdersList) {
            // 확정 건수 카운트
            if (order.status === 'confirmed') {
              confirmedCount++;
            }

            // 금액 계산
            for (const item of order.orderItems || []) {
              try {
                const product = await productService.getProduct(item.productId);
                if (product && product.purchasePrice) {
                  purchaseAmount += product.purchasePrice * item.quantity;
                }
              } catch (error) {
                console.error(`상품 ${item.productId} 정보 조회 실패:`, error);
              }
            }
          }
        } catch (error) {
          console.error('매입주문 금액 계산 실패:', error);
        }

        const dailyFood = {
          products,
          saleAmount,
          purchaseOrders: purchaseOrdersCount,
          purchaseAmount,
          confirmedCount
        };
        setDailyFoodStats(dailyFood);
      } else {
        setDailyFoodStats({ products: 0, saleAmount: 0, purchaseOrders: 0, purchaseAmount: 0, confirmedCount: 0 });
      }

      // 4. 전체 매입주문 건수 집계 (모든 카테고리의 공급사 수 합계)
      const totalPO = Object.keys(aggregationData.categories).reduce((sum, cat) => {
        return sum + aggregationData.categories[cat].suppliers.length;
      }, 0);
      setTotalPurchaseOrders(totalPO);

    } catch (error) {
      console.error('Error loading data:', error);
      showSnackbar('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCloseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur(); // 버튼 포커스 제거
    setCloseDialogOpen(true);
  };

  const handleCloseDialogClose = () => {
    setCloseDialogOpen(false);
  };

  const handleCloseConfirm = async () => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    setCloseDialogOpen(false);

    try {
      // 정규 매출주문 마감
      await dailySaleOrderFlowService.confirm(user.uid, user.name || '관리자');

      // 데이터 새로고침
      await loadData();

      showSnackbar('정규 매출주문이 마감되었습니다.', 'success');
    } catch (error) {
      console.error('Error closing:', error);
      showSnackbar('마감 처리 중 오류가 발생했습니다.', 'error');
    }
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
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AssignmentIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' }
                  }}
                  onClick={handleRefresh}
                >
                  일일주문 확정
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? <CircularProgress size={16} /> : '새로고침'}
              </Button>
            </Box>
          </Box>

          {/* 4-Panel Time-based Workflow */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            {/* Panel 1: 정규 매출주문 (Regular Sales Orders) */}
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                {/* Left 2/3: Statistics Table */}
                <Grid size={{ xs: 12, md: 8 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: !isClosed ? 'primary.main' : 'grey.300',
                      bgcolor: !isClosed ? 'background.paper' : 'grey.50',
                      opacity: !isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        {/* Header Row */}
                        <Grid container spacing={0} sx={{ mb: 0.5 }}>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">

                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                주문 건수
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                상품 수량
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                금액
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Data Row: 정규 매출주문 */}
                        <Grid container spacing={0}>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: '0 0 0 4px' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                정규 매출주문
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: !isClosed ? 'primary.main' : 'text.secondary' }}>
                                {regularOrders.count}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: !isClosed ? 'primary.main' : 'text.secondary' }}>
                                {regularOrders.products}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: '0 0 4px 0' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: !isClosed ? 'primary.main' : 'text.secondary' }}>
                                {regularOrders.amount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* 네비게이션 버튼 */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          disabled={isClosed}
                          onClick={() => navigate('/orders/customer-orders')}
                          endIcon={<ArrowForwardIcon />}
                          sx={{ flex: 1 }}
                        >
                          매출주문 확정
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          disabled={isClosed}
                          onClick={() => navigate('/orders/product-aggregation')}
                          endIcon={<ArrowForwardIcon />}
                          sx={{ flex: 1 }}
                        >
                          매출주문 상품 집계
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Right 1/3: Status Card */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: !isClosed ? 'primary.main' : 'grey.300',
                      bgcolor: !isClosed ? 'background.paper' : 'grey.50',
                      opacity: !isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 1, px: 2 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        {/* 시작일시 헤더 - 좌 카드의 헤더 라인과 높이 맞춤 */}
                        <Box sx={{ mb: 0.5 }}>
                          <Box sx={{ p: 1 }}>
                            {!isClosed ? (
                              <>
                                {resetAt && (
                                  <Typography variant="caption" color="text.secondary">
                                    시작: {resetAt.toLocaleString('ko-KR', {
                                      month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit', hour12: false
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </Typography>
                                )}
                              </>
                            ) : (
                              <>
                                {resetAt && (
                                  <Typography variant="caption" color="text.secondary">
                                    시작: {resetAt.toLocaleString('ko-KR', {
                                      month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit', hour12: false
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        </Box>

                        {/* 상태 표시 - 데이터 라인과 높이 맞춤 */}
                        <Box>
                          <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' }}>
                            {!isClosed ? (
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                정규 주문 접수 중
                              </Typography>
                            ) : (
                              <>
                                {closedAt && (
                                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                    마감: {closedAt.toLocaleString('ko-KR', {
                                      month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit', hour12: false
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* 마감 버튼 */}
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          color={!isClosed ? "primary" : "inherit"}
                          size="large"
                          fullWidth
                          onClick={handleCloseClick}
                          disabled={isClosed}
                          sx={{ minHeight: '48px' }}
                        >
                          정규 매출주문 마감
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Panel 2: 일일식품 주문 집계 */}
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                {/* Left Card: 일일식품 매출주문 집계 */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: isClosed ? 'info.main' : 'grey.300',
                      bgcolor: isClosed ? 'background.paper' : 'grey.50',
                      opacity: isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 2 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          mb: 1,
                          color: isClosed ? 'info.main' : 'text.secondary'
                        }}
                      >
                        일일식품 매출주문 집계
                      </Typography>

                      <Grid container spacing={1}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                              상품 수량
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: isClosed ? 'info.main' : 'text.secondary' }}>
                              {dailyFoodStats.products}개
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                              매출 금액
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: isClosed ? 'info.main' : 'text.secondary' }}>
                              {dailyFoodStats.saleAmount.toLocaleString()}원
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Right Card: 일일식품 매입주문 집계 */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: isClosed ? 'info.main' : 'grey.300',
                      bgcolor: isClosed ? 'background.paper' : 'grey.50',
                      opacity: isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            mb: 1,
                            color: isClosed ? 'info.main' : 'text.secondary'
                          }}
                        >
                          일일식품 매입주문 집계
                        </Typography>

                        <Grid container spacing={1}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                주문 건수
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: isClosed ? 'info.main' : 'text.secondary' }}>
                                {dailyFoodStats.purchaseOrders}건
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                매입 금액
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: isClosed ? 'info.main' : 'text.secondary' }}>
                                {dailyFoodStats.purchaseAmount.toLocaleString()}원
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                확정 건수
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: isClosed ? 'info.main' : 'text.secondary' }}>
                                {dailyFoodStats.confirmedCount}/{dailyFoodStats.purchaseOrders}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* 네비게이션 버튼 */}
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          disabled={!isClosed}
                          onClick={() => navigate('/orders/daily-food-purchase-orders')}
                          endIcon={<ArrowForwardIcon />}
                          fullWidth
                          sx={{
                            color: isClosed ? 'info.main' : 'text.disabled'
                          }}
                        >
                          일일식품 매입주문 확정
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Panel 3: 일일주문 종합 */}
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                {/* Left 2/3: Statistics Table */}
                <Grid size={{ xs: 12, md: 8 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: isClosed ? 'primary.main' : 'grey.300',
                      bgcolor: isClosed ? 'background.paper' : 'grey.50',
                      opacity: isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        {/* Header Row */}
                        <Grid container spacing={0} sx={{ mb: 0.5 }}>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">

                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                주문 건수
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                상품 수량
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                금액
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Data Row 1: 추가 매출주문 */}
                        <Grid container spacing={0} sx={{ mb: 0.5 }}>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                추가 매출주문
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {additionalOrders.count}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {additionalOrders.products}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {additionalOrders.amount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Data Row 2: 합계 매출주문 */}
                        <Grid container spacing={0}>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: isClosed ? 'rgba(25, 118, 210, 0.04)' : 'grey.100', borderRadius: '0 0 0 4px' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                합계 매출주문
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: isClosed ? 'rgba(25, 118, 210, 0.04)' : 'grey.100' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {totalOrders.count}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: isClosed ? 'rgba(25, 118, 210, 0.04)' : 'grey.100' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {totalOrders.products}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={3}>
                            <Box sx={{ p: 1, bgcolor: isClosed ? 'rgba(25, 118, 210, 0.04)' : 'grey.100', borderRadius: '0 0 4px 0' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isClosed ? 'primary.main' : 'text.secondary' }}>
                                {totalOrders.amount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* 네비게이션 버튼 */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          disabled={!isClosed}
                          onClick={() => navigate('/orders/customer-orders')}
                          endIcon={<ArrowForwardIcon />}
                          sx={{ flex: 1 }}
                        >
                          매출주문 확정
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          disabled={!isClosed}
                          onClick={() => navigate('/orders/product-aggregation')}
                          endIcon={<ArrowForwardIcon />}
                          sx={{ flex: 1 }}
                        >
                          매출주문 상품 집계
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Right 1/3: Status & Control Card */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: 4,
                      borderColor: isClosed ? 'primary.main' : 'grey.300',
                      bgcolor: isClosed ? 'background.paper' : 'grey.50',
                      opacity: isClosed ? 1 : 0.6
                    }}
                  >
                    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 1, px: 2 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        {/* 시작일시 헤더 - 좌 카드의 헤더 라인과 높이 맞춤 */}
                        <Box sx={{ mb: 0.5 }}>
                          <Box sx={{ p: 1 }}>
                            {isClosed ? (
                              <>
                                {closedAt && (
                                  <Typography variant="caption" color="text.secondary">
                                    시작: {closedAt.toLocaleString('ko-KR', {
                                      month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit', hour12: false
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </Typography>
                                )}
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {/* 빈 공간 유지 */}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* 상태 표시 영역 - 2개 데이터 라인과 높이 맞춤 */}
                        <Box>
                          <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '91px' }}>
                            {isClosed ? (
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                추가 주문 접수 중
                              </Typography>
                            ) : (
                              <>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                                  대기 중
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  정규 주문 마감 후 활성화됩니다
                                </Typography>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* 일일주문 마감 버튼 영역 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                          (개발용)
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          size="large"
                          onClick={async () => {
                            try {
                              await dailySaleOrderFlowService.reset();
                              setIsPurchaseOrdersClosed(false);
                              setIsAdditionalOrdersClosed(false);
                              await loadData();
                              showSnackbar('업무가 리셋되었습니다. 새로운 정규 주문 접수를 시작합니다.', 'success');
                            } catch (error) {
                              console.error('Error resetting:', error);
                              showSnackbar('리셋 처리 중 오류가 발생했습니다.', 'error');
                            }
                          }}
                          disabled={!isClosed}
                          sx={{ width: '50%', minHeight: '48px' }}
                        >
                          일일주문 마감
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* 정규 매출주문 마감 다이얼로그 */}
      <Dialog
        open={closeDialogOpen}
        onClose={handleCloseDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <ErrorOutlineIcon fontSize="large" color="error" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            정규 매출주문 마감
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚠️ 이 작업은 되돌릴 수 없습니다!
            </Typography>
          </Alert>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 정규 매출주문(placed)이 모두 마감(confirmed)으로 변경됩니다.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 이후 주문은 추가 매출주문으로 분류됩니다.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 추가 매출주문은 자동으로 confirmed 상태로 생성됩니다.
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              정규 매출주문을 마감하시겠습니까?
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogClose} variant="outlined" size="large">
            취소
          </Button>
          <Button
            onClick={handleCloseConfirm}
            variant="contained"
            color="error"
            size="large"
            autoFocus
          >
            마감 진행
          </Button>
        </DialogActions>
      </Dialog>

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

export default DailyOrderManagementPage;
