/**
 * 파일 경로: /src/pages/orders/ProductAggregationByStatusPage.tsx
 * 작성 날짜: 2025-10-07
 * 주요 내용: 상품 집계 상세보기 (confirmationStatus 기반)
 * 관련 데이터: saleOrders, products
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  ArrowBack as ArrowBackIcon,
  Category as CategoryIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import orderAggregationService from '../../services/orderAggregationService';
import type { OrderAggregationData } from '../../types/orderAggregation';
import ProductOrderDetailDialog from '../../components/orders/ProductOrderDetailDialog';

type ProductAggregationRow = {
  productId: string;
  category: string;
  productName: string;
  supplierName: string;
  quantity: number;
  currentStock: number;
  minimumStock: number;
  amount: number;
  confirmationStatus: 'regular' | 'additional';
};

type FilterTab = 'all' | 'regular' | 'additional';

const ProductAggregationByStatusPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aggregationData, setAggregationData] = useState<OrderAggregationData | null>(null);
  const [selectedTab, setSelectedTab] = useState<FilterTab>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await orderAggregationService.getActiveOrderAggregationData();
      setAggregationData(data);
    } catch (err) {
      console.error('Error loading aggregation data:', err);
      setError('상품 집계 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  // 상품별 집계 데이터 평면화
  // 정규: confirmationStatus='regular'인 주문의 placed + confirmed 상태 집계
  // 추가: confirmationStatus='additional'인 주문의 placed + confirmed 상태 집계
  const getProductAggregationRows = (): ProductAggregationRow[] => {
    if (!aggregationData) return [];

    // 상품별로 정규/추가를 분리하여 집계
    const productMap = new Map<string, {
      productId: string;
      category: string;
      productName: string;
      supplierName: string;
      currentStock: number;
      minimumStock: number;
      regularQuantity: number;
      regularAmount: number;
      additionalQuantity: number;
      additionalAmount: number;
      unitPrice: number;
    }>();

    Object.entries(aggregationData.categories).forEach(([categoryName, categoryData]) => {
      categoryData.suppliers.forEach(supplier => {
        supplier.products.forEach(product => {
          const key = `${product.productId}`;

          if (!productMap.has(key)) {
            productMap.set(key, {
              productId: product.productId,
              category: categoryName,
              productName: product.productName,
              supplierName: supplier.supplierName,
              currentStock: product.stockQuantity || 0,
              minimumStock: 0,
              regularQuantity: 0,
              regularAmount: 0,
              additionalQuantity: 0,
              additionalAmount: 0,
              unitPrice: product.unitPrice
            });
          }

          const entry = productMap.get(key)!;

          // placedQuantity/placedAmount: confirmationStatus='regular' 집계
          // confirmedQuantity/confirmedAmount: confirmationStatus='additional' 집계
          entry.regularQuantity += product.placedQuantity;
          entry.regularAmount += product.placedAmount;
          entry.additionalQuantity += product.confirmedQuantity;
          entry.additionalAmount += product.confirmedAmount;
        });
      });
    });

    // Map을 배열로 변환
    const rows: ProductAggregationRow[] = [];
    productMap.forEach(entry => {
      // 정규 행 추가
      if (entry.regularQuantity > 0) {
        rows.push({
          productId: entry.productId,
          category: entry.category,
          productName: entry.productName,
          supplierName: entry.supplierName,
          quantity: entry.regularQuantity,
          currentStock: entry.currentStock,
          minimumStock: entry.minimumStock,
          amount: entry.regularAmount,
          confirmationStatus: 'regular'
        });
      }

      // 추가 행 추가
      if (entry.additionalQuantity > 0) {
        rows.push({
          productId: entry.productId,
          category: entry.category,
          productName: entry.productName,
          supplierName: entry.supplierName,
          quantity: entry.additionalQuantity,
          currentStock: entry.currentStock,
          minimumStock: entry.minimumStock,
          amount: entry.additionalAmount,
          confirmationStatus: 'additional'
        });
      }
    });

    return rows;
  };

  // 대시보드 카테고리별 집계 데이터 계산 (필터 적용)
  const getDashboardCategoryData = () => {
    const rows = getProductAggregationRows();

    // 선택된 탭에 따라 필터링
    const filteredRows = selectedTab === 'all'
      ? rows
      : rows.filter(r => r.confirmationStatus === selectedTab);

    const categories = ['일일식품', '냉동식품', '공산품'];

    return categories.map(categoryName => {
      const categoryRows = filteredRows.filter(r => r.category === categoryName);

      return {
        category: categoryName,
        quantity: categoryRows.reduce((sum, r) => sum + r.quantity, 0),
        amount: categoryRows.reduce((sum, r) => sum + r.amount, 0)
      };
    });
  };

  // 합계 행 계산
  const getDashboardTotal = () => {
    const categoryData = getDashboardCategoryData();
    return {
      quantity: categoryData.reduce((sum, cat) => sum + cat.quantity, 0),
      amount: categoryData.reduce((sum, cat) => sum + cat.amount, 0)
    };
  };

  // 탭 필터에 따른 데이터 필터링
  const getFilteredRows = (): ProductAggregationRow[] => {
    const rows = getProductAggregationRows();

    if (selectedTab === 'regular') {
      return rows.filter(r => r.confirmationStatus === 'regular');
    } else if (selectedTab === 'additional') {
      return rows.filter(r => r.confirmationStatus === 'additional');
    }

    return rows;
  };

  // 행 클릭 핸들러
  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedProductId(null);
  };

  // 탭별 개수 조회
  const getTabCount = (tab: FilterTab) => {
    const rows = getProductAggregationRows();
    if (tab === 'all') return rows.length;
    if (tab === 'regular') return rows.filter(r => r.confirmationStatus === 'regular').length;
    if (tab === 'additional') return rows.filter(r => r.confirmationStatus === 'additional').length;
    return 0;
  };

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'category',
      headerName: '카테고리',
      flex: 0.12,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip label={params.value} size="small" variant="outlined" />
        </Box>
      )
    },
    {
      field: 'productName',
      headerName: '상품명',
      flex: 0.23,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.2,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    {
      field: 'currentStock',
      headerName: '현재고',
      flex: 0.1,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => {
        const isLowStock = params.value <= (params.row.minimumStock + params.row.quantity);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, height: '100%' }}>
            {isLowStock && (
              <WarningIcon sx={{ fontSize: 18, color: 'warning.main' }} />
            )}
            <Typography
              variant="body2"
              sx={{
                color: isLowStock ? 'warning.main' : 'text.primary',
                fontWeight: isLowStock ? 600 : 400
              }}
            >
              {params.value.toLocaleString('ko-KR')}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'quantity',
      headerName: '상품 수량',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2">{params.value.toLocaleString('ko-KR')}</Typography>
        </Box>
      )
    },
    {
      field: 'amount',
      headerName: '금액(원)',
      flex: 0.2,
      align: 'right',
      headerAlign: 'right',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', width: '100%' }}>
          <Typography variant="body2">{params.value.toLocaleString('ko-KR')}</Typography>
        </Box>
      )
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
                <IconButton onClick={handleBack}>
                  <ArrowBackIcon />
                </IconButton>
                <CategoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  상품 집계 상세
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 대시보드 패널 */}
          {!loading && !error && aggregationData && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* 합계 카드 - 가장 왼쪽 */}
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    bgcolor: 'rgba(25, 118, 210, 0.04)',
                    border: 1,
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    합계
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, my: 0.5, color: 'primary.main' }}>
                    {getDashboardTotal().quantity.toLocaleString('ko-KR')}개
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {getDashboardTotal().amount.toLocaleString('ko-KR')}원
                  </Typography>
                </Box>

                {/* 카테고리 카드들 */}
                {getDashboardCategoryData().map((catData) => (
                  <Box
                    key={catData.category}
                    sx={{
                      flex: 1,
                      p: 1.5,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" display="block">
                      {catData.category}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600, my: 0.5 }}>
                      {catData.quantity.toLocaleString('ko-KR')}개
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {catData.amount.toLocaleString('ko-KR')}원
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* 탭 필터 */}
          {!loading && !error && (
            <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
                <Tab label={`전체 (${getTabCount('all')})`} value="all" />
                <Tab label={`정규 (${getTabCount('regular')})`} value="regular" />
                <Tab label={`추가 (${getTabCount('additional')})`} value="additional" />
              </Tabs>
            </Box>
          )}

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1, minHeight: 0 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Paper sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={getFilteredRows()}
                columns={columns}
                getRowId={(row) => `${row.productId}-${row.confirmationStatus}`}
                loading={loading}
                disableRowSelectionOnClick
                disableColumnMenu
                paginationMode="client"
                pageSizeOptions={[10, 20, 30]}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                onRowClick={(params) => handleProductClick(params.row.productId)}
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
                      <CategoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        상품 집계 데이터가 없습니다.
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
          </Box>
        </Box>
      </Container>

      {/* 상품 주문 상세 팝업 */}
      <ProductOrderDetailDialog
        open={dialogOpen}
        productId={selectedProductId}
        onClose={handleDialogClose}
      />
    </Box>
  );
};

export default ProductAggregationByStatusPage;
