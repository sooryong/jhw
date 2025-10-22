/**
 * 파일 경로: /src/pages/orders/SaleOrderManagementPage.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 매출주문 접수 페이지
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Card,
  CardContent,
  Container,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import SaleOrderDetailDialog from '../../components/orders/SaleOrderDetailDialog';
import type { SaleOrder } from '../../types/saleOrder';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';

const SaleOrderManagementPage = () => {

  const { orders: rawOrders, loading: contextLoading, refreshData } = useSaleOrderContext();
  const [saleOrders, setSaleOrders] = useState<GridRowsProp>([]);
  const [stats, setStats] = useState({ orderCount: 0, productTypes: 0, productCount: 0, totalAmount: 0, confirmedCount: 0 });

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);

  // 알림 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // rawOrders가 변경될 때마다 데이터 처리
  useEffect(() => {
    processOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawOrders]);

  const processOrders = () => {
    try {
      // 주문별 집계 맵 생성
      interface OrderRow {
        id: string;
        orderId: string;
        customerName: string;
        createdAt: unknown;
        productCount: number;
        totalQuantity: number;
        totalAmount: number;
        status: string;
        checked: boolean;
      }
      const orderMap = new Map<string, OrderRow>();
      const uniqueProducts = new Set<string>(); // 상품 종류 계산용

      rawOrders.forEach((order: SaleOrder) => {
        if (!orderMap.has(order.id)) {
          // 주문의 총 상품 종류와 수량 계산
          const productCount = order.orderItems?.length || 0;
          const totalQuantity = order.orderItems?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;

          // 상품 종류 추가
          order.orderItems?.forEach((item: { productId: string }) => {
            if (item.productId) {
              uniqueProducts.add(item.productId);
            }
          });

          orderMap.set(order.id, {
            id: order.id, // DataGrid에 필요한 id 필드
            orderId: order.saleOrderNumber,
            customerName: order.customerInfo?.businessName || '알 수 없음',
            createdAt: order.placedAt,
            productCount,
            totalQuantity,
            totalAmount: order.finalAmount || 0,
            status: order.status,
            checked: false
          });
        }
      });

      // Map을 배열로 변환
      const ordersList = Array.from(orderMap.values());

      setSaleOrders(ordersList);

      // 통계 계산
      const totalProductCount = ordersList.reduce((sum, order) => sum + (order.totalQuantity || 0), 0);
      const totalAmount = ordersList.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const confirmedCount = ordersList.filter(order => order.status === 'confirmed').length;

      setStats({
        orderCount: ordersList.length,
        productTypes: uniqueProducts.size, // 고유 상품 종류
        productCount: totalProductCount,
        totalAmount: totalAmount,
        confirmedCount: confirmedCount
      });
    } catch (error) {
      // Error handled silently
      console.error('Error processing orders:', error);
    }
  };


  // 행 클릭 핸들러
  const handleRowClick = (params: { row: { orderId: string } }) => {
    const saleOrderNumber = params.row.orderId;
    const order = rawOrders.find(o => o.saleOrderNumber === saleOrderNumber);
    if (order) {
      setSelectedOrder(order);
      setDialogOpen(true);
    }
  };

  // 다이얼로그 닫기
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
  };

  // 매출주문 컬럼 정의
  const saleOrderColumns: GridColDef[] = [
    {
      field: 'orderId',
      headerName: `매출주문 번호 (${stats.orderCount})`,
      flex: 0.14,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'createdAt',
      headerName: '주문일시',
      flex: 0.14,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => {
        if (!value) return '';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleString('ko-KR', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    },
    {
      field: 'customerName',
      headerName: '고객사',
      flex: 0.20,
      minWidth: 120
    },
    {
      field: 'productCount',
      headerName: `상품 종류 (${stats.productTypes})`,
      flex: 0.12,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalQuantity',
      headerName: `상품 수량 (${stats.productCount.toLocaleString()})`,
      flex: 0.12,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalAmount',
      headerName: '금액',
      flex: 0.12,
      minWidth: 80,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString()
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      minWidth: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'success' }> = {
          placed: { label: '접수', color: 'default' },
          confirmed: { label: '확정', color: 'primary' },
          completed: { label: '완료', color: 'success' }
        };
        const status = statusMap[params.value] || { label: params.value, color: 'default' };
        return (
          <Chip
            label={status.label}
            color={status.color}
            size="small"
          />
        );
      }
    },
    {
      field: 'actions',
      headerName: '확정',
      flex: 0.10,
      minWidth: 70,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(params);
          }}
        >
          <EditIcon />
        </IconButton>
      )
    }
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8f9fa'
          }}
        >
          {/* 헤더 */}
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' }
                  }}
                  onClick={refreshData}
                >
                  매출주문 접수
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={contextLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={refreshData}
                disabled={contextLoading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 통계 패널 */}
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2
            }}>
              {/* 카드 1: 주문 건수 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      주문 건수
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {stats.orderCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 2: 금액 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      금액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {stats.totalAmount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 3: 확정 건수 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 60
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      확정 건수
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {stats.confirmedCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 3, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 380px)', width: '100%' }}>
              <DataGrid
                rows={saleOrders}
                columns={saleOrderColumns}
                getRowId={(row) => row.id}
                loading={contextLoading}
                disableRowSelectionOnClick
                onRowClick={handleRowClick}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } },
                  sorting: { sortModel: [{ field: 'createdAt', sort: 'desc' }] }
                }}
                pageSizeOptions={[10, 20, 30]}
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

      {/* 주문 상세 다이얼로그 */}
      <SaleOrderDetailDialog
        open={dialogOpen}
        order={selectedOrder}
        onClose={handleDialogClose}
        onStatusChanged={refreshData}
      />

      {/* 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SaleOrderManagementPage;
