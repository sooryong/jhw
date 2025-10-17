/**
 * 파일 경로: /src/pages/outbound/SaleLedgerDetailPage.tsx
 * 작성 날짜: 2025-10-17
 * 주요 내용: 매출 원장 상세보기 페이지
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { DataGrid } from '@mui/x-data-grid';
import {
  ArrowBack as BackIcon,
  Description as LedgerIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import type { SaleLedger } from '../../types/saleLedger';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { format } from 'date-fns';

const SaleLedgerDetailPage = () => {
  const { ledgerNumber } = useParams<{ ledgerNumber: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleLedger, setSaleLedger] = useState<SaleLedger | null>(null);

  // 목록으로 돌아가기 URL
  const returnTo = searchParams.get('returnTo') || '/ledgers/sales';

  useEffect(() => {
    if (ledgerNumber) {
      loadSaleLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerNumber]);

  const loadSaleLedger = async () => {
    if (!ledgerNumber) return;

    setLoading(true);
    setError(null);

    try {
      // saleLedgerNumber로 매출 원장 조회
      const q = query(
        collection(db, 'saleLedgers'),
        where('saleLedgerNumber', '==', ledgerNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('매출 원장을 찾을 수 없습니다.');
        return;
      }

      const ledger = snapshot.docs[0].data() as SaleLedger;
      setSaleLedger(ledger);
    } catch (err) {
      console.error('Error loading sale ledger:', err);
      setError('매출 원장을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSaleSlip = () => {
    if (saleLedger) {
      const printUrl = `/print-center?type=sale-slip&ids=${saleLedger.saleLedgerNumber}`;
      window.open(printUrl, '_blank', 'width=1024,height=768');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !saleLedger) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate(returnTo)}
          sx={{ mt: 2 }}
        >
          목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  if (!saleLedger) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate(returnTo)}>
            <BackIcon />
          </IconButton>
          <LedgerIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            매출 원장 상세
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintSaleSlip}
            size="small"
          >
            거래명세서 인쇄
          </Button>
          <Button
            variant="outlined"
            onClick={loadSaleLedger}
            disabled={loading}
            size="small"
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 매출 원장 정보 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              매출원장 번호
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger.saleLedgerNumber}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              출하일시
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {format(saleLedger.shippedAt.toDate(), 'yyyy-MM-dd HH:mm')}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              합계 금액
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="primary.main">
              ₩{saleLedger.totalAmount.toLocaleString()}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              고객사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger.customerInfo.businessName}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 1.4 }}>
            <Typography variant="caption" color="text.secondary">
              상품 종류
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger.itemCount}종
            </Typography>
          </Grid>
        </Grid>

        {/* 매출주문번호 */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              매출주문 번호
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger.saleOrderNumber}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              상품 수량
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger.ledgerItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}개
            </Typography>
          </Grid>
          {saleLedger.notes && (
            <Grid size={{ xs: 12, md: 7.2 }}>
              <Typography variant="caption" color="text.secondary">
                비고
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {saleLedger.notes}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* 품목 상세 */}
      <Paper sx={{ minHeight: 400, maxHeight: 600, width: '100%', mb: 3 }}>
        <DataGrid
          autoHeight
          rows={saleLedger.ledgerItems}
          columns={[
            {
              field: 'category',
              headerName: '카테고리',
              flex: 0.12,
              align: 'center',
              headerAlign: 'center',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Chip
                    label={params.value || '미분류'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )
            },
            {
              field: 'productCode',
              headerName: '상품코드',
              flex: 0.15,
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'productName',
              headerName: '상품명',
              flex: 0.25,
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'specification',
              headerName: '규격',
              flex: 0.15,
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value || '-'}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'quantity',
              headerName: '수량',
              flex: 0.10,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value.toLocaleString()}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'unitPrice',
              headerName: '단가',
              flex: 0.10,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value.toLocaleString()}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'lineTotal',
              headerName: '소계',
              flex: 0.13,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography variant="body2" color="primary.main" fontWeight="medium">
                    {params.value.toLocaleString()}
                  </Typography>
                </Box>
              )
            }
          ]}
          getRowId={(row) => row.productId}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[10, 20, 30]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } }
          }}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
          }}
        />
      </Paper>
    </Container>
  );
};

export default SaleLedgerDetailPage;
