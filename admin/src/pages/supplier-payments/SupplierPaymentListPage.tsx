/**
 * 파일 경로: /src/pages/supplier-payments/SupplierPaymentListPage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 지급 내역 목록 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Chip,
  IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Payment as PaymentIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import { getAllPayments } from '../../services/supplierPaymentService';
import { SUPPLIER_PAYMENT_METHOD_LABELS, SUPPLIER_PAYMENT_STATUS_LABELS } from '../../types/supplierPayment';
// import type { SupplierPayment } from '../../types/supplierPayment';

const SupplierPaymentListPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<GridRowsProp>([]);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await getAllPayments();

      const rows = data.map((payment, index) => ({
        id: index + 1,
        paymentNumber: payment.paymentNumber,
        supplierName: payment.supplierInfo.businessName,
        paymentMethod: SUPPLIER_PAYMENT_METHOD_LABELS[payment.paymentMethod],
        paymentAmount: payment.paymentAmount,
        paymentDate: payment.paymentDate,
        processedByName: payment.processedByName,
        status: payment.status,
        notes: payment.notes || ''
      }));

      setPayments(rows);
    } catch (error) {
      // Error handled silently
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'paymentNumber',
      headerName: '지급번호',
      flex: 0.15,
      minWidth: 130,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.15,
      minWidth: 120
    },
    {
      field: 'paymentMethod',
      headerName: '지급수단',
      flex: 0.10,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'paymentAmount',
      headerName: '지급액',
      flex: 0.12,
      minWidth: 120,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString() + '원'
    },
    {
      field: 'paymentDate',
      headerName: '지급일',
      flex: 0.12,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => {
        if (!value) return '';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleDateString('ko-KR');
      }
    },
    {
      field: 'processedByName',
      headerName: '처리자',
      flex: 0.10,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.08,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const statusMap: Record<string, { color: 'default' | 'primary' | 'success' }> = {
          pending: { color: 'default' },
          completed: { color: 'success' },
          cancelled: { color: 'default' }
        };
        const status = statusMap[params.value] || { color: 'default' };
        return (
          <Chip
            label={SUPPLIER_PAYMENT_STATUS_LABELS[params.value as keyof typeof SUPPLIER_PAYMENT_STATUS_LABELS] || params.value}
            color={status.color}
            size="small"
          />
        );
      }
    },
    {
      field: 'notes',
      headerName: '비고',
      flex: 0.18,
      minWidth: 150
    }
  ];

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
                <PaymentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  지급 내역
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={loadPayments}
                  disabled={loading}
                >
                  새로고침
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/supplier-payments/create')}
                >
                  지급 등록
                </Button>
              </Box>
            </Box>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
              <DataGrid
                rows={payments}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                initialState={{
                  pagination: { paginationModel: { pageSize: 20 } },
                  sorting: { sortModel: [{ field: 'paymentDate', sort: 'desc' }] }
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

export default SupplierPaymentListPage;
