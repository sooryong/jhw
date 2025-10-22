/**
 * 파일 경로: /src/pages/orders/DailyFoodPurchaseAggregationPage.tsx
 * 작성 날짜: 2025-10-19
 * 업데이트: 2025-10-20 (파일명 및 함수명 변경, 집계 로직 개선)
 * 주요 내용: 일일식품 매입 집계 페이지
 *   - 정규 주문(dailyFoodOrderType='regular') 실시간 집계
 *   - 공급사별 그룹핑
 *   - 매입주문 일괄/개별 생성 기능
 *   - 생성된 PO도 집계 목록에 계속 표시 (생성 완료 표시)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Container,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import dailyFoodPurchaseAggregationService from '../../services/dailyFoodPurchaseAggregationService';
import dailyFoodPurchaseOrderService from '../../services/dailyFoodPurchaseOrderService';
import type { SupplierAggregation } from '../../types/orderAggregation';
import { useAuth } from '../../hooks/useAuth';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';
import SupplierPurchaseOrderDetailDialog from '../../components/orders/SupplierPurchaseOrderDetailDialog';

const DailyFoodPurchaseAggregationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cutoffInfo } = useSaleOrderContext();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ orderCount: 0, productTypes: 0, productCount: 0, totalAmount: 0, createdCount: 0 });

  // 공급사별 집계 데이터
  const [supplierAggregations, setSupplierAggregations] = useState<SupplierAggregation[]>([]);

  // 집계 마감 상태 (cutoffInfo에서 가져옴)
  const cutoffStatus = cutoffInfo.status;

  // 스낵바
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAggregation | null>(null);

  const calculateStats = useCallback(() => {
    let totalProductTypes = 0;
    let totalProductCount = 0;
    let totalAmount = 0;
    let createdCount = 0;

    supplierAggregations.forEach(supplier => {
      if (supplier.hasPurchaseOrder) {
        createdCount++;
      }
      supplier.products.forEach(product => {
        totalProductTypes++;
        totalProductCount += product.totalQuantity;
        // 수량 × 매입가격으로 계산
        totalAmount += product.totalQuantity * (product.unitPrice || 0);
      });
    });

    setStats({
      orderCount: supplierAggregations.length,
      productTypes: totalProductTypes,
      productCount: totalProductCount,
      totalAmount: totalAmount,
      createdCount: createdCount
    });
  }, [supplierAggregations]);

  // supplierAggregations가 변경될 때마다 통계 재계산
  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const loadAggregationData = useCallback(async () => {
    setLoading(true);
    try {
      // 공급사별 집계 데이터 가져오기
      const suppliers = await dailyFoodPurchaseAggregationService.aggregateDailyFoodOrders();

      // 오늘 생성된 매입주문에서 이미 PO가 생성된 공급사 정보 추출
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('createdAt', '>=', today),
        where('orderType', '==', 'dailyFood')
      );

      const purchaseOrdersSnapshot = await getDocs(purchaseOrdersQuery);
      const existingPoMap = new Map<string, { poNumber: string; createdAt: Date }>();

      purchaseOrdersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.supplierId) {
          existingPoMap.set(data.supplierId, {
            poNumber: data.purchaseOrderNumber || doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          });
        }
      });

      // PO 생성 여부 및 정보를 supplier 객체에 추가 (제거하지 않음!)
      const suppliersWithStatus = suppliers.map(supplier => ({
        ...supplier,
        hasPurchaseOrder: existingPoMap.has(supplier.supplierId),
        purchaseOrderNumber: existingPoMap.get(supplier.supplierId)?.poNumber || null,
        purchaseOrderCreatedAt: existingPoMap.get(supplier.supplierId)?.createdAt || null
      }));

      setSupplierAggregations(suppliersWithStatus);
    } catch (error) {
      console.error('Error loading data:', error);
      showSnackbar('집계 데이터 로딩 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAggregationData();

    // Firestore 실시간 리스너 설정
    let saleOrdersUnsubscribe: (() => void) | null = null;
    let purchaseOrdersUnsubscribe: (() => void) | null = null;

    const setupListeners = async () => {
      // 1. dailyFoodOrderType === 'regular'인 매출주문 리스닝
      const saleOrdersQuery = query(
        collection(db, 'saleOrders'),
        where('dailyFoodOrderType', '==', 'regular'),
        where('status', '==', 'confirmed')
      );

      saleOrdersUnsubscribe = onSnapshot(saleOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadAggregationData();
        }
      });

      // 2. 오늘 생성된 매입주문 리스닝
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('createdAt', '>=', today),
        where('orderType', '==', 'dailyFood')
      );

      purchaseOrdersUnsubscribe = onSnapshot(purchaseOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadAggregationData();
        }
      });
    };

    setupListeners();

    return () => {
      if (saleOrdersUnsubscribe) {
        saleOrdersUnsubscribe();
      }
      if (purchaseOrdersUnsubscribe) {
        purchaseOrdersUnsubscribe();
      }
    };
  }, [loadAggregationData]);

  // 스낵바 표시
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 매입주문 일괄 생성
  const handleCreateAllPurchaseOrders = async () => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    if (cutoffStatus !== 'closed') {
      showSnackbar('집계 마감 후 매입주문을 생성할 수 있습니다.', 'error');
      return;
    }

    // 아직 매입주문이 생성되지 않은 공급사만 필터링
    const suppliersToCreate = supplierAggregations.filter(s => !s.hasPurchaseOrder);

    if (suppliersToCreate.length === 0) {
      showSnackbar('생성할 매입주문이 없습니다.', 'error');
      return;
    }

    setLoading(true);
    try {
      const purchaseOrderNumbers = await dailyFoodPurchaseOrderService.createBatchFromAggregation(
        suppliersToCreate
      );

      showSnackbar(
        `일일식품 매입주문 ${purchaseOrderNumbers.length}건이 생성되었습니다. 매입 발주 페이지로 이동합니다.`,
        'success'
      );

      // 2초 후 매입 발주 페이지로 이동
      setTimeout(() => {
        navigate('/orders/daily-food-purchase-orders');
      }, 2000);
    } catch (error) {
      console.error('Error creating batch purchase orders:', error);
      const errorMessage = error instanceof Error ? error.message : '매입주문 생성 중 오류가 발생했습니다.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 다이얼로그 열기
  const handleViewSupplierDetail = (supplier: SupplierAggregation) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  // 다이얼로그 닫기
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSupplier(null);
  };

  // 개별 매입주문 생성
  const handleCreateSinglePurchaseOrder = async (supplier: SupplierAggregation) => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    if (cutoffStatus !== 'closed') {
      showSnackbar('집계 마감 후 매입주문을 생성할 수 있습니다.', 'error');
      return;
    }

    setLoading(true);
    try {
      const purchaseOrderNumber = await dailyFoodPurchaseOrderService.createFromAggregation(supplier);

      showSnackbar(
        `${supplier.supplierName}의 일일식품 매입주문(${purchaseOrderNumber})이 생성되었습니다.`,
        'success'
      );

      // 다이얼로그 닫기
      handleCloseDialog();

      // 데이터 다시 로드
      await loadAggregationData();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      const errorMessage = error instanceof Error ? error.message : '매입주문 생성 중 오류가 발생했습니다.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };


  // 공급사별 그룹화된 데이터를 생성 (DataGrid 표시용)
  const getSupplierRows = () => {
    return supplierAggregations.map((supplier) => ({
      id: supplier.supplierId,
      supplierName: supplier.supplierName,
      productTypes: supplier.products.length,
      totalQuantity: supplier.products.reduce((sum, p) => sum + p.totalQuantity, 0),
      // 수량 × 매입가격으로 계산
      totalAmount: supplier.products.reduce((sum, p) => sum + (p.totalQuantity * (p.unitPrice || 0)), 0),
      hasPurchaseOrder: supplier.hasPurchaseOrder || false,
      purchaseOrderNumber: supplier.purchaseOrderNumber || null,
      supplier: supplier // 전체 데이터 저장
    }));
  };

  // 공급사별 컬럼 정의
  const supplierColumns: GridColDef[] = [
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.25,
      minWidth: 150
    },
    {
      field: 'productTypes',
      headerName: `상품 종류 (${stats.productTypes})`,
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalQuantity',
      headerName: `상품 수량 (${stats.productCount.toLocaleString()})`,
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalAmount',
      headerName: '총 금액',
      flex: 0.15,
      minWidth: 120,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'hasPurchaseOrder',
      headerName: '상태',
      flex: 0.12,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const hasPO = params.value as boolean;
        return (
          <Chip
            label={hasPO ? '생성' : '집계'}
            color={hasPO ? 'success' : 'default'}
            size="small"
          />
        );
      }
    },
    {
      field: 'actions',
      headerName: '생성',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <IconButton
          color="primary"
          size="small"
          onClick={() => handleViewSupplierDetail(params.row.supplier)}
          disabled={loading}
          title="상세 보기"
        >
          <AddIcon />
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
                  onClick={loadAggregationData}
                >
                  일일식품 매입주문 집계
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleCreateAllPurchaseOrders}
                  disabled={loading || cutoffStatus !== 'closed' || (stats.orderCount - stats.createdCount) === 0}
                >
                  일괄 생성({(stats.orderCount - stats.createdCount).toLocaleString()}건)
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={loadAggregationData}
                  disabled={loading}
                >
                  새로고침
                </Button>
              </Box>
            </Box>
          </Box>

          {/* 통계 패널 - 3개 카드 */}
          <Box sx={{ px: 3, pb: 2 }}>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2
        }}>
          {/* 카드 1: 집계 건수 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  집계 건수
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {stats.orderCount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* 카드 2: 매입 금액 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  매입 금액
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {stats.totalAmount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* 카드 3: 생성 건수 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  생성 건수
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {stats.createdCount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

          {/* DataGrid - 공급사별 목록 */}
          <Box sx={{ px: 3, pb: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <DataGrid
            rows={getSupplierRows()}
            columns={supplierColumns}
            loading={loading}
            disableRowSelectionOnClick
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: { sortModel: [{ field: 'supplierName', sort: 'asc' }] }
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
                '&:hover': {
                  bgcolor: 'action.hover',
                },
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

      {/* 공급사별 매입 집계 상세 다이얼로그 */}
      <SupplierPurchaseOrderDetailDialog
        open={dialogOpen}
        supplier={selectedSupplier}
        onClose={handleCloseDialog}
        onCreatePurchaseOrder={handleCreateSinglePurchaseOrder}
        loading={loading}
        cutoffStatus={cutoffStatus}
      />

      {/* Snackbar 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DailyFoodPurchaseAggregationPage;
