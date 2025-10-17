/**
 * 파일 경로: /src/components/inbound/QuickProductAddDialog.tsx
 * 작성 날짜: 2025-10-13
 * 업데이트: 2025-10-13 (통합 검색 기반 다이얼로그로 리팩토링)
 * 주요 내용: 입고/출하 등록 시 빠른 상품 추가 다이얼로그 (통합)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Box,
  InputAdornment,
  Chip
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { productService } from '../../services/productService';
import type { Product } from '../../types/product';

interface QuickProductAddDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  initialSearchText?: string;  // 초기 검색어 (입고: 공급사명, 출하: 빈 문자열)
  showPurchasePrice?: boolean; // true면 매입가격, false면 판매가격 표시
  mode: 'inbound' | 'outbound'; // 모드 구분
}

const QuickProductAddDialog = ({
  open,
  onClose,
  onSelect,
  initialSearchText = '',
  showPurchasePrice = true,
  mode
}: QuickProductAddDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(initialSearchText);
  const [products, setProducts] = useState<Product[]>([]);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // 전체 활성 상품 로드 (supplierId 필터링 제거)
  const loadAllProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await productService.getProducts({
        isActive: true
      });
      setAllProducts(results);
      setProducts(results);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('상품 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 검색어로 필터링
  useEffect(() => {
    if (!searchText) {
      setProducts(allProducts);
      return;
    }

    const keyword = searchText.toLowerCase();
    const filtered = allProducts.filter(product =>
      product.productName.toLowerCase().includes(keyword) ||
      (product.specification && product.specification.toLowerCase().includes(keyword)) ||
      (product.description && product.description.toLowerCase().includes(keyword))
    );
    setProducts(filtered);
  }, [searchText, allProducts]);

  // 다이얼로그 열릴 때 초기화 및 상품 로드
  useEffect(() => {
    if (open) {
      setSearchText(initialSearchText);
      setProducts([]);
      setAllProducts([]);
      setError(null);
      loadAllProducts();
    }
  }, [open, loadAllProducts, initialSearchText]);

  const handleRowClick = (product: Product) => {
    onSelect(product);
  };

  // DataGrid 칼럼 정의 (모드에 따라 동적 구성)
  const columns: GridColDef[] = [
    {
      field: 'mainCategory',
      headerName: '카테고리',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'productName',
      headerName: '상품명',
      flex: 0.35,
      align: 'left',
      headerAlign: 'left'
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.25,
      align: 'left',
      headerAlign: 'left',
      renderCell: (params) => params.value || '-'
    },
    {
      field: showPurchasePrice ? 'purchasePrice' : 'salePrices',
      headerName: showPurchasePrice ? '최근매입가격' : '판매가격',
      flex: 0.25,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const price = showPurchasePrice
          ? params.row.purchasePrice
          : params.row.salePrices?.standard;
        return (
          <Box sx={{ textAlign: 'right' }}>
            {price ? `${price.toLocaleString()}원` : '-'}
          </Box>
        );
      }
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>상품 빠른 추가</span>
            {mode === 'inbound' && (
              <Chip
                label="입고"
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            {mode === 'outbound' && (
              <Chip
                label="출하"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ mt: 0.5 }}>
            <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {mode === 'inbound'
                ? '공급사명으로 필터링되어 있습니다. 다른 키워드로 변경 가능합니다.'
                : '키워드를 입력하여 전체 상품에서 검색하세요.'}
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 검색창 */}
        <Box sx={{ mb: 2, mt: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="상품명, 규격으로 필터링..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
            autoFocus
          />
        </Box>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 검색 결과 */}
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={products}
            columns={columns}
            getRowId={(row) => row.productId || ''}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            onRowClick={(params) => handleRowClick(params.row as Product)}
            pageSizeOptions={[10, 20, 30]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } }
            }}
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
                  <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    {searchText
                      ? '검색 결과가 없습니다'
                      : '등록된 상품이 없습니다'
                    }
                  </Box>
                </Box>
              ),
              loadingOverlay: () => (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              )
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          취소
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickProductAddDialog;
