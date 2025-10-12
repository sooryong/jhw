/**
 * 파일 경로: /src/pages/customer/CustomerListPage.tsx
 * 작성 날짜: 2025-09-24
 * 주요 내용: 고객사 목록 페이지
 * 관련 데이터: customers 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  People as PeopleIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import type { Customer, CustomerFilter } from '../../types/company';
import { formatPhone, formatTelNumber } from '../../utils/formatUtils';

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();

  // 상태 관리
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [customerTypesLoading, setCustomerTypesLoading] = useState(true);

  // 페이지네이션 상태
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // 필터 상태
  const [filter, setFilter] = useState<CustomerFilter>({
    isActive: undefined,
    searchText: '',
    page: 0,
    limit: 25
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

    } catch (err) {
      // 오류 처리: 고객사 목록 로드 실패
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
        // 오류 처리: 고객사 유형 로드 실패
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

  // 필터 변경 핸들러
  const handleFilterChange = (key: keyof CustomerFilter, value: string | boolean | undefined) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  // 검색 핸들러 (디바운스 적용)
  const handleSearchChange = (value: string) => {
    const timer = setTimeout(() => {
      handleFilterChange('searchText', value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // 페이지네이션 핸들러
  const handlePaginationModelChange = (newModel: { page: number; pageSize: number }) => {
    setPaginationModel(newModel);
  };

  // 데이터그리드 컬럼 정의
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
      align: 'left',
      headerAlign: 'left',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="flex-start" height="100%">
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
      field: 'phone',
      headerName: '전화번호',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.row.businessPhone ? formatTelNumber(params.row.businessPhone) : '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'smsMobile',
      headerName: 'SMS 휴대폰',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.row.smsRecipient?.person1?.mobile ? formatPhone(params.row.smsRecipient.person1.mobile) : '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'isActive',
      headerName: '상태',
      flex: 0.10,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value ? '활성' : '비활성'}
            size="small"
            color={params.value ? 'success' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.875rem' }}
          />
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
          <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
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
            고객사 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/customers/new')}
            size="small"
          >
            고객사 추가
          </Button>
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

            {/* 세 번째 칼럼: 상태 필터 */}
            <Box>
              <FormControl size="small" fullWidth>
                <InputLabel>상태</InputLabel>
                <Select
                  value={filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'inactive'}
                  label="상태"
                  onChange={(e) => {
                    const value = e.target.value;
                    const isActiveValue = value === 'all' ? undefined : value === 'active' ? true : false;
                    handleFilterChange('isActive', isActiveValue);
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
            getRowClassName={(params) =>
              !params.row.isActive ? 'inactive-customer-row' : ''
            }
            onRowClick={(params) => navigate(`/customers/${encodeURIComponent(params.row.businessNumber)}`)}
            sx={{
              border: 0,
              width: '100%',
              height: '100%',
              '& .inactive-customer-row': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                opacity: 0.7,
                '& .MuiDataGrid-cell': {
                  color: 'text.secondary',
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  opacity: 0.8,
                },
              },
              '& .MuiDataGrid-root': {
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
              },
              '& .MuiDataGrid-main': {
                width: '100%',
                overflow: 'hidden',
              },
              '& .MuiDataGrid-virtualScroller': {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'auto',
              },
              '& .MuiDataGrid-columnHeaders': {
                width: '100%',
                minWidth: 'unset !important',
              },
              '& .MuiDataGrid-row': {
                width: '100%',
                maxWidth: '100%',
                minWidth: 'unset !important',
              },
              '& .MuiDataGrid-cell': {
                minWidth: 'unset !important',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '8px 4px',
              },
              '& .MuiDataGrid-columnHeader': {
                minWidth: 'unset !important',
                padding: '8px 4px',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'action.hover',
                cursor: 'pointer',
              },
              '& .MuiDataGrid-scrollArea': {
                width: '0px !important',
              },
            }}
            slotProps={{
              loadingOverlay: {
                variant: 'skeleton',
                noRowsVariant: 'skeleton',
              },
            }}
          />
        </Paper>
      </Box>
    </Box>
  );
};

export default CustomerListPage;