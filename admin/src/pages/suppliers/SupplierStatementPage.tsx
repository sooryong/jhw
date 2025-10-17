/**
 * 파일 경로: /src/pages/suppliers/SupplierStatementPage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 거래명세서 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  TextField,
  CircularProgress,
  IconButton,
  Autocomplete,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Description as DescriptionIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getSuppliers } from '../../services/supplierService';
import { generateStatement } from '../../services/supplierStatementService';
import type { Supplier } from '../../types/company';
import type { SupplierStatement } from '../../types/supplierStatement';

const SupplierStatementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // 이번 달 1일
    return date.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data.filter(s => s.isActive));
    } catch (error) {
      // Error handled silently
      console.error('공급사 로드 실패:', error);
      setError('공급사 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleGenerate = async () => {
    if (!selectedSupplier) {
      setError('공급사를 선택해주세요.');
      return;
    }

    if (!user) {
      setError('사용자 정보를 확인할 수 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateStatement(
        selectedSupplier.businessNumber,
        new Date(startDate),
        new Date(endDate),
        user.uid
      );

      setStatement(result);
    } catch (error: unknown) {
      console.error('거래명세서 생성 실패:', error);
      setError(error.message || '거래명세서 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }} className="no-print">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => navigate(-1)}>
                <ArrowBackIcon />
              </IconButton>
              <DescriptionIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                거래명세서
              </Typography>
            </Box>
          </Box>

          {/* 검색 폼 */}
          <Box sx={{ p: 2 }} className="no-print">
            <Paper sx={{ p: 3 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <Autocomplete
                  sx={{ flex: 2 }}
                  options={suppliers}
                  getOptionLabel={(option) => `${option.businessName} (${option.businessNumber})`}
                  value={selectedSupplier}
                  onChange={(_, newValue) => setSelectedSupplier(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="공급사" required />
                  )}
                  disabled={loading}
                />

                <TextField
                  sx={{ flex: 1 }}
                  label="시작일"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={loading}
                />

                <TextField
                  sx={{ flex: 1 }}
                  label="종료일"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={loading}
                />

                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
                >
                  {loading ? '생성 중...' : '명세서 생성'}
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* 거래명세서 */}
          {statement && (
            <Box sx={{ p: 2 }}>
              <Paper sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }} className="no-print">
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    거래명세서
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                  >
                    인쇄
                  </Button>
                </Box>

                {/* 명세서 헤더 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {statement.supplierName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    기간: {new Date(statement.periodStart).toLocaleDateString('ko-KR')} ~ {new Date(statement.periodEnd).toLocaleDateString('ko-KR')}
                  </Typography>
                </Box>

                {/* 잔액 요약 */}
                <TableContainer sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>이월 미지급금</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>당기 매입액</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>당기 지급액</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>현재 미지급금</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell align="right">{statement.previousBalance.toLocaleString()}원</TableCell>
                        <TableCell align="right">{statement.currentPurchaseAmount.toLocaleString()}원</TableCell>
                        <TableCell align="right">{statement.currentPaymentAmount.toLocaleString()}원</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {statement.currentBalance.toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Divider sx={{ my: 3 }} />

                {/* 매입 내역 */}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  매입 내역
                </Typography>
                <TableContainer sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell>매입원장번호</TableCell>
                        <TableCell align="center">입고일</TableCell>
                        <TableCell>내용</TableCell>
                        <TableCell align="right">금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statement.purchaseLedgers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            매입 내역이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        statement.purchaseLedgers.map((ledger, index) => (
                          <TableRow key={index}>
                            <TableCell>{ledger.purchaseLedgerNumber}</TableCell>
                            <TableCell align="center">
                              {ledger.receivedAt.toDate().toLocaleDateString('ko-KR')}
                            </TableCell>
                            <TableCell>
                              {ledger.ledgerItems.map(item => item.productName).join(', ')}
                            </TableCell>
                            <TableCell align="right">{ledger.totalAmount.toLocaleString()}원</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 지급 내역 */}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  지급 내역
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell>지급번호</TableCell>
                        <TableCell align="center">지급일</TableCell>
                        <TableCell align="center">지급수단</TableCell>
                        <TableCell align="right">금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statement.payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            지급 내역이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        statement.payments.map((payment, index) => (
                          <TableRow key={index}>
                            <TableCell>{payment.paymentNumber}</TableCell>
                            <TableCell align="center">
                              {payment.paymentDate.toDate().toLocaleDateString('ko-KR')}
                            </TableCell>
                            <TableCell align="center">{payment.paymentMethod}</TableCell>
                            <TableCell align="right">{payment.paymentAmount.toLocaleString()}원</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </Box>
      </Container>

      {/* 인쇄 스타일 */}
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default SupplierStatementPage;
