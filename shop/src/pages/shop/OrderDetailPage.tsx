/**
 * 파일 경로: /src/pages/shop/OrderDetailPage.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 주문 상세 페이지
 * 관련 데이터: saleOrders 컬렉션
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useCustomer } from '../../contexts/CustomerContext';
import type { SaleOrder } from '../../types/saleOrder';
import { getSaleOrderById } from '../../services/saleOrderService';
import OrderDetailPanel from './components/OrderDetailPanel';

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { customer } = useCustomer();

  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, customer]);

  const loadOrder = async () => {
    if (!orderId || !customer) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const customerId = customer.businessNumber; // 하이픈 포함 형식
      const orderData = await getSaleOrderById(customerId, orderId);

      setOrder(orderData);
    } catch (err) {
      console.error('주문 상세 로드 실패:', err);
      setError(err instanceof Error ? err.message : '주문 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    const customerParam = searchParams.get('customer');
    const targetPath = customerParam ? `/shop/orders?customer=${customerParam}` : '/shop/orders';
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
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">주문 정보를 찾을 수 없습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 상단 AppBar */}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            주문 상세
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 주문 상세 내용 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        py: 3,
        width: '100%'
      }}>
        <Box sx={{
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
          px: 2,
          '& > .MuiPaper-root': {
            m: 0,
            width: '100%',
            height: 'auto',
            position: 'static'
          }
        }}>
          <OrderDetailPanel order={order} />
        </Box>
      </Box>
    </Box>
  );
};

export default OrderDetailPage;
