/**
 * 파일 경로: /src/pages/product/ProductListPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 목록 페이지
 * 관련 데이터: products 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Inventory as ProductIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { productService } from '../../services/productService';
import { supplierService } from '../../services/supplierService';
import { settingsService } from '../../services/settingsService';
import type { Product, ProductFilter } from '../../types/product';
import type { Supplier } from '../../types/company';
import { stockUtils } from '../../types/product';

const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터 확인
  const selectMode = searchParams.get('mode') === 'select';
  const returnTo = searchParams.get('returnTo');
  const filterSupplierId = searchParams.get('supplierId');

  // 상태
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션 상태
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // 필터
  const [filter, setFilter] = useState<ProductFilter>({
    isActive: true,
    searchText: '',
    mainCategory: '',
    supplierId: filterSupplierId || '',
    lowStock: false,
    page: 0,
    limit: 25
  });

  // 데이터 로드
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const updatedFilter = {
        ...filter,
        page: paginationModel.page,
        limit: paginationModel.pageSize
      };

      const productData = await productService.getProducts(updatedFilter);
      const countData = await productService.getProductCount(updatedFilter);

      setProducts(productData);
      setTotalCount(countData);

    } catch (error) {
      // Error handled silently
      // 오류 처리: 상품 목록 로드 실패
      setError('상품 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, paginationModel]);

  // 공급사 목록 로드
  const loadSuppliers = useCallback(async () => {
    try {
      const supplierData = await supplierService.getSuppliers({ isActive: true });
      setSuppliers(supplierData);
    } catch (error) {
      // Error handled silently
      // 오류 처리: 공급사 목록 로드 실패
    }
  }, []);

  // 카테고리 목록 로드
  const loadCategories = useCallback(async () => {
    try {
      const categoryData = await settingsService.getProductCategories();
      setCategories(categoryData);
    } catch (error) {
      // Error handled silently
      // 오류 처리: 카테고리 목록 로드 실패
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // 필터 변경 핸들러
  const handleFilterChange = (field: keyof ProductFilter, value: string | boolean | undefined) => {
    setFilter(prev => ({ ...prev, [field]: value }));
  };


  // 상품 상세보기
  const handleViewProduct = (productId: string) => {
    navigate(`/products/${productId}`);
  };

  // 상품 선택 (Select 모드)
  const handleSelectProduct = (product: Product) => {
    // sessionStorage에 선택된 상품 저장
    sessionStorage.setItem('selectedProductForInbound', JSON.stringify(product));

    // returnTo URL로 이동
    if (returnTo) {
      navigate(returnTo);
    }
  };

  // 공급사명 찾기
  const getSupplierName = (supplierId: string): string => {
    if (!supplierId) return '-';

    // 하이픈 포함 사업자번호로 직접 비교
    const supplier = suppliers.find(s => s.businessNumber === supplierId);
    return supplier ? supplier.businessName : '-';
  };

  // DataGrid 컬럼 정의
  const baseColumns: GridColDef[] = [
    {
      field: 'mainCategory',
      headerName: '카테고리',
      flex: 0.11,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          <Typography variant="body2">{params.value || '-'}</Typography>
          {params.row.subCategory && (
            <Typography variant="caption" color="text.secondary">
              {params.row.subCategory}
            </Typography>
          )}
        </Box>
      )
    },
    {
      field: 'productName',
      headerName: '상품명',
      flex: 0.2,
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
          <Typography variant="body2" fontWeight="medium" noWrap>
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.15,
      align: 'left',
      headerAlign: 'left',
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.value || '-'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'supplierId',
      headerName: '공급사',
      flex: 0.2,
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      valueGetter: (_value, row) => getSupplierName(row?.supplierId || ''),
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
          <Typography variant="body2" noWrap>
            {getSupplierName(params.row?.supplierId || '')}
          </Typography>
        </Box>
      )
    },
    {
      field: 'stockQuantity',
      headerName: '재고',
      flex: 0.1,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params) => {
        const value = params.value ?? 0;
        const status = stockUtils.getStockStatus(value, params.row.minimumStock);
        const color = stockUtils.getStockStatusColor(status);

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', height: '100%' }}>
            <Typography
              variant="body2"
              color={color === 'error' ? 'error.main' : color === 'warning' ? 'warning.main' : 'text.primary'}
              fontWeight={status !== 'safe' ? 'bold' : 'medium'}
            >
              {value.toLocaleString()}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'purchasePrice',
      headerName: '매입가(원)',
      flex: 0.12,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', height: '100%' }}>
          <Typography variant="body2">
            {params.value !== undefined && params.value !== null ? params.value.toLocaleString() : '-'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'salePrices',
      headerName: '표준판가(원)',
      flex: 0.12,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', height: '100%' }}>
          <Typography variant="body2">
            {params.value.standard.toLocaleString()}
          </Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: '수정',
      width: 60,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/products/${params.row.productId}`);
          }}
          sx={{ color: 'primary.main' }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    }
  ];

  // 선택 모드일 때 액션 칼럼 추가
  const columns: GridColDef[] = selectMode
    ? [
        ...baseColumns,
        {
          field: 'actions',
          headerName: '작업',
          width: 100,
          align: 'center',
          headerAlign: 'center',
          sortable: false,
          renderCell: (params) => (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleSelectProduct(params.row)}
            >
              선택
            </Button>
          )
        }
      ]
    : baseColumns;

  // 페이지네이션 핸들러
  const handlePaginationModelChange = (newModel: { page: number; pageSize: number }) => {
    setPaginationModel(newModel);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <Box sx={{ p: 3, pb: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectMode && returnTo && (
              <Box
                onClick={() => navigate(returnTo)}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  '&:hover': { opacity: 0.7 }
                }}
              >
                <BackIcon />
              </Box>
            )}
            <ProductIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography
              variant="h4"
              component="h1"
              onClick={loadProducts}
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {selectMode ? '상품 선택' : '상품 관리'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!selectMode && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/products/new')}
                size="small"
              >
                상품 추가
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={loadProducts}
              disabled={loading}
              size="small"
            >
              새로고침
            </Button>
          </Box>
        </Box>

        {/* 필터 */}
        <Paper sx={{ p: 2, mb: 2 }}>
          {/* 4개 칼럼 그리드 헤더 */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 2fr 1fr 1fr'
            },
            gap: 2,
            alignItems: 'center'
          }}>
            {/* 첫 번째 칼럼: 카테고리 필터 */}
            <Box>
              <FormControl size="small" fullWidth>
                <InputLabel>카테고리</InputLabel>
                <Select
                  value={filter.mainCategory || ''}
                  label="카테고리"
                  onChange={(e) => handleFilterChange('mainCategory', e.target.value)}
                >
                  <MenuItem value="">전체</MenuItem>
                  {categories.map((category, index) => (
                    <MenuItem key={index} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 두 번째 칼럼: 검색창 */}
            <Box>
              <TextField
                size="small"
                fullWidth
                placeholder="상품명, 사양, 설명으로 검색..."
                value={filter.searchText}
                onChange={(e) => {
                  handleFilterChange('searchText', e.target.value);
                  // 실시간 검색을 위해 즉시 검색 실행
                  if (e.target.value.length === 0 || e.target.value.length >= 2) {
                    setTimeout(() => loadProducts(), 300); // 300ms 디바운스
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      border: '1px solid #e0e0e0',
                    },
                    '&:hover fieldset': {
                      border: '1px solid #bdbdbd',
                    },
                    '&.Mui-focused fieldset': {
                      border: '2px solid #1976d2',
                    },
                  },
                }}
              />
            </Box>

            {/* 세 번째 칼럼: 상태 필터 */}
            <Box>
              <FormControl size="small" fullWidth>
                <InputLabel>상태</InputLabel>
                <Select
                  value={filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'inactive'}
                  label="상태"
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange('isActive', value === 'all' ? undefined : value === 'active');
                  }}
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="active">활성</MenuItem>
                  <MenuItem value="inactive">비활성</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* 네 번째 칼럼: 총개수 텍스트 (우측 정렬) */}
            <Box sx={{
              display: 'flex',
              justifyContent: {
                xs: 'flex-start',
                md: 'flex-end'
              },
              alignItems: 'center'
            }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
총 {totalCount}개
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* 데이터 그리드 */}
      <Box sx={{ flex: 1, px: 3, pb: 3, minHeight: 0 }}>
        <Paper sx={{ height: '100%', width: '100%' }}>
          <DataGrid
            rows={products}
            columns={columns}
            getRowId={(row) => row.productId || ''}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            paginationMode="server"
            pageSizeOptions={[10, 20, 30]}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            rowCount={totalCount}
            onRowClick={(params) => handleViewProduct(params.id as string)}
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
                  <ProductIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    등록된 상품이 없습니다
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    상품 추가 버튼을 클릭하여 새 상품을 추가해보세요
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
  );
};

export default ProductListPage;