/**
 * 파일 경로: /src/pages/shop/components/CompletedOrderCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 완료된 주문 카드 (간소화 버전 - 다시주문 버튼)
 * 관련 데이터: saleOrders 컬렉션
 */

import React from 'react';
import { format } from 'date-fns';
import {
  Paper,
  Box,
  Typography,
  Button,
} from '@mui/material';
import type { SaleOrder } from '../../../types/saleOrder';

interface CompletedOrderCardProps {
  order: SaleOrder;
  onReorder: (order: SaleOrder) => void;
  onClick?: (order: SaleOrder) => void;
  compact?: boolean;
}

const CompletedOrderCard: React.FC<CompletedOrderCardProps> = ({
  order,
  onReorder,
  onClick,
}) => {
  return (
    <Paper
      elevation={1}
      onClick={() => onClick?.(order)}
      sx={{
        p: 2,
        mb: 1,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          boxShadow: onClick ? 3 : 2,
        },
      }}
    >
      {/* 시간 및 주문번호 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          🕐 {format(order.placedAt.toDate(), 'HH:mm')} #{order.saleOrderNumber.slice(-6)}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            onReorder(order);
          }}
          sx={{
            minWidth: 'auto',
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
            textTransform: 'none',
          }}
        >
          다시주문
        </Button>
      </Box>

      {/* 상품명 */}
      <Typography variant="body1" sx={{ my: 1 }}>
        {order.orderItems[0]?.productName}
        {order.orderItems.length > 1 && ` 외 ${order.orderItems.length - 1}개`}
      </Typography>

      {/* 금액 */}
      <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
        ₩{order.finalAmount.toLocaleString()}
      </Typography>
    </Paper>
  );
};

export default CompletedOrderCard;
