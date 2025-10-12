/**
 * 파일 경로: /src/components/orders/ProductOrderDetailDialog.tsx
 * 작성 날짜: 2025-10-06
 * 주요 내용: 상품별 주문 상세 팝업
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  CircularProgress,
  Alert,
  Typography,
  Box,
  Chip
} from '@mui/material';
import { format } from 'date-fns';
import orderAggregationService from '../../services/orderAggregationService';
import { formatCurrency } from '../../utils/formatUtils';

interface ProductOrderDetailDialogProps {
  open: boolean;
  productId: string | null;
  onClose: () => void;
}

const ProductOrderDetailDialog = ({
  open,
  productId,
  onClose
}: ProductOrderDetailDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    productName: string;
    specification: string;
    orders: Array<{
      customerName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      orderDate: Date;
      status: string;
    }>;
    totalQuantity: number;
    totalAmount: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await orderAggregationService.getProductOrderDetails(productId);
      setData(result);
    } catch (err) {
      console.error('Error loading product order details:', err);
      setError('상품 주문 상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open && productId) {
      loadData();
    }
  }, [open, productId, loadData]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '확정';
      case 'pended':
        return '검토대기';
      case 'completed':
        return '완료';
      case 'cancelled':
        return '취소';
      case 'rejected':
        return '거부';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): "default" | "primary" | "warning" | "success" | "error" => {
    switch (status) {
      case 'confirmed':
        return 'primary';
      case 'pended':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {data ? (
          <Box>
            <Typography variant="h6" component="div">
              {data.productName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              규격: {data.specification}
            </Typography>
          </Box>
        ) : (
          '상품 주문 상세'
        )}
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && data && (
          <>
            {data.orders.length === 0 ? (
              <Alert severity="info">
                주문 내역이 없습니다.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 600 }}>고객사</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>수량</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>단가</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>소계</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>주문일</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.orders.map((order, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell align="center">{order.quantity.toLocaleString('ko-KR')}</TableCell>
                        <TableCell align="right">{formatCurrency(order.unitPrice)}</TableCell>
                        <TableCell align="right">{formatCurrency(order.lineTotal)}</TableCell>
                        <TableCell align="center">
                          {format(order.orderDate, 'MM-dd HH:mm')}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getStatusLabel(order.status)}
                            size="small"
                            color={getStatusColor(order.status)}
                            variant={order.status === 'confirmed' ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 합계 행 */}
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>합계</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {data.totalQuantity.toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(data.totalAmount)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductOrderDetailDialog;
