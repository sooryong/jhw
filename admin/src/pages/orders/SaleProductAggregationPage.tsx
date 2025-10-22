/**
 * 파일 경로: /src/pages/orders/SaleProductAggregationPage.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 카테고리별 상품 집계 페이지 (재고 포함)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Container
} from '@mui/material';
import {
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import saleOrderAggregationService from '../../services/saleOrderAggregationService';
import settingsService from '../../services/settingsService';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';
import ProductAggregationDetailDialog from '../../components/orders/ProductAggregationDetailDialog';

const SaleProductAggregationPage = () => {
  const { orders } = useSaleOrderContext();
  const [loading, setLoading] = useState(false);
  const [productAggregation, setProductAggregation] = useState<GridRowsProp>([]);
  const [allProducts, setAllProducts] = useState<GridRowsProp>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState(0); // 0: 전체, 1~: 각 카테고리
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ productTypes: 0, productCount: 0, totalAmount: 0 });
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, number>>({});

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<unknown>(null);

  // 전체 집계 데이터 (상세 정보용)
  const [aggregationData, setAggregationData] = useState<unknown>(null);

  // orders가 변경될 때마다 데이터 처리
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Settings에서 모든 대분류 가져오기
      const allMainCategories = await settingsService.getProductCategories();

      // confirmed 상태만 상품 집계에 포함
      const confirmedOrders = orders.filter(order => order.status === 'confirmed');

      // SaleOrderContext에서 받은 orders를 사용하여 집계 수행
      const categories = await saleOrderAggregationService.aggregateByCategory(confirmedOrders);

      const data = {
        categories,
        orders,
        total: { regular: { count: 0, amount: 0 }, additional: { count: 0, amount: 0 }, pended: { count: 0, amount: 0 }, rejected: { count: 0, amount: 0 } },
        date: new Date()
      };

      setAggregationData(data); // 전체 데이터 저장

      // 카테고리별 상품 집계 생성
      const productList: unknown[] = [];
      const categorySet = new Set<string>();
      let productId = 0;

      Object.keys(data.categories).forEach(category => {
        categorySet.add(category);

        data.categories[category].suppliers.forEach(supplier => {
          supplier.products.forEach(product => {
            const totalQuantity = product.totalQuantity;
            const totalAmount = product.totalAmount;

            if (totalQuantity > 0) {
              productId++;
              const currentStock = product.stockQuantity || 0;
              productList.push({
                id: productId,
                category: category,
                productName: product.productName,
                productId: product.productId,
                specification: product.specification || '-',
                totalQuantity: totalQuantity,
                currentStock: currentStock,
                totalAmount: totalAmount,
                stockStatus: currentStock >= totalQuantity ? 'sufficient' : 'insufficient'
              });
            }
          });
        });
      });

      setAllProducts(productList);
      setProductAggregation(productList);

      // Settings에서 가져온 모든 대분류를 사용 (상품이 없어도 표시)
      const sortedCategories = allMainCategories.sort();
      setCategories(sortedCategories);

      // 탭 카운트 계산
      const counts: Record<string, number> = {
        all: productList.length
      };
      sortedCategories.forEach(category => {
        counts[category] = productList.filter(p => p.category === category).length;
      });
      setTabCounts(counts);

      // 카테고리별 금액 계산
      const amounts: Record<string, number> = {};
      sortedCategories.forEach(category => {
        const categoryProducts = productList.filter(p => p.category === category);
        amounts[category] = categoryProducts.reduce((sum, p) => sum + p.totalAmount, 0);
      });
      setCategoryAmounts(amounts);

      // 초기 통계 계산 (전체)
      const totalQuantity = productList.reduce((sum, p) => sum + p.totalQuantity, 0);
      const initialStats = {
        productTypes: productList.length,
        productCount: totalQuantity,
        totalAmount: productList.reduce((sum, p) => sum + p.totalAmount, 0)
      };
      setStats(initialStats);
    } catch (error) {
      // Error handled silently
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);

    let filteredProducts: unknown[];
    if (newValue === 0) {
      filteredProducts = allProducts as unknown[];
    } else {
      const category = categories[newValue - 1];
      filteredProducts = (allProducts as unknown[]).filter(p => p.category === category);
    }

    setProductAggregation(filteredProducts);

    // 선택된 탭에 따른 통계 계산
    const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.totalQuantity, 0);
    const newStats = {
      productTypes: filteredProducts.length,
      productCount: totalQuantity,
      totalAmount: filteredProducts.reduce((sum, p) => sum + p.totalAmount, 0)
    };
    setStats(newStats);
  };

  // 행 클릭 핸들러
  const handleRowClick = (params:unknown) => {
    if (!aggregationData) return;

    const productName = params.row.productName;
    const category = params.row.category;

    // 집계 데이터에서 상품 상세 정보 추출
    const productDetail = extractProductDetail(aggregationData, category, productName);
    if (productDetail) {
      setSelectedProduct(productDetail);
      setDialogOpen(true);
    }
  };

  // 다이얼로그 닫기
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedProduct(null);
  };

  // 집계 데이터에서 상품 상세 정보 추출
  const extractProductDetail = (data: unknown, category: string, productName: string) => {
    if (!data || !data.categories || !data.categories[category]) return null;

    const categoryData = data.categories[category];
    let productInfo: unknown = null;
    const suppliers: unknown[] = [];
    const orders: unknown[] = [];
    let firstSupplierName = '';

    // 공급사별 상품 정보 수집
    categoryData.suppliers.forEach((supplier:unknown) => {
      const product = supplier.products.find((p:unknown) => p.productName === productName);
      if (product) {
        if (!productInfo) {
          firstSupplierName = supplier.supplierName;
          productInfo = {
            productName: product.productName,
            productCode: product.productId,
            category: category,
            specification: product.specification || '-',
            supplierName: firstSupplierName,
            totalQuantity: product.totalQuantity,
            currentStock: product.stockQuantity || 0,
            totalAmount: product.totalAmount
          };
        }

        // 공급사 정보 추가
        suppliers.push({
          supplierName: supplier.supplierName,
          quantity: product.totalQuantity,
          amount: product.totalAmount
        });
      }
    });

    // 주문 정보 수집
    if (data.orders) {
      data.orders.forEach((order:unknown) => {
        const orderItem = order.orderItems?.find((item:unknown) => item.productName === productName);
        if (orderItem) {
          orders.push({
            orderNumber: order.saleOrderNumber,
            customerName: order.customerInfo?.businessName || '알 수 없음',
            orderDate: order.placedAt,
            quantity: orderItem.quantity,
            amount: orderItem.lineTotal,
            orderPhase: order.orderPhase || 'regular'
          });
        }
      });
    }

    if (!productInfo) return null;

    return {
      ...productInfo,
      suppliers,
      orders
    };
  };

  // 카테고리별 상품 집계 컬럼 정의
  const productAggregationColumns: GridColDef[] = [
    {
      field: 'category',
      headerName: '대분류',
      flex: 0.13,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'productName',
      headerName: `상품명 (${stats.productTypes})`,
      flex: 0.25,
      minWidth: 180
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.19,
      minWidth: 120
    },
    {
      field: 'totalQuantity',
      headerName: `수량 (${stats.productCount.toLocaleString()})`,
      flex: 0.13,
      minWidth: 100,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {params.value?.toLocaleString()}
        </Typography>
      )
    },
    {
      field: 'currentStock',
      headerName: '현재고',
      flex: 0.13,
      minWidth: 100,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: params.row.stockStatus === 'sufficient' ? 'success.main' : 'error.main'
          }}
        >
          {params.value?.toLocaleString()}
        </Typography>
      )
    },
    {
      field: 'totalAmount',
      headerName: '합계금액',
      flex: 0.17,
      minWidth: 120,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString()
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
                  onClick={loadData}
                >
                  매출주문 상품 집계
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={loadData}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>

            {/* 탭 */}
            <Box sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={selectedTab} onChange={handleTabChange}>
                <Tab label={`전체(${tabCounts.all || 0})`} />
                {categories.map(category => (
                  <Tab key={category} label={`${category}(${tabCounts[category] || 0})`} />
                ))}
              </Tabs>
            </Box>
          </Box>

          {/* 통계 패널 */}
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2
            }}>
              {/* 카드 1: 합계 금액 */}
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
                      합계 금액
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {stats.totalAmount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* 카드 2~4: 카테고리별 금액 (최대 3개) */}
              {categories.slice(0, 3).map((category) => (
                <Box key={category} sx={{ flex: 1 }}>
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
                        {category}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {categoryAmounts[category]?.toLocaleString() || '0'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}

              {/* 카테고리가 3개 미만인 경우 빈 카드로 채우기 */}
              {Array.from({ length: Math.max(0, 3 - categories.length) }).map((_, index) => (
                <Box key={`empty-${index}`} sx={{ flex: 1 }}>
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
                        -
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.disabled' }}>
                        -
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 3, pb: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <DataGrid
                rows={productAggregation}
                columns={productAggregationColumns}
                loading={loading}
                disableRowSelectionOnClick
                onRowClick={handleRowClick}
                rowHeight={52}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } },
                  sorting: { sortModel: [{ field: 'category', sort: 'asc' }] }
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
                  '& .MuiDataGrid-cell[data-field="category"]': {
                    justifyContent: 'center',
                  },
                  '& .MuiDataGrid-cell[data-field="totalQuantity"]': {
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-cell[data-field="currentStock"]': {
                    display: 'flex',
                    alignItems: 'center',
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

      {/* 상품 집계 상세 다이얼로그 */}
      <ProductAggregationDetailDialog
        open={dialogOpen}
        product={selectedProduct}
        onClose={handleDialogClose}
      />
    </Box>
  );
};

export default SaleProductAggregationPage;
