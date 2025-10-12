/**
 * 파일 경로: /src/pages/shop/components/OrderDetailPanel.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 주문 상세 패널 컴포넌트 (읽기전용)
 * 관련 데이터: saleOrders 컬렉션
 */

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { SaleOrder, SaleOrderStatus } from '../../../types/saleOrder'; // Updated: 2025-09-28

interface OrderDetailPanelProps {
  order: SaleOrder;
}

const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({ order }) => {
  // 상태별 색상
  const getStatusColor = (status: SaleOrderStatus) => {
    const colors = {
      placed: 'warning',
      pended: 'warning',
      confirmed: 'info',
      completed: 'success',
      cancelled: 'error',
      rejected: 'error',
    } as const;
    return colors[status] || 'default';
  };

  // 상태별 텍스트
  const getStatusText = (status: SaleOrderStatus) => {
    const texts: Record<SaleOrderStatus, string> = {
      placed: '접수됨',
      pended: '대기중',
      confirmed: '확정됨',
      completed: '완료됨',
      cancelled: '취소됨',
      rejected: '거부됨',
    };
    return texts[status] || status;
  };

  // 상태별 아이콘
  const getStatusIcon = (status: SaleOrderStatus) => {
    const icons: Record<SaleOrderStatus, React.ReactElement> = {
      placed: <ScheduleIcon />,
      pended: <ScheduleIcon />,
      confirmed: <AssignmentIcon />,
      completed: <CheckCircleIcon />,
      cancelled: <CancelIcon />,
      rejected: <CancelIcon />,
    };
    return icons[status] || <ScheduleIcon />;
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
    return timestamp?.toDate().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: 350,
        height: 'calc(100vh - 16px)',
        m: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 8,
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon />
          <Typography variant="h6">주문 상세</Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
          {order.saleOrderNumber}
        </Typography>
      </Box>

      {/* 내용 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* 주문 상태 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            주문 상태
          </Typography>
          <Chip
            icon={getStatusIcon(order.status)}
            label={getStatusText(order.status)}
            color={getStatusColor(order.status)}
            sx={{ mb: 2 }}
          />

          {/* 상태별 날짜 정보 */}
          <Box sx={{ pl: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                주문일: {formatDate(order.placedAt)}
              </Typography>
            </Box>

            {order.confirmedAt && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">
                  확정일: {formatDate(order.confirmedAt)}
                </Typography>
              </Box>
            )}

            {order.completedAt && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">
                  완료일: {formatDate(order.completedAt)}
                </Typography>
              </Box>
            )}

            {order.cancelledAt && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">
                  취소일: {formatDate(order.cancelledAt)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* 주문 상품 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
            주문 상품
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>상품명</TableCell>
                  <TableCell align="center">수량</TableCell>
                  <TableCell align="right">금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.orderItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.specification}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {item.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ₩{item.lineTotal.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        @₩{item.unitPrice.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* 주문 요약 */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
            주문 요약
          </Typography>

          <List dense>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="body2">총 품목 수</Typography>
                <Typography variant="body2">{order.itemCount}개</Typography>
              </Box>
            </ListItem>

            <ListItem sx={{ px: 0, py: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  총 주문금액
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  ₩{order.finalAmount.toLocaleString()}
                </Typography>
              </Box>
            </ListItem>
          </List>
        </Box>

        {/* 매출전표 정보 (완료 상태일 때) */}
        {order.status === 'completed' && order.saleLedgerId && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                매출전표
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {order.saleLedgerId}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default OrderDetailPanel;