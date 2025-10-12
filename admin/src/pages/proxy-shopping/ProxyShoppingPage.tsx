/**
 * 파일 경로: /src/pages/proxy-shopping/ProxyShoppingPage.tsx
 * 작성 날짜: 2025-09-30
 * 주요 내용: 대리 쇼핑 - admin/staff가 고객사를 선택하여 대리 주문
 * 관련 데이터: customers 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  ShoppingCart as ShoppingCartIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import { getOrderCountsByCustomers } from '../../services/saleOrderService';
import type { Customer, CustomerFilter } from '../../types/company';

// SessionStorage 키
const PROXY_SHOPPING_STATE_KEY = 'proxy_shopping_state';
const LAST_SELECTED_CUSTOMER_KEY = 'last_selected_customer';

// SessionStorage에서 이전 상태 복원 (컴포넌트 외부)
const getInitialState = () => {
  try {
    const saved = sessionStorage.getItem(PROXY_SHOPPING_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to restore proxy shopping state:', error);
  }
  return null;
};

const ProxyShoppingPage: React.FC = () => {
  const navigate = useNavigate();

  // 상태 관리
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [customerTypesLoading, setCustomerTypesLoading] = useState(true);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  // 페이지네이션 상태 (저장된 상태가 있으면 복원)
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState(() => {
    const initialState = getInitialState();
    return {
      page: initialState?.paginationModel?.page || 0,
      pageSize: initialState?.paginationModel?.pageSize || 10
    };
  });

  // 필터 상태 (저장된 상태가 있으면 복원)
  const [filter, setFilter] = useState<CustomerFilter>(() => {
    const initialState = getInitialState();
    return {
      isActive: true,
      searchText: initialState?.filter?.searchText || '',
      customerType: initialState?.filter?.customerType,
      page: initialState?.paginationModel?.page || 0,
      limit: initialState?.paginationModel?.pageSize || 10
    };
  });

  // 데이터 로드
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const updatedFilter = {
        ...filter,
        page: paginationModel.page,
        limit: paginationModel.pageSize
      };

      const customerData = await customerService.getCustomers(updatedFilter);
      const countData = await customerService.getCustomerCount(updatedFilter);

      setCustomers(customerData);
      setTotalCount(countData);

      // 주문 수량 로드 (businessNumber는 doc.id와 동일하며, customerId로 사용됨)
      if (customerData.length > 0) {
        const businessNumbers = customerData.map(c => c.businessNumber);
        const counts = await getOrderCountsByCustomers(businessNumbers);
        setOrderCounts(counts);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '고객사 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, paginationModel]);

  // 고객사 유형 로드
  useEffect(() => {
    const loadCustomerTypes = async () => {
      try {
        setCustomerTypesLoading(true);
        const types = await settingsService.getCustomerTypes();
        setCustomerTypes(types);
      } catch {
        // 오류 무시
      } finally {
        setCustomerTypesLoading(false);
      }
    };

    loadCustomerTypes();
  }, []);

  // 초기 로드 및 필터 변경 시 재로드
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // 페이지 포커스 시 주문 수량 재조회 (쇼핑몰에서 돌아왔을 때)
  useEffect(() => {
    const refreshOrderCounts = async () => {
      if (customers.length > 0) {
        try {
          const businessNumbers = customers.map(c => c.businessNumber);
          const counts = await getOrderCountsByCustomers(businessNumbers);
          setOrderCounts(counts);
        } catch (error) {
          console.error('주문 수량 조회 실패:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOrderCounts();
      }
    };

    const handleFocus = () => {
      refreshOrderCounts();
    };

    // visibilitychange와 focus 이벤트 모두 감지
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [customers]);

  // 필터 변경 핸들러
  const handleFilterChange = (key: keyof CustomerFilter, value: string | boolean | undefined) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  // 검색 핸들러
  const handleSearchChange = (value: string) => {
    handleFilterChange('searchText', value);
  };

  // 페이지네이션 핸들러
  const handlePaginationModelChange = (newModel: { page: number; pageSize: number }) => {
    setPaginationModel(newModel);
  };

  // 고객사 선택 시 쇼핑몰로 이동 (동일 탭에서 이동)
  const handleCustomerSelect = (customerRow: Customer) => {
    const { businessNumber, businessName } = customerRow;

    // 고객사 전체 정보를 sessionStorage에 캐싱 (쇼핑몰에서 빠르게 로드)
    const cacheKey = `customer_${businessNumber}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(customerRow));
      sessionStorage.setItem('customer_cache_time', Date.now().toString());
    } catch {
      // 캐싱 실패는 무시 (쇼핑몰에서 재조회됨)
    }

    // 현재 페이지/필터 상태 저장 (돌아왔을 때 복원용)
    try {
      const stateToSave = {
        paginationModel: {
          page: paginationModel.page,
          pageSize: paginationModel.pageSize,
        },
        filter: {
          searchText: filter.searchText,
          customerType: filter.customerType,
        },
      };
      sessionStorage.setItem(PROXY_SHOPPING_STATE_KEY, JSON.stringify(stateToSave));
      sessionStorage.setItem(LAST_SELECTED_CUSTOMER_KEY, businessNumber);
    } catch (error) {
      console.error('Failed to save proxy shopping state:', error);
    }

    const params = new URLSearchParams({
      customer: businessNumber,
      name: businessName || '',
    });
    // v2.0: 쇼핑몰은 별도 앱 (localhost:5174 또는 shop.jws.com)
    const shopUrl = import.meta.env.VITE_SHOP_URL || 'http://localhost:5174';
    window.open(`${shopUrl}/shop?${params.toString()}`, '_blank', 'width=1400,height=900');
  };

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'customerType',
      headerName: '유형',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value}
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.875rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'businessName',
      headerName: '회사명',
      flex: 0.25,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'businessNumber',
      headerName: '사업자번호',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'president',
      headerName: '대표자',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'favoriteProductCount',
      headerName: '즐겨찾기',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const count = params.row.favoriteProducts?.length || 0;
        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: count > 0 ? 600 : 400 }}>
              {count}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'orderCount',
      headerName: '주문수량',
      flex: 0.1,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      valueGetter: (_value, row) => orderCounts[row.businessNumber] || 0,
      renderCell: (params) => {
        const count = orderCounts[params.row.businessNumber] || 0;
        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: count > 0 ? 600 : 400 }}>
              {count}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'action',
      headerName: '대리쇼핑하기',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Button
            variant="contained"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleCustomerSelect(params.row);
            }}
            startIcon={<ShoppingCartIcon />}
          >
            쇼핑
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 헤더 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 3,
        pb: 2,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ShoppingCartIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography
            variant="h4"
            component="h1"
            onClick={loadCustomers}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            대리 쇼핑
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={loadCustomers}
            disabled={loading}
            size="small"
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 검색 및 필터 바 */}
      <Box sx={{ px: 3, flexShrink: 0 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          {/* 3개 칼럼 그리드 헤더 */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 2fr 1fr'
            },
            gap: 2,
            alignItems: 'center'
          }}>
            {/* 첫 번째 칼럼: 고객사 유형 */}
            <Box>
              <FormControl size="small" fullWidth>
                <InputLabel>고객사 유형</InputLabel>
                <Select
                  value={filter.customerType || ''}
                  label="고객사 유형"
                  onChange={(e) => handleFilterChange('customerType', e.target.value || undefined)}
                  disabled={customerTypesLoading}
                >
                  <MenuItem value="">전체</MenuItem>
                  {customerTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 두 번째 칼럼: 검색창 */}
            <Box>
              <TextField
                placeholder="회사명, 대표자, 사업자번호, 연락처로 검색..."
                size="small"
                fullWidth
                value={filter.searchText || ''}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                onChange={(e) => handleSearchChange(e.target.value)}
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

            {/* 세 번째 칼럼: 총개수 텍스트 (우측 정렬) */}
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

      {/* 데이터 그리드 - 남은 공간 모두 사용 */}
      <Box sx={{ px: 3, flex: 1, minHeight: 0 }}>
        <Paper sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <DataGrid
            rows={customers}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnResize
            disableColumnMenu
            paginationMode="server"
            pageSizeOptions={[10, 20, 30]}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            rowCount={totalCount}
            getRowId={(row) => row.businessNumber}
            onRowClick={(params) => handleCustomerSelect(params.row)}
            sx={{
              border: 0,
              width: '100%',
              height: '100%',
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              },
            }}
          />
        </Paper>
      </Box>
    </Box>
  );
};

export default ProxyShoppingPage;