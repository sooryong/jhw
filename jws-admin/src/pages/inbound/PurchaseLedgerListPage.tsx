/**
 * 파일 경로: /src/pages/inbound/PurchaseLedgerListPage.tsx
 * 작성 날짜: 2025-10-06
 * 주요 내용: 매입 원장 목록 페이지
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  Description as LedgerIcon,
} from '@mui/icons-material';
import { getAllPurchaseLedgers } from '../../services/purchaseLedgerService';
import type { PurchaseLedger } from '../../types/purchaseLedger';
import { formatCurrency } from '../../utils/formatUtils';
import { format } from 'date-fns';

const PurchaseLedgerListPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<PurchaseLedger[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllPurchaseLedgers();
      setLedgers(data);
    } catch (err) {
      console.error('Error loading purchase ledgers:', err);
      setError('매입 원장을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const totalLedgers = ledgers.length;
  const totalAmount = ledgers.reduce((sum, ledger) => sum + ledger.totalAmount, 0);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LedgerIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              매입 원장
            </Typography>
            <Typography variant="body2" color="text.secondary">
              완료된 입고 내역 및 원장 조회
            </Typography>
          </div>
        </Box>
        <Button
          variant="outlined"
          onClick={loadData}
          size="small"
        >
          새로고침
        </Button>
      </Box>

      {/* 통계 */}
      {!loading && !error && ledgers.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                총 원장 수
              </Typography>
              <Typography variant="h6">
                {totalLedgers}건
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                총 매입 금액
              </Typography>
              <Typography variant="h6">
                {formatCurrency(totalAmount)}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 로딩 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 에러 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 데이터 없음 */}
      {!loading && !error && ledgers.length === 0 && (
        <Alert severity="info">
          매입 원장이 없습니다.
        </Alert>
      )}

      {/* 원장 목록 */}
      {!loading && !error && ledgers.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>원장번호</TableCell>
                <TableCell>매입주문번호</TableCell>
                <TableCell>공급사</TableCell>
                <TableCell align="right">품목 수</TableCell>
                <TableCell align="right">매입 금액</TableCell>
                <TableCell>입고일시</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledgers.map((ledger) => (
                <TableRow key={ledger.purchaseLedgerId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {ledger.purchaseLedgerId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {ledger.purchaseOrderNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{ledger.supplierInfo.businessName}</TableCell>
                  <TableCell align="right">{ledger.itemCount}건</TableCell>
                  <TableCell align="right">
                    {formatCurrency(ledger.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {format(ledger.receivedAt.toDate(), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default PurchaseLedgerListPage;
