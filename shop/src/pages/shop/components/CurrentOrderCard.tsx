/**
 * 파일 경로: /src/pages/shop/components/CurrentOrderCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 현재 주문 카드 (상세 버전 - 상태 표시, 취소 버튼)
 * 관련 데이터: saleOrders 컬렉션
 */

import React from 'react';
import { format } from 'date-fns';
import {
  Paper,
  Box,
  Typography,
  Chip,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import type { SaleOrder } from '../../../types/saleOrder';
import type { CutoffInfo } from '../../../types/cutoff';

interface CurrentOrderCardProps {
  order: SaleOrder;
  cutoffInfo: CutoffInfo | null;
  onCancel?: (order: SaleOrder) => void;
  onClick?: (order: SaleOrder) => void;
}

const CurrentOrderCard: React.FC<CurrentOrderCardProps> = ({
  order,
  cutoffInfo,
  onCancel,
  onClick,
}) => {
  /**
   * 주문 취소 가능 여부 판단
   * - 정규 주문 (orderPhase: 'regular'): openedAt ~ closedAt 전까지만 취소 가능
   * - 추가 주문 (orderPhase: 'additional'): placedAt ~ 다음날 00:00 전까지만 취소 가능
   */
  const canCancelOrder = (): { canCancel: boolean; reason?: string } => {
    // cancelled나 completed 상태는 취소 불가
    if (order.status === 'cancelled' || order.status === 'completed') {
      return { canCancel: false, reason: '이미 처리된 주문입니다.' };
    }

    const placedAt = order.placedAt.toDate();
    const now = new Date();

    // 정규 주문 (orderPhase: 'regular')
    if (order.orderPhase === 'regular') {
      // closedAt이 없으면 (아직 마감 전) 취소 가능
      if (!cutoffInfo?.closedAt) {
        return { canCancel: true };
      }

      const closedAt = cutoffInfo.closedAt;

      // placedAt이 closedAt 이전이면 취소 가능
      if (placedAt < closedAt) {
        return { canCancel: true };
      }

      // closedAt 이후에는 취소 불가
      return { canCancel: false, reason: '주문이 확정되어 취소할 수 없습니다!' };
    }

    // 추가 주문 (orderPhase: 'additional')
    if (order.orderPhase === 'additional') {
      // 다음날 00:00 계산
      const nextMidnight = new Date(placedAt);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      // 현재 시각이 다음날 00:00 이전이면 취소 가능
      if (now < nextMidnight) {
        return { canCancel: true };
      }

      // 다음날 00:00 이후에는 취소 불가
      return { canCancel: false, reason: '주문이 확정되어 취소할 수 없습니다!' };
    }

    // 기본값 (안전을 위해 취소 불가)
    return { canCancel: false, reason: '취소할 수 없는 주문입니다.' };
  };

  const { canCancel, reason } = canCancelOrder();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'placed':
        return '주문중';
      case 'confirmed':
        return '확정';
      case 'completed':
        return '완료';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): 'warning' | 'success' | 'default' | 'error' => {
    switch (status) {
      case 'placed':
        return 'warning';
      case 'confirmed':
        return 'success';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Paper
      elevation={1}
      onClick={() => onClick?.(order)}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          boxShadow: onClick ? 3 : 2,
        },
      }}
    >
      {/* 날짜 및 상태 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          📅 {format(order.placedAt.toDate(), 'yyyy-MM-dd HH:mm')}
        </Typography>
        <Chip
          label={getStatusLabel(order.status)}
          size="small"
          color={getStatusColor(order.status)}
        />
      </Box>

      {/* 주문번호 */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        📋 #{order.saleOrderNumber.slice(-8)}
      </Typography>

      {/* 상품명 */}
      <Typography variant="body1" sx={{ mb: 1 }}>
        {order.orderItems[0]?.productName}
        {order.orderItems.length > 1 && ` 외 ${order.orderItems.length - 1}개`}
      </Typography>

      {/* 금액 및 취소 버튼 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
          총 {order.itemCount}개 상품 / ₩{order.finalAmount.toLocaleString()}
        </Typography>
        {onCancel && (
          canCancel ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onCancel(order);
              }}
              sx={{
                minWidth: 'auto',
                px: 1.5,
                py: 0.5,
                fontSize: '0.75rem',
                textTransform: 'none',
              }}
            >
              취소
            </Button>
          ) : (
            <Tooltip title={reason || ''} arrow>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled
                  startIcon={<LockIcon />}
                  sx={{
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                  }}
                >
                  취소
                </Button>
              </span>
            </Tooltip>
          )
        )}
      </Box>

      {/* 취소 불가 안내 메시지 */}
      {!canCancel && reason && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockIcon sx={{ fontSize: '0.875rem' }} />
            {reason}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CurrentOrderCard;
