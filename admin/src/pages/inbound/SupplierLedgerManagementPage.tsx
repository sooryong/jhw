/**
 * 파일 경로: /src/pages/inbound/SupplierLedgerManagementPage.tsx
 * 작성 날짜: 2025-10-17
 * 주요 내용: 공급사 원장 관리 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Button,
  Grid,
  IconButton,
  Card,
  CardContent,
  ButtonGroup,
  TextField,
  InputAdornment,
  TablePagination,
  Tabs,
  Tab
} from '@mui/material';
import {
  Description as LedgerIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import {
  getPurchaseLedgersBySupplierAndDateRange,
  calculateMonthlyPurchaseStats,
  type MonthlyPurchaseStats
} from '../../services/purchaseLedgerService';
import { getSupplierPayouts } from '../../services/supplierPayoutService';
import type { PurchaseLedger } from '../../types/purchaseLedger';
import type { Supplier } from '../../types/company';
import type { SupplierPayout } from '../../types/supplierPayout';
import { PAYOUT_METHOD_LABELS } from '../../types/supplierPayout';
import { formatCurrency } from '../../utils/formatUtils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  addMonths
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import SupplierSelectModal from '../../components/ledgers/SupplierSelectModal';
import SupplierPayoutModal from '../../components/ledgers/SupplierPayoutModal';

// 트랜잭션 타입 정의
type TransactionType = 'purchase' | 'payment';

interface LedgerTransaction {
  date: Date;
  type: TransactionType;
  description: string;
  debit: number;  // 차변 (외상 발생)
  credit: number; // 대변 (지급)
  balance: number; // 잔액
  reference: string; // 원장번호 or 지급번호
  notes?: string; // 적요 (지급 시에만 사용)
}

const SupplierLedgerManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<PurchaseLedger[]>([]);

  // 공급사 목록
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(searchParams.get('supplierId') || '');
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  // 조회 단위 및 날짜
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>((searchParams.get('viewMode') as 'day' | 'week' | 'month') || 'month');
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });

  // 월별 통계
  const [monthlyStats, setMonthlyStats] = useState<MonthlyPurchaseStats>({
    totalPurchaseAmount: 0,
    totalPaymentAmount: 0,
    currentBalance: 0,
    ledgerCount: 0,
    paymentCount: 0,
    uniqueProductCount: 0,
    totalItemQuantity: 0
  });

  // 탭 상태
  const [activeTab, setActiveTab] = useState(0); // 0: 매입 내역, 1: 결재 내역

  // 결재 내역 (지급)
  const [payments, setPayments] = useState<SupplierPayout[]>([]);

  // 페이지네이션 - 매입 내역
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 페이지네이션 - 결재 내역
  const [paymentPage, setPaymentPage] = useState(0);
  const [paymentRowsPerPage, setPaymentRowsPerPage] = useState(10);

  // 지급 등록 모달
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  // URL 파라미터 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSupplierId) {
      params.set('supplierId', selectedSupplierId);
    }
    params.set('viewMode', viewMode);
    params.set('date', currentDate.toISOString());
    setSearchParams(params, { replace: true });
  }, [selectedSupplierId, viewMode, currentDate, setSearchParams]);

  useEffect(() => {
    loadData();
    setPage(0); // 데이터 변경 시 첫 페이지로 리셋
    setPaymentPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplierId, viewMode, currentDate]);

  // 날짜 범위 계산
  const getDateRange = () => {
    if (viewMode === 'day') {
      return {
        start: startOfDay(currentDate),
        end: endOfDay(currentDate)
      };
    } else if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), // 월요일 시작
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  };

  // 날짜 네비게이션
  const handlePrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, -1));
    } else {
      setCurrentDate(prev => addMonths(prev, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  // 날짜 표시 형식
  const formatDateDisplay = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'yyyy.MM.dd (eee)', { locale: ko });
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'yyyy.MM.dd')} ~ ${format(end, 'MM.dd')}`;
    } else {
      return format(currentDate, 'yyyy.MM');
    }
  };

  // 다음 버튼 비활성화 여부 확인 (오늘 이후로 갈 수 없음)
  const isNextDisabled = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === 'day') {
      const current = new Date(currentDate);
      current.setHours(0, 0, 0, 0);
      return current >= today;
    } else if (viewMode === 'week') {
      const currentWeekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const todayWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return currentWeekEnd >= todayWeekEnd;
    } else {
      const currentMonth = startOfMonth(currentDate);
      const todayMonth = startOfMonth(today);
      return currentMonth >= todayMonth;
    }
  };

  const loadSuppliers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'suppliers'));
      const supplierList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(supplierList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 날짜 범위 계산
      const { start, end } = getDateRange();

      // 매입 원장 조회 (개별 공급사만 지원)
      let ledgerData: PurchaseLedger[];

      if (selectedSupplierId) {
        // 개별 공급사 선택 시: 해당 공급사의 원장만 조회
        ledgerData = await getPurchaseLedgersBySupplierAndDateRange(selectedSupplierId, start, end);
      } else {
        // 선택 안함: 빈 배열 (전체 공급사 조회는 성능 문제로 비활성화)
        ledgerData = [];
      }

      setLedgers(ledgerData);

      // 결재 내역 조회 (개별 공급사만 지원)
      let paymentData: SupplierPayout[] = [];
      try {
        if (selectedSupplierId) {
          paymentData = await getSupplierPayouts(selectedSupplierId, start, end);
        }
      } catch (paymentError) {
        console.warn('결재 내역 조회 실패, 빈 배열로 처리:', paymentError);
      }

      setPayments(paymentData);

      // 통합 통계 계산
      const stats = calculateMonthlyPurchaseStats(ledgerData, paymentData);
      setMonthlyStats(stats);

    } catch (err) {
      console.error('Error loading purchase ledgers:', err);
      setError('매입 원장을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 페이지네이션 핸들러 - 매입 원장
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 페이지네이션 핸들러 - 결재 내역
  const handleChangePaymentPage = (event: unknown, newPage: number) => {
    setPaymentPage(newPage);
  };

  const handleChangePaymentRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentRowsPerPage(parseInt(event.target.value, 10));
    setPaymentPage(0);
  };

  // 트랜잭션 통합 로직 (매입+지급 합치고 시간순 정렬, 잔액 계산)
  const getTransactions = (): LedgerTransaction[] => {
    const transactions: LedgerTransaction[] = [];

    // 매입 원장 추가 (차변 - 외상 발생)
    ledgers.forEach(ledger => {
      transactions.push({
        date: ledger.receivedAt.toDate(),
        type: 'purchase',
        description: ledger.purchaseLedgerNumber,
        debit: ledger.totalAmount,
        credit: 0,
        balance: 0, // 나중에 계산
        reference: ledger.purchaseLedgerNumber
      });
    });

    // 결재 내역 추가 (대변 - 지급)
    payments.forEach(payout => {
      transactions.push({
        date: payout.payoutDate.toDate(),
        type: 'payment',
        description: PAYOUT_METHOD_LABELS[payout.payoutMethod],
        debit: 0,
        credit: payout.payoutAmount,
        balance: 0, // 나중에 계산
        reference: payout.payoutNumber,
        notes: payout.notes
      });
    });

    // 시간순 정렬 (오래된 것부터)
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 잔액 계산 (누적)
    let runningBalance = 0;
    transactions.forEach(tx => {
      runningBalance = runningBalance + tx.debit - tx.credit;
      tx.balance = runningBalance;
    });

    // 최신순으로 정렬 (화면 표시용)
    transactions.reverse();

    return transactions;
  };

  const transactions = getTransactions();

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LedgerIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            공급사 원장 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setPaymentModalOpen(true)}
            disabled={!selectedSupplierId}
            size="small"
          >
            지급 등록
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            size="small"
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 필터 패널 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* 개별 공급사 선택 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton
                onClick={() => setSupplierModalOpen(true)}
                size="small"
                color="primary"
              >
                <SearchIcon />
              </IconButton>
              <TextField
                size="small"
                fullWidth
                value={selectedSupplierId ? suppliers.find(s => s.businessNumber === selectedSupplierId)?.businessName || '' : ''}
                placeholder="공급사를 선택하세요"
                InputProps={{
                  readOnly: true,
                  endAdornment: selectedSupplierId ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSelectedSupplierId('')}>
                        <CloseIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined
                }}
                onClick={() => setSupplierModalOpen(true)}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          </Grid>

          {/* 선택된 공급사 정보 */}
          <Grid size={{ xs: 12, md: 8 }}>
            {selectedSupplierId && (() => {
              const selectedSupplier = suppliers.find(s => s.businessNumber === selectedSupplierId);
              return selectedSupplier ? (
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', pl: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">사업자번호</Typography>
                    <Typography variant="body2" fontWeight="medium">{selectedSupplier.businessNumber}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">대표자</Typography>
                    <Typography variant="body2" fontWeight="medium">{selectedSupplier.ownerName}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">주소</Typography>
                    <Typography variant="body2" fontWeight="medium">{selectedSupplier.businessAddress}</Typography>
                  </Box>
                </Box>
              ) : null;
            })()}
          </Grid>
        </Grid>
      </Paper>

      {/* 공급사 선택 모달 */}
      <SupplierSelectModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        suppliers={suppliers}
        selectedSupplierId={selectedSupplierId}
        onSelect={(id) => {
          setSelectedSupplierId(id);
          setSupplierModalOpen(false);
        }}
      />

      {/* 탭 + 날짜 네비게이션 */}
      {selectedSupplierId && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(event, newValue) => setActiveTab(newValue)}
            >
              <Tab label="매입 내역" />
              <Tab label="결재 내역" />
            </Tabs>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ButtonGroup variant="outlined" size="small">
                <Button
                  variant={viewMode === 'day' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setViewMode('day');
                    setCurrentDate(new Date());
                  }}
                >
                  오늘
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('week')}
                >
                  주
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('month')}
                >
                  월
                </Button>
              </ButtonGroup>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={handlePrevious} size="small">
                  <ChevronLeftIcon />
                </IconButton>
                <Typography
                  variant="h6"
                  sx={{
                    minWidth: 180,
                    textAlign: 'center',
                    fontWeight: 600
                  }}
                >
                  {formatDateDisplay()}
                </Typography>
                <IconButton onClick={handleNext} disabled={isNextDisabled()} size="small">
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 통합 통계 패널 */}
      {!loading && !error && selectedSupplierId && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    💰 매입 금액
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatCurrency(monthlyStats.totalPurchaseAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    💵 지급액
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatCurrency(monthlyStats.totalPaymentAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    📊 미지급금액
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: monthlyStats.currentBalance > 0 ? 'error.main' : 'text.primary' }}>
                    {formatCurrency(monthlyStats.currentBalance)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    📦 상품 종류
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {monthlyStats.uniqueProductCount}종
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    📈 상품 수량
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {monthlyStats.totalItemQuantity.toLocaleString()}개
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
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
      {!loading && !error && !selectedSupplierId && (
        <Alert severity="info">
          공급사를 선택하면 매입 원장을 조회할 수 있습니다.
        </Alert>
      )}
      {!loading && !error && selectedSupplierId && ledgers.length === 0 && (
        <Alert severity="info">
          선택한 기간에 매입 원장이 없습니다.
        </Alert>
      )}

      {/* 탭 1: 매입 내역 목록 */}
      {!loading && !error && activeTab === 0 && ledgers.length > 0 && (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="17%">원장번호</TableCell>
                  <TableCell width="17%">입고일시</TableCell>
                  <TableCell>공급사</TableCell>
                  <TableCell width="15%" align="right">상품 수량</TableCell>
                  <TableCell width="15%" align="right">매입 금액</TableCell>
                  <TableCell width="80px" align="center">상세보기</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledgers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((ledger) => (
                    <TableRow key={ledger.purchaseLedgerNumber} hover sx={{ '& td': { py: 1 } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {ledger.purchaseLedgerNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(ledger.receivedAt.toDate(), 'yyyy-MM-dd HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {ledger.supplierInfo.businessName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {ledger.ledgerItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="primary">
                          {ledger.totalAmount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            const currentParams = searchParams.toString();
                            navigate(`/ledgers/purchase/detail/${ledger.purchaseLedgerNumber}?returnTo=${encodeURIComponent(`/ledgers/purchase?${currentParams}`)}`);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 20, 30]}
            component="div"
            count={ledgers.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="페이지당 항목 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 총 ${count}개`}
          />
        </Paper>
      )}

      {/* 탭 2: 거래 원장 (매입+지급 통합) */}
      {!loading && !error && activeTab === 1 && selectedSupplierId && (
        <Paper>
          {transactions.length > 0 ? (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="15%">일시</TableCell>
                      <TableCell width="15%">구분</TableCell>
                      <TableCell width="25%">적요</TableCell>
                      <TableCell width="15%" align="right">외상</TableCell>
                      <TableCell width="15%" align="right">지급</TableCell>
                      <TableCell width="15%" align="right">잔액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions
                      .slice(paymentPage * paymentRowsPerPage, paymentPage * paymentRowsPerPage + paymentRowsPerPage)
                      .map((tx, index) => (
                        <TableRow key={`${tx.type}-${tx.reference}-${index}`} hover sx={{ '& td': { py: 1.5 } }}>
                          <TableCell>
                            <Typography variant="body2">
                              {format(tx.date, 'yyyy-MM-dd HH:mm')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              sx={{
                                color: tx.type === 'purchase' ? 'primary.main' : 'success.main'
                              }}
                            >
                              {tx.type === 'purchase' ? '매입' : '지급'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {tx.type === 'payment' && tx.notes
                                ? `${tx.description}(${tx.notes})`
                                : tx.description}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {tx.debit > 0 && (
                              <Typography variant="body2" fontWeight="medium" color="primary">
                                {tx.debit.toLocaleString()}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {tx.credit > 0 && (
                              <Typography variant="body2" fontWeight="medium" color="success.main">
                                {tx.credit.toLocaleString()}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={{
                                color: tx.balance > 0 ? 'error.main' : tx.balance < 0 ? 'success.main' : 'text.primary'
                              }}
                            >
                              {tx.balance.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 20, 30]}
                component="div"
                count={transactions.length}
                rowsPerPage={paymentRowsPerPage}
                page={paymentPage}
                onPageChange={handleChangePaymentPage}
                onRowsPerPageChange={handleChangePaymentRowsPerPage}
                labelRowsPerPage="페이지당 항목 수:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 총 ${count}개`}
              />
            </>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                선택한 기간에 거래 내역이 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* 지급 등록 모달 */}
      <SupplierPayoutModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        supplierId={selectedSupplierId}
        supplierName={suppliers.find(s => s.businessNumber === selectedSupplierId)?.businessName || ''}
        onSuccess={() => {
          loadData(); // 데이터 새로고침
          setPaymentModalOpen(false);
        }}
      />
    </Container>
  );
};

export default SupplierLedgerManagementPage;
