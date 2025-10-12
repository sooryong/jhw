/**
 * 파일 경로: /src/components/sms/BalanceGuidePanel.tsx
 * 주요 내용: SMS 잔액 및 가이드 패널 - 잔액 정보와 간단한 안내
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Grid
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
  MonetizationOn as MoneyIcon
} from '@mui/icons-material';

interface BalanceInfo {
  point?: number;
  cash?: number;
  balance?: number;
  currency?: string;
  lastUpdated?: Date;
}

interface Stats {
  today: { total: number; success: number; failed: number };
  month: { total: number; success: number; failed: number };
  total: { all: number; success: number; failed: number };
}

interface BalanceGuidePanelProps {
  balance: BalanceInfo | null;
  stats: Stats;
  balanceLoading: boolean;
  onRefreshBalance: () => void;
}

const BalanceGuidePanel: React.FC<BalanceGuidePanelProps> = ({
  balance,
  stats,
  balanceLoading,
  onRefreshBalance
}) => {
  // 성공률 계산
  const getSuccessRate = () => {
    if (stats.total.all === 0) return 0;
    return Math.round((stats.total.success / stats.total.all) * 100);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <BalanceIcon sx={{ mr: 1, color: 'success.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            SMS 정보
          </Typography>
          <IconButton
            size="small"
            onClick={onRefreshBalance}
            disabled={balanceLoading}
            title="수동 새로고침"
          >
            {balanceLoading ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        </Box>

        {/* 3칼럼 수평 배치 - 내용에 맞는 높이로 통일 */}
        <Grid container spacing={2}>
          {/* SMS 잔액 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <MoneyIcon sx={{ mr: 0.5, color: 'success.main', fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  SMS 잔액
                </Typography>
              </Box>

              {balanceLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : balance ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', mb: 0.5 }}>
                    잔액: {balance.balance?.toLocaleString() || 0}원
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    포인트: {balance.point?.toLocaleString() || 0}P
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {balance.lastUpdated ? new Date(balance.lastUpdated).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    }) : '방금 전'}
                  </Typography>
                </Box>
              ) : (
                <Alert severity="error" sx={{ py: 1, fontSize: '0.75rem' }}>
                  잔액 정보 불러오기 실패
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* SMS 요금 안내 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <InfoIcon sx={{ mr: 0.5, fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  SMS 요금 안내
                </Typography>
              </Box>

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  SMS (90바이트) 1P (12원)
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  LMS (2000바이트) 4P (48원)
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  MMS (MMS) 15P (180원)
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* SMS 통계 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <TrendingUpIcon sx={{ mr: 0.5, fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  SMS 통계
                </Typography>
              </Box>

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  총 발송: {stats.total.all.toLocaleString()}건
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  오늘 발송: {stats.today.total.toLocaleString()}건
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  성공률: {getSuccessRate()}%
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

      </CardContent>
    </Card>
  );
};

export default BalanceGuidePanel;