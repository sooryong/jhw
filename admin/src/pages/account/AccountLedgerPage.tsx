/**
 * 파일 경로: /src/pages/account/AccountLedgerPage.tsx
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래처원장 페이지 (고객사/공급사 통합)
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Grid,
  Divider,
  Autocomplete,
  Chip
} from '@mui/material';
import {
  AccountBalance as CashIcon,
  Print as PrintIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { generateCustomerAccountLedger, generateSupplierAccountLedger } from '../../services/accountLedgerService';
import { getSuppliers } from '../../services/supplierService';
import { getCustomers } from '../../services/customerService';
import type { CustomerAccountLedger, SupplierAccountLedger } from '../../types/accountLedger';
import type { Supplier, Customer } from '../../types/company';
import { formatCurrency } from '../../utils/formatUtils';

type LedgerType = 'customer' | 'supplier';

const AccountLedgerPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택 옵션
  const [ledgerType, setLedgerType] = useState<LedgerType>('customer');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 데이터
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerLedger, setCustomerLedger] = useState<CustomerAccountLedger | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<SupplierAccountLedger | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [suppliersData, customersData] = await Promise.all([
        getSuppliers({ isActive: true }),
        getCustomers({ isActive: true })
      ]);
      setSuppliers(suppliersData);
      setCustomers(customersData);
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError('시작일과 종료일을 선택해주세요.');
      return;
    }

    if (ledgerType === 'supplier' && !selectedSupplierId) {
      setError('공급사를 선택해주세요.');
      return;
    }

    if (ledgerType === 'customer' && !selectedCustomerId) {
      setError('고객사를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setCustomerLedger(null);
    setSupplierLedger(null);

    try {
      if (ledgerType === 'supplier') {
        const ledger = await generateSupplierAccountLedger({
          supplierId: selectedSupplierId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          generatedBy: user?.uid || '',
          generatedByName: user?.name
        });
        setSupplierLedger(ledger);
      } else {
        const ledger = await generateCustomerAccountLedger({
          customerId: selectedCustomerId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          generatedBy: user?.uid || '',
          generatedByName: user?.name
        });
        setCustomerLedger(ledger);
      }
    } catch (err:unknown) {
      console.error('Error generating account ledger:', err);
      setError(err.message || '거래처원장 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentLedger = ledgerType === 'customer' ? customerLedger : supplierLedger;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="no-print">
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CashIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              거래처원장
            </Typography>
            <Typography variant="body2" color="text.secondary">
              고객사/공급사 대금 입출금 내역 및 잔액 조회
            </Typography>
          </div>
        </Box>
      </Box>

      {/* 조건 설정 */}
      <Paper sx={{ p: 3, mb: 3 }} className="no-print">
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="원장 유형"
              value={ledgerType}
              onChange={(e) => setLedgerType(e.target.value as LedgerType)}
            >
              <MenuItem value="customer">고객사 거래처원장</MenuItem>
              <MenuItem value="supplier">공급사 거래처원장</MenuItem>
            </TextField>
          </Grid>

          {ledgerType === 'supplier' && (
            <Grid item xs={12} md={3}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(option) => option.businessName}
                value={suppliers.find(s => s.businessNumber === selectedSupplierId) || null}
                onChange={(_, newValue) => {
                  setSelectedSupplierId(newValue?.businessNumber || '');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="공급사 선택" />
                )}
              />
            </Grid>
          )}

          {ledgerType === 'customer' && (
            <Grid item xs={12} md={3}>
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.businessName}
                value={customers.find(c => c.businessNumber === selectedCustomerId) || null}
                onChange={(_, newValue) => {
                  setSelectedCustomerId(newValue?.businessNumber || '');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="고객사 선택" />
                )}
              />
            </Grid>
          )}

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="시작일"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="종료일"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              sx={{ height: '56px' }}
            >
              {loading ? <CircularProgress size={24} /> : '생성'}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* 원장 출력 영역 */}
      {currentLedger && (
        <>
          <Box className="no-print" sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              인쇄
            </Button>
          </Box>

          <Paper sx={{ p: 4 }} id="print-area">
            {/* 원장 헤더 */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" gutterBottom>
                {ledgerType === 'customer' ? '고객사' : '공급사'} 거래처원장
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(currentLedger.periodStart, 'yyyy년 MM월 dd일')} ~ {format(currentLedger.periodEnd, 'yyyy년 MM월 dd일')}
              </Typography>
            </Box>

            {/* 거래처 정보 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {ledgerType === 'customer' ? '고객사' : '공급사'} 정보
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    상호명
                  </Typography>
                  <Typography variant="body1">
                    {ledgerType === 'customer'
                      ? (currentLedger as CustomerAccountLedger).customerName
                      : (currentLedger as SupplierAccountLedger).supplierName
                    }
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    사업자번호
                  </Typography>
                  <Typography variant="body1">
                    {ledgerType === 'customer'
                      ? (currentLedger as CustomerAccountLedger).customerBusinessNumber
                      : (currentLedger as SupplierAccountLedger).supplierBusinessNumber
                    }
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* 요약 정보 */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    기초 잔액
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(currentLedger.openingBalance)}
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    {ledgerType === 'customer' ? '매출액' : '매입액'}
                  </Typography>
                  <Typography variant="h6" color="error">
                    <TrendingUpIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatCurrency(
                      ledgerType === 'customer'
                        ? (currentLedger as CustomerAccountLedger).totalSales
                        : (currentLedger as SupplierAccountLedger).totalPurchases
                    )}
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    {ledgerType === 'customer' ? '수금액' : '지급액'}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    <TrendingDownIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatCurrency(
                      ledgerType === 'customer'
                        ? (currentLedger as CustomerAccountLedger).totalPayments
                        : (currentLedger as SupplierAccountLedger).totalPayouts
                    )}
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    기말 잔액
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(currentLedger.closingBalance)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* 입출금 내역 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                입출금 내역
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>일자</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell>참조번호</TableCell>
                      <TableCell>적요</TableCell>
                      <TableCell align="right">차변</TableCell>
                      <TableCell align="right">대변</TableCell>
                      <TableCell align="right">잔액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentLedger.entries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{format(entry.date.toDate(), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.transactionType === 'sale' || entry.transactionType === 'purchase' ? '거래' : '입금'}
                            size="small"
                            color={entry.transactionType === 'sale' || entry.transactionType === 'purchase' ? 'error' : 'primary'}
                          />
                        </TableCell>
                        <TableCell>{entry.referenceNumber}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell align="right">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(entry.balance)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 푸터 */}
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider', textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                발행일: {format(currentLedger.generatedAt, 'yyyy년 MM월 dd일')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                발행자: {currentLedger.generatedByName || currentLedger.generatedBy}
              </Typography>
            </Box>
          </Paper>
        </>
      )}

      {!currentLedger && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            조건을 선택하고 '생성' 버튼을 클릭하여 거래처원장을 생성하세요.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default AccountLedgerPage;
