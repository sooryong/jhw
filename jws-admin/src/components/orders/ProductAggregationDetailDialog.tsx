/**
 * 파일 경로: /src/components/orders/ProductAggregationDetailDialog.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 상품 집계 상세 다이얼로그
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Button
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';

interface ProductAggregationDetail {
  productName: string;
  category: string;
  specification: string;
  supplierName: string;
  totalQuantity: number;
  currentStock: number;
  totalAmount: number;
  suppliers: Array<{
    supplierName: string;
    quantity: number;
    amount: number;
  }>;
  orders: Array<{
    orderNumber: string;
    customerName: string;
    orderDate: any;
    quantity: number;
    amount: number;
    orderPhase: 'regular' | 'additional';
  }>;
}

interface ProductAggregationDetailDialogProps {
  open: boolean;
  product: ProductAggregationDetail | null;
  onClose: () => void;
}

const ProductAggregationDetailDialog = ({
  open,
  product,
  onClose
}: ProductAggregationDetailDialogProps) => {
  if (!product) return null;

  // 주문 목록 컬럼 정의
  const orderColumns: GridColDef[] = [
    {
      field: 'orderPhase',
      headerName: '구분',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value === 'regular' ? '정규' : '추가'}
          color={params.value === 'regular' ? 'primary' : 'secondary'}
          size="small"
        />
      )
    },
    {
      field: 'orderNumber',
      headerName: '주문번호',
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'orderDate',
      headerName: '주문일시',
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: any) => {
        if (!value) return '';
        const date = value.toDate ? value.toDate() : new Date(value);
        return date.toLocaleString('ko-KR', {
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
      flex: 0.25,
      minWidth: 150
    },
    {
      field: 'quantity',
      headerName: '수량',
      flex: 0.15,
      minWidth: 80,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => `${value?.toLocaleString()}개`
    },
    {
      field: 'amount',
      headerName: '금액',
      flex: 0.20,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    }
  ];

  // 주문 데이터 (id 추가)
  const ordersWithId = product.orders.map((order, index) => ({
    id: index + 1,
    ...order
  }));

  // 재고 상태
  const stockStatus = product.currentStock >= product.totalQuantity ? 'sufficient' : 'insufficient';
  const stockStatusLabel = stockStatus === 'sufficient' ? '충분' : '부족';
  const stockStatusColor = stockStatus === 'sufficient' ? 'success' : 'error';

  // 커스텀 DataGrid Footer (페이지네이션 + 닫기 버튼)
  const CustomFooter = () => {
    return (
      <GridFooterContainer>
        <GridPagination />
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{ mr: 2 }}
        >
          닫기
        </Button>
      </GridFooterContainer>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            상품 집계 상세: {product.productName}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 상품 기본 정보 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                카테고리
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {product.category}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                상품명
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {product.productName}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                규격
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {product.specification}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                공급사
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {product.supplierName}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                합계수량
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
                  {product.totalQuantity.toLocaleString()}개
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                현재고
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: stockStatus === 'sufficient' ? 'success.main' : 'error.main'
                  }}
                >
                  {product.currentStock.toLocaleString()}개
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                재고상태
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Chip
                  label={stockStatusLabel}
                  color={stockStatusColor}
                  size="small"
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                합계금액
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
                  {product.totalAmount.toLocaleString()}원
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                주문 건수
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {product.orders.length.toLocaleString()}건
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 주문 목록 */}
        <Box>
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={ordersWithId}
              columns={orderColumns}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } }
              }}
              pageSizeOptions={[10, 20, 30]}
              disableRowSelectionOnClick
              rowHeight={52}
              slots={{
                footer: CustomFooter
              }}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiDataGrid-cell': {
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: 'grey.100',
                  borderColor: 'divider',
                },
              }}
            />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ProductAggregationDetailDialog;
