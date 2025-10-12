/**
 * 파일 경로: /src/pages/orders/ProductAggregationPage.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 카테고리별 상품 집계 페이지 (재고 포함)
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
import {
  ArrowBack as ArrowBackIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import dailySaleOrderAggregationService from '../../services/dailySaleOrderAggregationService';
import ProductAggregationDetailDialog from '../../components/orders/ProductAggregationDetailDialog';

const ProductAggregationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [productAggregation, setProductAggregation] = useState<GridRowsProp>([]);
  const [allProducts, setAllProducts] = useState<GridRowsProp>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState(0); // 0: 전체, 1~: 각 카테고리
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ productTypes: 0, productCount: 0, totalAmount: 0 });

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // 전체 집계 데이터 (상세 정보용)
  const [aggregationData, setAggregationData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dailySaleOrderAggregationService.getActiveOrderAggregationData();
      setAggregationData(data); // 전체 데이터 저장

      // 카테고리별 상품 집계 생성
      const productList: any[] = [];
      const categorySet = new Set<string>();
      let productId = 0;

      Object.keys(data.categories).forEach(category => {
        categorySet.add(category);

        data.categories[category].suppliers.forEach(supplier => {
          supplier.products.forEach(product => {
            const totalQuantity = product.placedQuantity + product.confirmedQuantity;
            const totalAmount = product.placedAmount + product.confirmedAmount;

            if (totalQuantity > 0) {
              productId++;
              const currentStock = (product as any).currentStock || 0;
              productList.push({
                id: productId,
                category: category,
                productName: product.productName,
                productId: (product as any).productCode,
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

      const sortedCategories = Array.from(categorySet).sort();
      setCategories(sortedCategories);

      // 탭 카운트 계산
      const counts: Record<string, number> = {
        all: productList.length
      };
      sortedCategories.forEach(category => {
        counts[category] = productList.filter(p => p.category === category).length;
      });
      setTabCounts(counts);

      // 초기 통계 계산 (전체)
      const totalQuantity = productList.reduce((sum, p) => sum + p.totalQuantity, 0);
      const initialStats = {
        productTypes: productList.length,
        productCount: totalQuantity,
        totalAmount: productList.reduce((sum, p) => sum + p.totalAmount, 0)
      };
      setStats(initialStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);

    let filteredProducts: any[];
    if (newValue === 0) {
      filteredProducts = allProducts as any[];
    } else {
      const category = categories[newValue - 1];
      filteredProducts = (allProducts as any[]).filter(p => p.category === category);
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
  const handleRowClick = (params: any) => {
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
  const extractProductDetail = (data: any, category: string, productName: string) => {
    if (!data || !data.categories || !data.categories[category]) return null;

    const categoryData = data.categories[category];
    let productInfo: any = null;
    const suppliers: any[] = [];
    const orders: any[] = [];
    let firstSupplierName = '';

    // 공급사별 상품 정보 수집
    categoryData.suppliers.forEach((supplier: any) => {
      const product = supplier.products.find((p: any) => p.productName === productName);
      if (product) {
        if (!productInfo) {
          firstSupplierName = supplier.supplierName;
          productInfo = {
            productName: product.productName,
            productCode: product.productCode,
            category: category,
            specification: product.specification || '-',
            supplierName: firstSupplierName,
            totalQuantity: product.placedQuantity + product.confirmedQuantity,
            currentStock: product.currentStock || 0,
            totalAmount: product.placedAmount + product.confirmedAmount
          };
        }

        // 공급사 정보 추가
        suppliers.push({
          supplierName: supplier.supplierName,
          quantity: product.placedQuantity + product.confirmedQuantity,
          amount: product.placedAmount + product.confirmedAmount
        });
      }
    });

    // 주문 정보 수집
    if (data.orders) {
      data.orders.forEach((order: any) => {
        const orderItem = order.orderItems?.find((item: any) => item.productName === productName);
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
      headerName: '카테고리',
      flex: 0.13,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'productName',
      headerName: '상품명',
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
      headerName: '수량',
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
      valueFormatter: (value: any) => value?.toLocaleString()
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
                <InventoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  매출주문 상품 집계
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
                          상품 종류
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {stats.productTypes.toLocaleString()}종
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          상품 수량
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {stats.productCount.toLocaleString()}개
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          합계 금액
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
                      startIcon={<ReceiptIcon />}
                      onClick={() => navigate('/orders/customer-orders')}
                    >
                      매출주문 확인
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* 탭 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Tabs value={selectedTab} onChange={handleTabChange}>
              <Tab label={`전체(${tabCounts.all || 0})`} />
              {categories.map(category => (
                <Tab key={category} label={`${category}(${tabCounts[category] || 0})`} />
              ))}
            </Tabs>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 340px)', width: '100%' }}>
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

export default ProductAggregationPage;
