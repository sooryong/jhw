/**
 * 파일 경로: /src/pages/shop/OrderHistoryPage.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 주문 내역 페이지 (모바일 최적화 - 날짜별 그룹핑)
 * 관련 데이터: saleOrders 컬렉션
 * 업데이트: 3개 탭 (현재주문/완료주문/전체), 날짜별 그룹핑
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Chip,
} from '@mui/material';
import { useCustomer } from '../../contexts/CustomerContext';
import { useCart } from '../../contexts/CartContext';
import type { SaleOrder } from '../../types/saleOrder';
import { getSaleOrderHistory, cancelSaleOrder } from '../../services/saleOrderService';
import { dailyOrderCycleService } from '../../services/dailyOrderCycleService';
import type { OrderCycleResult } from '../../types/dailyOrderCycle';
import CompletedOrderCard from './components/CompletedOrderCard';
import CurrentOrderCard from './components/CurrentOrderCard';

type TabValue = 'current' | 'completed' | 'all';

interface GroupedOrders {
  [month: string]: {
    [day: string]: SaleOrder[];
  };
}

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { customer } = useCustomer();
  const { addToCart } = useCart();

  const [activeTab, setActiveTab] = useState<TabValue>('current');
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleStatus, setCycleStatus] = useState<OrderCycleResult | null>(null);

  // 데이터 로드
  useEffect(() => {
    if (customer) {
      loadOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const loadOrders = async () => {
    if (!customer) return;

    try {
      setLoading(true);
      setError(null);

      const customerId = customer.businessNumber; // 하이픈 포함 형식

      // 병렬 실행: 주문 내역 + 사이클 상태 조회
      const [orderHistoryResult, status] = await Promise.all([
        getSaleOrderHistory(customerId, {
          limit: 1000, // 모든 주문 가져오기
        }),
        dailyOrderCycleService.getStatus()
      ]);

      // 이미 placedAt desc로 정렬되어 반환됨
      setOrders(orderHistoryResult.orders);
      setCycleStatus(status);
    } catch (err) {
      console.error('주문 내역 로드 실패:', err);
      setError(err instanceof Error ? err.message : '주문 내역을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 탭별 필터링
  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'current':
        return orders.filter(order =>
          order.status === 'placed' || order.status === 'confirmed'
        );
      case 'completed':
        return orders.filter(order => order.status === 'completed');
      case 'all':
        return orders;
      default:
        return orders;
    }
  }, [orders, activeTab]);

  // 현재주문 개수
  const currentOrdersCount = useMemo(() =>
    orders.filter(order => order.status === 'placed' || order.status === 'confirmed').length,
    [orders]
  );

  // 완료주문 개수
  const completedOrdersCount = useMemo(() =>
    orders.filter(order => order.status === 'completed').length,
    [orders]
  );

  // 날짜별 그룹핑 (완료주문용)
  const groupedOrders = useMemo((): GroupedOrders => {
    const grouped: GroupedOrders = {};

    filteredOrders.forEach(order => {
      const date = order.placedAt.toDate();
      const month = format(date, 'yyyy-MM');
      const day = format(date, 'yyyy-MM-dd');

      if (!grouped[month]) grouped[month] = {};
      if (!grouped[month][day]) grouped[month][day] = [];

      grouped[month][day].push(order);
    });

    return grouped;
  }, [filteredOrders]);

  // 다시주문 핸들러
  const handleReorder = async (order: SaleOrder) => {
    try {
      // 주문의 모든 상품을 장바구니에 추가
      for (const item of order.orderItems) {
        await addToCart(item.productId, item.quantity);
      }
      alert(`${order.orderItems.length}개 상품을 장바구니에 담았습니다.`);
    } catch (error) {
      console.error('다시주문 실패:', error);
      alert('다시주문에 실패했습니다.');
    }
  };

  // 주문 취소 핸들러
  const handleCancelOrder = async (order: SaleOrder) => {
    if (!customer) return;

    if (!confirm('주문을 취소하시겠습니까?\n취소된 주문은 복구할 수 없습니다.')) return;

    try {
      const customerId = customer.businessNumber; // 하이픈 포함 형식
      await cancelSaleOrder(order.saleOrderNumber, customerId);

      alert('주문이 취소되었습니다.');

      // 주문 목록 새로고침
      await loadOrders();
    } catch (error) {
      console.error('주문 취소 실패:', error);
      alert(error instanceof Error ? error.message : '주문 취소에 실패했습니다.');
    }
  };

  // 주문 클릭 핸들러
  const handleOrderClick = (order: SaleOrder) => {
    const customerParam = searchParams.get('customer');
    const targetPath = customerParam ? `/shop/orders/${order.saleOrderNumber}?customer=${customerParam}` : `/shop/orders/${order.saleOrderNumber}`;
    navigate(targetPath);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pb: { xs: 2, md: 0 } }}>
      {/* 상단 고정 영역 */}
      <Paper
        elevation={2}
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 0 },
          zIndex: 100,
          borderRadius: 0,
        }}
      >
        {/* 헤더 */}
        <Box sx={{ p: 2, pb: 0 }}>
          <Typography variant="h6">주문 내역</Typography>
        </Box>

        {/* 탭 */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue as TabValue)}
          variant="fullWidth"
          sx={{
            px: 1,
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 600,
            },
          }}
        >
          <Tab
            value="current"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                현재주문
                {currentOrdersCount > 0 && (
                  <Chip
                    size="small"
                    label={currentOrdersCount}
                    color="primary"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            }
          />
          <Tab
            value="completed"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                완료주문
                {completedOrdersCount > 0 && (
                  <Chip
                    size="small"
                    label={completedOrdersCount}
                    color="default"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            }
          />
          <Tab value="all" label="전체" />
        </Tabs>
      </Paper>

      {/* 주문 리스트 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Container maxWidth="lg" sx={{ py: 2 }}>
          {filteredOrders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                📦
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                주문 내역이 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary">
                즐겨찾기 상품을 장바구니에 담아 주문해보세요!
              </Typography>
            </Box>
          ) : (
            <Box>
              {activeTab === 'completed' ? (
                // 완료주문: 날짜별 그룹핑
                Object.entries(groupedOrders)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([month, days]) => (
                    <Box key={month} sx={{ mb: 4 }}>
                      {/* 월별 헤더 */}
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                        📅 {format(new Date(month + '-01'), 'yyyy년 M월', { locale: ko })} (
                        {Object.values(days).reduce((sum, dayOrders) => sum + dayOrders.length, 0)}건)
                      </Typography>

                      {/* 일별 주문들 */}
                      {Object.entries(days)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([day, dayOrders]) => (
                          <Box key={day} sx={{ mb: 3 }}>
                            {/* 일별 헤더 */}
                            <Typography
                              variant="subtitle1"
                              sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}
                            >
                              {format(new Date(day), 'M월 d일 (E)', { locale: ko })}
                            </Typography>

                            {/* 완료 주문 카드들 */}
                            {dayOrders.map(order => (
                              <CompletedOrderCard
                                key={order.saleOrderNumber}
                                order={order}
                                onReorder={handleReorder}
                                onClick={handleOrderClick}
                              />
                            ))}
                          </Box>
                        ))}
                    </Box>
                  ))
              ) : (
                // 현재주문 & 전체: 시간순 리스트
                filteredOrders.map(order => (
                  <CurrentOrderCard
                    key={order.saleOrderNumber}
                    order={order}
                    cycleStatus={cycleStatus}
                    onCancel={handleCancelOrder}
                    onClick={handleOrderClick}
                  />
                ))
              )}
            </Box>
          )}
        </Container>
      </Box>

    </Box>
  );
};

export default OrderHistoryPage;
