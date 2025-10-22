/**
 * 파일 경로: /src/pages/orders/DailyFoodCustomerOrdersPage.tsx
 * 작성 날짜: 2025-10-18
 * 주요 내용: 고객 주문 목록 페이지 (정규/추가 탭 구분)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
    CircularProgress,
  Chip,
  Card,
  CardContent,
  Tabs,
  Tab
} from '@mui/material';
import SubPageHeader from '../../components/common/SubPageHeader';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
// import cutoffService from '../../services/cutoffService';
import SaleOrderDetailDialog from '../../components/orders/SaleOrderDetailDialog';
import type { SaleOrder, SaleOrderItem } from '../../types/saleOrder';

// 그리드 행 데이터 타입
interface OrderRow {
  id: number;
  orderId: string;
  customerName: string;
  createdAt: unknown;
  productCount: number;
  totalQuantity: number;
  totalAmount: number;
  status: string;
  cutoffStatus: string;
  checked: boolean;
}

const DailyFoodCustomerOrdersPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<GridRowsProp>([]);
  const [allOrders, setAllOrders] = useState<GridRowsProp>([]);
  const [stats, setStats] = useState({ orderCount: 0, productTypes: 0, productCount: 0, totalAmount: 0 });
  const [selectedTab, setSelectedTab] = useState(0); // 0: 전체, 1: 정규, 2: 추가
  const [tabCounts, setTabCounts] = useState({ all: 0, regular: 0, additional: 0 });

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);

  // 원본 주문 데이터 저장
  const [rawOrders, setRawOrders] = useState<SaleOrder[]>([]);

  useEffect(() => {
    loadCustomerOrders();

    // Firestore 실시간 리스너 설정
    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      // dailyFoodOrderType이 'regular' 또는 'additional'인 주문 모두 리스닝
      // 참고: Firestore는 'in' 쿼리를 지원하지만, 여기서는 간단하게 리스너를 2개 사용하거나
      // 모든 매출주문을 리스닝한 후 클라이언트에서 필터링
      const ordersQuery = query(
        collection(db, 'saleOrders')
      );

      unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadCustomerOrders();
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadCustomerOrders = async () => {
    setLoading(true);
    try {
      // 1. 일일식품 상품 ID 목록 가져오기
      const productsQuery = query(
        collection(db, 'products'),
        where('mainCategory', '==', '일일식품')
      );
      const productsSnapshot = await getDocs(productsQuery);
      const dailyFoodProductIds = new Set(
        productsSnapshot.docs.map(doc => doc.id)
      );

      // 2. dailyFoodOrderType이 'regular' 또는 'additional'인 매출주문 조회
      const regularOrdersQuery = query(
        collection(db, 'saleOrders'),
        where('dailyFoodOrderType', '==', 'regular')
      );
      const additionalOrdersQuery = query(
        collection(db, 'saleOrders'),
        where('dailyFoodOrderType', '==', 'additional')
      );

      const [regularSnapshot, additionalSnapshot] = await Promise.all([
        getDocs(regularOrdersQuery),
        getDocs(additionalOrdersQuery)
      ]);

      // 3. 모든 주문 합치기 및 일일식품 상품 포함 필터링
      const allOrderDocs = [
        ...regularSnapshot.docs,
        ...additionalSnapshot.docs
      ];

      const orders = allOrderDocs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((order: SaleOrder) => {
          // 일일식품 상품이 포함된 주문만
          return order.orderItems?.some((item: SaleOrderItem) =>
            dailyFoodProductIds.has(item.productId)
          );
        }) as SaleOrder[];

      // 원본 주문 데이터 저장
      setRawOrders(orders);

      // 주문별 집계 맵 생성
      const orderMap = new Map<string, Omit<OrderRow, 'id'>>();

      orders.forEach((order: SaleOrder) => {
        if (!orderMap.has(order.id)) {
          // 주문의 총 상품 종류와 수량 계산
          const productCount = order.orderItems?.length || 0;
          const totalQuantity = order.orderItems?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;

          // dailyFoodOrderType 필드를 직접 사용
          const cutoffStatus = order.dailyFoodOrderType || 'regular';

          orderMap.set(order.id, {
            orderId: order.saleOrderNumber,
            customerName: order.customerInfo?.businessName || '알 수 없음',
            createdAt: order.placedAt,
            productCount,
            totalQuantity,
            totalAmount: order.finalAmount || 0,
            status: order.status,
            cutoffStatus: cutoffStatus,
            checked: false
          });
        }
      });

      // Map을 배열로 변환하고 id 추가
      const ordersList: OrderRow[] = Array.from(orderMap.values()).map((order, index) => ({
        id: index + 1,
        ...order
      }));

      setAllOrders(ordersList);
      setCustomerOrders(ordersList); // 초기에는 전체 표시

      // 탭 카운트 계산
      const regularOrders = ordersList.filter((o: OrderRow) => o.cutoffStatus === 'regular');
      const additionalOrders = ordersList.filter((o: OrderRow) => o.cutoffStatus === 'additional');

      setTabCounts({
        all: ordersList.length,
        regular: regularOrders.length,
        additional: additionalOrders.length
      });

      // 통계 계산 (전체)
      // 고유한 상품 종류 계산
      const productSet = new Set<string>();
      orders.forEach((order: SaleOrder) => {
        order.orderItems?.forEach((item: SaleOrderItem) => {
          productSet.add(item.productId);
        });
      });

      const totalProductCount = ordersList.reduce((sum: number, order: OrderRow) => sum + (order.totalQuantity || 0), 0);
      const totalAmount = ordersList.reduce((sum: number, order: OrderRow) => sum + (order.totalAmount || 0), 0);

      setStats({
        orderCount: ordersList.length,
        productTypes: productSet.size,
        productCount: totalProductCount,
        totalAmount: totalAmount
      });
    } catch (error) {
      // Error handled silently
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderTypeChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);

    let filteredOrders: OrderRow[];
    if (newValue === 0) {
      // 전체
      filteredOrders = allOrders as OrderRow[];
    } else if (newValue === 1) {
      // 정규
      filteredOrders = (allOrders as OrderRow[]).filter((o: OrderRow) => o.cutoffStatus === 'regular');
    } else {
      // 추가
      filteredOrders = (allOrders as OrderRow[]).filter((o: OrderRow) => o.cutoffStatus === 'additional');
    }

    setCustomerOrders(filteredOrders);

    // 선택된 탭에 따른 통계 계산
    // 필터링된 주문의 고유 상품 종류 계산
    const productSet = new Set<string>();
    const filteredOrderIds = new Set(filteredOrders.map((o: OrderRow) => o.orderId));
    rawOrders.forEach((order: SaleOrder) => {
      if (filteredOrderIds.has(order.saleOrderNumber)) {
        order.orderItems?.forEach((item: SaleOrderItem) => {
          productSet.add(item.productId);
        });
      }
    });

    const totalProductCount = filteredOrders.reduce((sum: number, order: OrderRow) => sum + (order.totalQuantity || 0), 0);
    const totalAmount = filteredOrders.reduce((sum: number, order: OrderRow) => sum + (order.totalAmount || 0), 0);

    setStats({
      orderCount: filteredOrders.length,
      productTypes: productSet.size,
      productCount: totalProductCount,
      totalAmount: totalAmount
    });
  };

  // 행 클릭 핸들러
  const handleViewOrderDetail = (params: { row: { orderId: string } }) => {
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
      flex: 0.20,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => {
        if (!value) return '';
        // Handle Firestore Timestamp or Date object
        const hasToDate = typeof value === 'object' && value !== null && 'toDate' in value;
        const date = hasToDate ? (value as { toDate: () => Date }).toDate() : new Date(value as string | number);
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
      minWidth: 140
    },
    {
      field: 'totalQuantity',
      headerName: '상품수량',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalAmount',
      headerName: '금액',
      flex: 0.10,
      minWidth: 80,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      minWidth: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const statusMap: Record<string, { label: string }> = {
          placed: { label: '접수' },
          confirmed: { label: '확정' },
          completed: { label: '완료' }
        };
        const status = statusMap[params.value] || { label: params.value };
        return (
          <Chip
            label={status.label}
            color="info"
            size="small"
          />
        );
      }
    }
  ];

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
      {/* 헤더 */}
      <SubPageHeader
        title="일일식품 접수 목록"
        onBack={() => navigate('/orders/daily-food-cutoff-settings')}
        onRefresh={loadCustomerOrders}
        loading={loading}
      />

          {/* 통계 패널 */}
          <Box sx={{ px: 2, pb: 1 }}>
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
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 80
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      주문 건수
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.orderCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 2: 상품 종류 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 80
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      상품 종류
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {stats.productTypes.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 3: 상품 수량 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 80
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      상품 수량
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {stats.productCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 4: 금액 */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 80
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      금액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {stats.totalAmount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* 탭 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Tabs
              value={selectedTab}
              onChange={handleOrderTypeChange}
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: 'info.main',
                },
                '& .Mui-selected': {
                  color: 'info.main',
                }
              }}
            >
              <Tab label={`전체(${tabCounts.all})`} />
              <Tab label={`정규(${tabCounts.regular})`} />
              <Tab label={`추가(${tabCounts.additional})`} />
            </Tabs>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 300px)', width: '100%' }}>
              <DataGrid
                rows={customerOrders}
                columns={customerOrderColumns}
                loading={loading}
                disableRowSelectionOnClick
                onRowClick={handleViewOrderDetail}
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

      {/* 주문 상세 다이얼로그 */}
      <SaleOrderDetailDialog
        open={dialogOpen}
        order={selectedOrder}
        onClose={handleDialogClose}
        onStatusChanged={loadCustomerOrders}
      />
    </Box>
  );
};

export default DailyFoodCustomerOrdersPage;
