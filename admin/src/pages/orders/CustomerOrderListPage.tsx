/**
 * 파일 경로: /src/pages/orders/CustomerOrderListPage.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 고객사별 주문 목록 페이지
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
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ArrowBack as ArrowBackIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import dailySaleOrderAggregationService from '../../services/dailySaleOrderAggregationService';
import SaleOrderDetailDialog from '../../components/orders/SaleOrderDetailDialog';
import type { SaleOrder } from '../../types/saleOrder';

const CustomerOrderListPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [allOrders, setAllOrders] = useState<GridRowsProp>([]);
  const [customerOrders, setCustomerOrders] = useState<GridRowsProp>([]);
  const [selectedTab, setSelectedTab] = useState(0); // 0: 전체, 1: 정규, 2: 추가
  const [tabCounts, setTabCounts] = useState({ all: 0, regular: 0, additional: 0 });
  const [stats, setStats] = useState({ orderCount: 0, productCount: 0, totalAmount: 0 });

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);

  // 원본 주문 데이터 저장
  const [rawOrders, setRawOrders] = useState<SaleOrder[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const aggregationData = await dailySaleOrderAggregationService.getActiveOrderAggregationData();

      // 집계 데이터에서 원본 주문 가져오기
      const orders = aggregationData.orders || [];

      // 원본 주문 데이터 저장
      setRawOrders(orders);

      // 주문별 집계 맵 생성
      const orderMap = new Map<string, any>();

      orders.forEach(order => {
        // DB에 저장된 orderPhase 필드를 직접 사용 (타임스탬프 재계산 제거)
        const orderType = order.orderPhase || 'regular';
        const confirmationStatusLabel = orderType === 'additional' ? '추가' : '정규';

        if (!orderMap.has(order.id)) {
          // 주문의 총 상품 종류와 수량 계산
          const productCount = order.orderItems?.length || 0;
          const totalQuantity = order.orderItems?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

          orderMap.set(order.id, {
            orderId: order.saleOrderNumber,
            orderType,
            confirmationStatus: confirmationStatusLabel,
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

      // Map을 배열로 변환하고 id 추가
      const ordersList = Array.from(orderMap.values()).map((order, index) => ({
        id: index + 1,
        ...order
      }));

      // 탭 카운트 계산
      const counts = {
        all: ordersList.length,
        regular: ordersList.filter(o => o.orderType === 'regular').length,
        additional: ordersList.filter(o => o.orderType === 'additional').length
      };

      setAllOrders(ordersList);
      setTabCounts(counts);
      filterOrdersByTab(0, ordersList); // 초기에는 전체 탭
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrdersByTab = (tabIndex: number, orders: GridRowsProp = allOrders) => {
    let filtered = orders;
    if (tabIndex === 0) {
      // 전체
      filtered = orders;
    } else if (tabIndex === 1) {
      // 정규
      filtered = orders.filter(o => o.orderType === 'regular');
    } else if (tabIndex === 2) {
      // 추가
      filtered = orders.filter(o => o.orderType === 'additional');
    }

    setCustomerOrders(filtered);

    // 통계 계산
    const totalProductCount = filtered.reduce((sum, order) => sum + (order.totalQuantity || 0), 0);
    const totalAmount = filtered.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    setStats({
      orderCount: filtered.length,
      productCount: totalProductCount,
      totalAmount: totalAmount
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    filterOrdersByTab(newValue);
  };

  // 행 클릭 핸들러
  const handleRowClick = (params: any) => {
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

  // 고객사별 주문 컬럼 정의
  const customerOrderColumns: GridColDef[] = [
    {
      field: 'confirmationStatus',
      headerName: '구분',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === '정규' ? 'primary' : 'secondary'}
          size="small"
        />
      )
    },
    {
      field: 'orderId',
      headerName: '주문번호',
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'createdAt',
      headerName: '주문일시',
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: any) => {
        if (!value) return '';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleString('ko-KR', {
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
      field: 'totalQuantity',
      headerName: '상품수량',
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'totalAmount',
      headerName: '금액',
      flex: 0.15,
      minWidth: 100,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      minWidth: 80,
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
                <IconButton onClick={() => navigate('/orders/management')}>
                  <ArrowBackIcon />
                </IconButton>
                <ReceiptIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  매출주문 확정
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={loadData}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 통계 패널 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* 좌측 카드 - 통계 (75%) */}
              <Box sx={{ width: '75%' }}>
                <Card>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          주문 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {stats.orderCount.toLocaleString()}건
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          상품 수량
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {stats.productCount.toLocaleString()}개
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          금액
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {stats.totalAmount.toLocaleString()}원
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* 우측 카드 - 네비게이션 버튼 (25%) */}
              <Box sx={{ width: '25%' }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', py: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<InventoryIcon />}
                      onClick={() => navigate('/orders/product-aggregation')}
                    >
                      매출주문 상품 집계
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* 탭 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Tabs value={selectedTab} onChange={handleTabChange}>
              <Tab label={`전체(${tabCounts.all})`} />
              <Tab label={`정규(${tabCounts.regular})`} />
              <Tab label={`추가(${tabCounts.additional})`} />
            </Tabs>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
              <DataGrid
                rows={customerOrders}
                columns={customerOrderColumns}
                loading={loading}
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
        onStatusChanged={loadData}
      />
    </Box>
  );
};

export default CustomerOrderListPage;
