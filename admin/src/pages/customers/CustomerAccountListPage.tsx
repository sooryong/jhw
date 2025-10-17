/**
 * 파일 경로: /src/pages/customers/CustomerAccountListPage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 계정 목록 페이지 (미수금 현황)
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
import { getAllCustomerAccounts } from '../../services/customerCollectionService';

const CustomerAccountListPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GridRowsProp>([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalBalance: 0,
    totalSales: 0,
    totalReceived: 0
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAllCustomerAccounts();

      const rows = data.map((account, index) => ({
        id: index + 1,
        customerId: account.customerId,
        customerName: account.customerName,
        totalSalesAmount: account.totalSalesAmount,
        totalReceivedAmount: account.totalReceivedAmount,
        currentBalance: account.currentBalance,
        transactionCount: account.transactionCount,
        lastSaleDate: account.lastSaleDate,
        lastPaymentDate: account.lastPaymentDate
      }));

      setAccounts(rows);

      // 통계 계산
      const totalBalance = data.reduce((sum, acc) => sum + acc.currentBalance, 0);
      const totalSales = data.reduce((sum, acc) => sum + acc.totalSalesAmount, 0);
      const totalReceived = data.reduce((sum, acc) => sum + acc.totalReceivedAmount, 0);

      setStats({
        totalCustomers: data.length,
        totalBalance,
        totalSales,
        totalReceived
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
      field: 'customerName',
      headerName: '고객사명',
      flex: 0.15,
      minWidth: 150
    },
    {
      field: 'totalSalesAmount',
      headerName: '누적 매출액',
      flex: 0.12,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원'
    },
    {
      field: 'totalReceivedAmount',
      headerName: '누적 수금액',
      flex: 0.12,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원'
    },
    {
      field: 'currentBalance',
      headerName: '현재 미수금',
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
      field: 'lastSaleDate',
      headerName: '최근 매출일',
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
      headerName: '최근 수금일',
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
    navigate(`/customers/accounts/${params.row.customerId}`);
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
                  고객사 계정 관리
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
                      거래 고객사
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.totalCustomers.toLocaleString()}개사
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      누적 매출액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.totalSales.toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      누적 수금액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {stats.totalReceived.toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      전체 미수금
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

export default CustomerAccountListPage;
