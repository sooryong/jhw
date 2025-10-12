/**
 * 파일 경로: /src/pages/inbound/DailyOrderInboundManagementPage.tsx
 * 작성 날짜: 2025-10-06
 * 주요 내용: 일일주문 입고 관리 메인 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Checkbox
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  MoveToInbox as InboundIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import { getPurchaseOrderStatusLabel, getPurchaseOrderStatusColor } from '../../types/purchaseOrder';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { openPrintCenter } from '../../utils/printUtils';

const DailyOrderInboundManagementPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // confirmed와 completed 상태 모두 조회
      const q = query(
        collection(db, 'purchaseOrders'),
        where('status', 'in', ['confirmed', 'completed']),
        orderBy('placedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as PurchaseOrder));

      setPurchaseOrders(orders);
    } catch (err) {
      console.error('Error loading purchase orders:', err);
      setError('입고 대기 매입주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (orderId: string) => {
    openPrintCenter('inbound-inspection', [orderId]);
  };

  const handleInspect = (orderId: string) => {
    navigate(`/orders/inbound/inspect/${orderId}`);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(purchaseOrders.map(order => order.purchaseOrderNumber));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, orderId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handlePrintSelected = () => {
    if (selectedIds.length > 0) {
      openPrintCenter('inbound-inspection', selectedIds);
    }
  };

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'purchaseOrderNumber',
      headerName: '매입주문 코드',
      flex: 0.18,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.12,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={getPurchaseOrderStatusLabel(params.value)}
            size="small"
            color={getPurchaseOrderStatusColor(params.value)}
            variant="outlined"
          />
        </Box>
      )
    },
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.28,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'totalQuantity',
      headerName: '총 수량',
      flex: 0.12,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value.toLocaleString()}
          </Typography>
        </Box>
      )
    },
    {
      field: 'print',
      headerName: '인쇄',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderHeader: () => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Checkbox
            checked={selectedIds.length > 0 && selectedIds.length === purchaseOrders.length}
            indeterminate={selectedIds.length > 0 && selectedIds.length < purchaseOrders.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          {selectedIds.length > 0 ? (
            <Button
              variant="contained"
              size="small"
              onClick={handlePrintSelected}
            >
              선택({selectedIds.length}) 인쇄
            </Button>
          ) : (
            <Typography variant="body2">인쇄</Typography>
          )}
        </Box>
      ),
      renderCell: (params) => {
        const order = params.row as PurchaseOrder;
        const isSelected = selectedIds.includes(order.purchaseOrderNumber);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, height: '100%' }}>
            <Checkbox
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectOne(order.purchaseOrderNumber, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={(e) => {
                e.stopPropagation();
                handlePrint(order.purchaseOrderNumber);
              }}
            >
              인쇄
            </Button>
          </Box>
        );
      }
    },
    {
      field: 'inbound',
      headerName: '입고 등록',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => {
        const order = params.row as PurchaseOrder;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Button
              variant={order.status === 'completed' ? 'outlined' : 'contained'}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleInspect(order.purchaseOrderNumber);
              }}
            >
              {order.status === 'completed' ? '보기' : '입고'}
            </Button>
          </Box>
        );
      }
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <InboundIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            매입주문 입고
          </Typography>
        </Box>
        <Button variant="outlined" onClick={loadData} size="small">
          새로고침
        </Button>
      </Box>

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

      {/* 매입주문 목록 */}
      {!loading && !error && (
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={purchaseOrders.map(order => ({
              ...order,
              supplierName: order.supplierInfo.businessName,
              totalQuantity: order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
            }))}
            columns={columns}
            getRowId={(row) => row.purchaseOrderNumber}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            paginationMode="client"
            pageSizeOptions={[10, 20, 30]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            onRowClick={(params) => handleInspect(params.row.purchaseOrderNumber)}
            sx={{
              '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
              },
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
            }}
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <InboundIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    입고 대기 중인 매입주문이 없습니다.
                  </Typography>
                </Box>
              ),
              loadingOverlay: () => (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              )
            }}
          />
        </Paper>
      )}
    </Container>
  );
};

export default DailyOrderInboundManagementPage;
