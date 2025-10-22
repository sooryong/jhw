/**
 * 파일 경로: /src/pages/supplier/SupplierListPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 공급사 목록 페이지
 * 관련 데이터: suppliers 컬렉션
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
  IconButton,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { supplierService } from '../../services/supplierService';
import type { Supplier, SupplierFilter } from '../../types/company';
import { formatTelNumber } from '../../utils/formatUtils';

const SupplierListPage: React.FC = () => {
  const navigate = useNavigate();

  // 상태 관리
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션 상태
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // 정렬 상태
  const [sortModel, setSortModel] = useState([
    { field: 'businessName', sort: 'asc' as const },
  ]);

  // 필터 상태
  const [filter, setFilter] = useState<SupplierFilter>({
    isActive: undefined,
    searchText: '',
    page: 0,
    limit: 25
  });

  // 데이터 로드
  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const updatedFilter = {
        ...filter,
        page: paginationModel.page,
        limit: paginationModel.pageSize
      };

      const supplierData = await supplierService.getSuppliers(updatedFilter);
      const countData = await supplierService.getSupplierCount(updatedFilter);

      setSuppliers(supplierData);
      setTotalCount(countData);

    } catch (err) {
      // 오류 처리: 공급사 목록 로드 실패
      setError(err instanceof Error ? err.message : '공급사 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, paginationModel]);

  // 초기 로드 및 필터 변경 시 재로드
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // 필터 변경 핸들러
  const handleFilterChange = (key: keyof SupplierFilter, value: string | boolean | undefined) => {
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
      field: 'primaryContact',
      headerName: '주 담당자',
      flex: 0.13,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.row.primaryContact?.mobile ? formatTelNumber(params.row.primaryContact.mobile) : '-'}
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
    {
      field: 'actions',
      headerName: '수정',
      width: 60,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${encodeURIComponent(params.row.businessNumber)}`);
            }}
            sx={{ color: 'primary.main' }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
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
          <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography
            variant="h4"
            component="h1"
            onClick={loadSuppliers}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            공급사 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/suppliers/new')}
            size="small"
          >
            공급사 추가
          </Button>
          <Button
            variant="outlined"
            onClick={loadSuppliers}
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
              md: '3fr 1fr 1fr'
            },
            gap: 2,
            alignItems: 'center'
          }}>
            {/* 첫 번째 칼럼: 검색창 */}
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

            {/* 두 번째 칼럼: 상태 필터 */}
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
                  <MenuItem value="active">활성만</MenuItem>
                  <MenuItem value="inactive">비활성만</MenuItem>
                </Select>
              </FormControl>
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
            rows={suppliers}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnResize
            paginationMode="server"
            pageSizeOptions={[10, 20, 30, 50]}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            rowCount={totalCount}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            getRowId={(row) => row.businessNumber}
            getRowClassName={(params) =>
              !params.row.isActive ? 'inactive-supplier-row' : ''
            }
            onRowClick={(params) => navigate(`/suppliers/${encodeURIComponent(params.row.businessNumber)}`)}
            sx={{
              border: 0,
              width: '100%',
              height: '100%',
              '& .inactive-supplier-row': {
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

export default SupplierListPage;