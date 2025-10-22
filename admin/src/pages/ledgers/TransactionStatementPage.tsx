/**
 * 파일 경로: /src/pages/ledgers/TransactionStatementPage.tsx
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래명세서 출력 페이지 (개별 원장 출력용)
 */

import { useState, useEffect, useCallback } from 'react';
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
  Autocomplete
} from '@mui/material';
import {
  Description as StatementIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { generatePurchaseStatement, generateSaleStatement } from '../../services/transactionStatementService';
import { getAllPurchaseLedgers } from '../../services/purchaseLedgerService';
import { getAllSaleLedgers } from '../../services/saleLedgerService';
import type { PurchaseTransactionStatement, SaleTransactionStatement } from '../../types/transactionStatement';
import type { PurchaseLedger } from '../../types/purchaseLedger';
import type { SaleLedger } from '../../types/saleLedger';
import { formatCurrency } from '../../utils/formatUtils';

type StatementType = 'purchase' | 'sale';

const TransactionStatementPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택 옵션
  const [statementType, setStatementType] = useState<StatementType>('sale');
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');

  // 데이터
  const [purchaseLedgers, setPurchaseLedgers] = useState<PurchaseLedger[]>([]);
  const [saleLedgers, setSaleLedgers] = useState<SaleLedger[]>([]);
  const [purchaseStatement, setPurchaseStatement] = useState<PurchaseTransactionStatement | null>(null);
  const [saleStatement, setSaleStatement] = useState<SaleTransactionStatement | null>(null);

  const loadLedgers = useCallback(async () => {
    setLoadingLedgers(true);
    try {
      if (statementType === 'purchase') {
        const ledgers = await getAllPurchaseLedgers();
        setPurchaseLedgers(ledgers);
      } else {
        const ledgers = await getAllSaleLedgers();
        setSaleLedgers(ledgers);
      }
    } catch (err) {
      console.error('Error loading ledgers:', err);
      setError('원장 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingLedgers(false);
    }
  }, [statementType]);

  useEffect(() => {
    loadLedgers();
  }, [loadLedgers]);

  const handleGenerate = async () => {
    if (!selectedLedgerId) {
      setError('원장을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseStatement(null);
    setSaleStatement(null);

    try {
      if (statementType === 'purchase') {
        const statement = await generatePurchaseStatement({
          purchaseLedgerId: selectedLedgerId,
          generatedBy: user?.uid || '',
          generatedByName: user?.name
        });
        setPurchaseStatement(statement);
      } else {
        const statement = await generateSaleStatement({
          saleLedgerId: selectedLedgerId,
          generatedBy: user?.uid || '',
          generatedByName: user?.name
        });
        setSaleStatement(statement);
      }
    } catch (err:unknown) {
      console.error('Error generating statement:', err);
      setError(err.message || '거래명세서 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentStatement = statementType === 'purchase' ? purchaseStatement : saleStatement;
  const currentLedgers = statementType === 'purchase' ? purchaseLedgers : saleLedgers;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="no-print">
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <StatementIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              거래명세서 출력
            </Typography>
            <Typography variant="body2" color="text.secondary">
              개별 원장 상세 내역 출력 (고객사/공급사 송부용)
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
              label="명세서 유형"
              value={statementType}
              onChange={(e) => {
                setStatementType(e.target.value as StatementType);
                setSelectedLedgerId('');
                setPurchaseStatement(null);
                setSaleStatement(null);
              }}
            >
              <MenuItem value="sale">매출 거래명세서</MenuItem>
              <MenuItem value="purchase">매입 거래명세서</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={7}>
            <Autocomplete
              options={currentLedgers}
              loading={loadingLedgers}
              getOptionLabel={(option) => {
                if (statementType === 'purchase') {
                  const ledger = option as PurchaseLedger;
                  return `${ledger.purchaseLedgerNumber} - ${ledger.supplierInfo.businessName} (${format(ledger.receivedAt.toDate(), 'yyyy-MM-dd')})`;
                } else {
                  const ledger = option as SaleLedger;
                  return `${ledger.saleLedgerNumber} - ${ledger.customerInfo.businessName} (${format(ledger.shippedAt.toDate(), 'yyyy-MM-dd')})`;
                }
              }}
              value={currentLedgers.find(l => {
                if (statementType === 'purchase') {
                  return (l as PurchaseLedger).purchaseLedgerNumber === selectedLedgerId;
                } else {
                  return (l as SaleLedger).saleLedgerNumber === selectedLedgerId;
                }
              }) || null}
              onChange={(_, newValue) => {
                if (newValue) {
                  if (statementType === 'purchase') {
                    setSelectedLedgerId((newValue as PurchaseLedger).purchaseLedgerNumber);
                  } else {
                    setSelectedLedgerId((newValue as SaleLedger).saleLedgerNumber);
                  }
                } else {
                  setSelectedLedgerId('');
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={statementType === 'purchase' ? '매입 원장 선택' : '매출 원장 선택'}
                  placeholder="원장번호로 검색..."
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleGenerate}
              disabled={loading || !selectedLedgerId}
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

      {/* 명세서 출력 영역 */}
      {currentStatement && (
        <>
          <Box className="no-print" sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              인쇄
            </Button>
          </Box>

          <Paper sx={{ p: 4 }} id="print-area">
            {/* 명세서 헤더 */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" gutterBottom>
                {statementType === 'purchase' ? '매입' : '매출'} 거래명세서
              </Typography>
              <Typography variant="body2" color="text.secondary">
                원장번호: {statementType === 'purchase'
                  ? (currentStatement as PurchaseTransactionStatement).purchaseLedger.purchaseLedgerNumber
                  : (currentStatement as SaleTransactionStatement).saleLedger.saleLedgerNumber
                }
              </Typography>
            </Box>

            {/* 거래처 정보 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {statementType === 'purchase' ? '공급사 정보' : '고객사 정보'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    상호명
                  </Typography>
                  <Typography variant="body1">
                    {statementType === 'purchase'
                      ? (currentStatement as PurchaseTransactionStatement).supplierName
                      : (currentStatement as SaleTransactionStatement).customerName
                    }
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    사업자번호
                  </Typography>
                  <Typography variant="body1">
                    {statementType === 'purchase'
                      ? (currentStatement as PurchaseTransactionStatement).supplierBusinessNumber
                      : (currentStatement as SaleTransactionStatement).customerBusinessNumber
                    }
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* 원장 요약 정보 */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    {statementType === 'purchase' ? '입고일자' : '출하일자'}
                  </Typography>
                  <Typography variant="h6">
                    {format(
                      statementType === 'purchase'
                        ? (currentStatement as PurchaseTransactionStatement).purchaseLedger.receivedAt.toDate()
                        : (currentStatement as SaleTransactionStatement).saleLedger.shippedAt.toDate(),
                      'yyyy-MM-dd'
                    )}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    총 품목 수
                  </Typography>
                  <Typography variant="h6">
                    {statementType === 'purchase'
                      ? (currentStatement as PurchaseTransactionStatement).purchaseLedger.itemCount
                      : (currentStatement as SaleTransactionStatement).saleLedger.itemCount
                    }건
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    총 금액
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(
                      statementType === 'purchase'
                        ? (currentStatement as PurchaseTransactionStatement).purchaseLedger.totalAmount
                        : (currentStatement as SaleTransactionStatement).saleLedger.totalAmount
                    )}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* 품목 상세 내역 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                품목 상세 내역
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>상품코드</TableCell>
                      <TableCell>상품명</TableCell>
                      <TableCell>규격</TableCell>
                      <TableCell>카테고리</TableCell>
                      <TableCell align="right">수량</TableCell>
                      <TableCell align="right">단가</TableCell>
                      <TableCell align="right">금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statementType === 'purchase' &&
                      (currentStatement as PurchaseTransactionStatement).purchaseLedger.ledgerItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.productCode}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.specification || '-'}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.lineTotal)}</TableCell>
                        </TableRow>
                      ))
                    }
                    {statementType === 'sale' &&
                      (currentStatement as SaleTransactionStatement).saleLedger.ledgerItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.productCode}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.specification || '-'}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.lineTotal)}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 비고 */}
            {((statementType === 'purchase' && (currentStatement as PurchaseTransactionStatement).purchaseLedger.notes) ||
              (statementType === 'sale' && (currentStatement as SaleTransactionStatement).saleLedger.notes)) && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  비고
                </Typography>
                <Typography variant="body1">
                  {statementType === 'purchase'
                    ? (currentStatement as PurchaseTransactionStatement).purchaseLedger.notes
                    : (currentStatement as SaleTransactionStatement).saleLedger.notes
                  }
                </Typography>
              </Box>
            )}

            {/* 푸터 */}
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider', textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                발행일: {format(currentStatement.generatedAt, 'yyyy년 MM월 dd일')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                발행자: {currentStatement.generatedByName || currentStatement.generatedBy}
              </Typography>
            </Box>
          </Paper>
        </>
      )}

      {!currentStatement && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            원장을 선택하고 '생성' 버튼을 클릭하여 거래명세서를 생성하세요.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default TransactionStatementPage;
