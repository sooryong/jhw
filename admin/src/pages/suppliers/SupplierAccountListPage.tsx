/**
 * 파일 경로: /src/pages/suppliers/SupplierAccountListPage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 계정 목록 페이지 (미지급금 현황)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Card,
  CardContent
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import { getAllSupplierAccounts } from '../../services/supplierPayoutService';

const SupplierAccountListPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GridRowsProp>([]);
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    totalBalance: 0,
    totalPurchase: 0,
    totalPaid: 0
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAllSupplierAccounts();

      const rows = data.map((account, index) => ({
        id: index + 1,
        supplierId: account.supplierId,
        supplierName: account.supplierName,
        totalPurchaseAmount: account.totalPurchaseAmount,
        totalPaidAmount: account.totalPaidAmount,
        currentBalance: account.currentBalance,
        transactionCount: account.transactionCount,
        lastPurchaseDate: account.lastPurchaseDate,
        lastPaymentDate: account.lastPaymentDate
      }));

      setAccounts(rows);

      // 통계 계산
      const totalBalance = data.reduce((sum, acc) => sum + acc.currentBalance, 0);
      const totalPurchase = data.reduce((sum, acc) => sum + acc.totalPurchaseAmount, 0);
      const totalPaid = data.reduce((sum, acc) => sum + acc.totalPaidAmount, 0);

      setStats({
        totalSuppliers: data.length,
        totalBalance,
        totalPurchase,
        totalPaid
      });

    } catch (error) {
      // Error handled silently
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'supplierName',
      headerName: '공급사명',
      flex: 0.15,
      minWidth: 150
    },
    {
      field: 'totalPurchaseAmount',
      headerName: '누적 매입액',
      flex: 0.12,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원'
    },
    {
      field: 'totalPaidAmount',
      headerName: '누적 지급액',
      flex: 0.12,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원'
    },
    {
      field: 'currentBalance',
      headerName: '현재 미지급금',
      flex: 0.12,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원',
      renderCell: (params) => (
        <Typography
          sx={{
            fontWeight: 'bold',
            color: params.value > 0 ? 'error.main' : 'success.main'
          }}
        >
          {params.value?.toLocaleString()}원
        </Typography>
      )
    },
    {
      field: 'transactionCount',
      headerName: '거래 건수',
      flex: 0.08,
      minWidth: 90,
      type: 'number',
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'lastPurchaseDate',
      headerName: '최근 매입일',
      flex: 0.10,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => {
        if (!value) return '-';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleDateString('ko-KR');
      }
    },
    {
      field: 'lastPaymentDate',
      headerName: '최근 지급일',
      flex: 0.10,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => {
        if (!value) return '-';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleDateString('ko-KR');
      }
    }
  ];

  const handleRowClick = (params:unknown) => {
    navigate(`/suppliers/accounts/${params.row.supplierId}`);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate(-1)}>
                  <ArrowBackIcon />
                </IconButton>
                <AccountBalanceIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  공급사 계정 관리
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={loadAccounts}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 통계 패널 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Card>
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      거래 공급사
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.totalSuppliers.toLocaleString()}개사
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      누적 매입액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.totalPurchase.toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      누적 지급액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {stats.totalPaid.toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      전체 미지급금
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                      {stats.totalBalance.toLocaleString()}원
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 280px)', width: '100%' }}>
              <DataGrid
                rows={accounts}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                onRowClick={handleRowClick}
                initialState={{
                  pagination: { paginationModel: { pageSize: 20 } },
                  sorting: { sortModel: [{ field: 'currentBalance', sort: 'desc' }] }
                }}
                pageSizeOptions={[10, 20, 50]}
                sx={{
                  bgcolor: 'background.paper',
                  '& .MuiDataGrid-cell': {
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: 'grey.100',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-row': {
                    cursor: 'pointer',
                  },
                }}
                slots={{
                  loadingOverlay: () => (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  )
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default SupplierAccountListPage;
