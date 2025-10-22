/**
 * 파일 경로: /src/components/orders/SupplierPurchaseOrderDetailDialog.tsx
 * 작성 날짜: 2025-10-19
 * 주요 내용: 공급사별 매입주문 생성 전 상세보기 다이얼로그
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  CircularProgress,
  Chip
} from '@mui/material';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { SupplierAggregation } from '../../types/orderAggregation';
import type { Supplier } from '../../types/company';

interface SupplierPurchaseOrderDetailDialogProps {
  open: boolean;
  supplier: SupplierAggregation | null;
  onClose: () => void;
  onCreatePurchaseOrder?: (supplier: SupplierAggregation) => void;
  loading?: boolean;
  cutoffStatus?: string;
}

const SupplierPurchaseOrderDetailDialog = ({
  open,
  supplier,
  onClose,
  onCreatePurchaseOrder,
  loading = false,
  cutoffStatus
}: SupplierPurchaseOrderDetailDialogProps) => {
  const [supplierInfo, setSupplierInfo] = useState<Supplier | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const loadSupplierInfo = useCallback(async () => {
    if (!supplier) return;

    setLoadingInfo(true);
    try {
      const supplierDoc = await getDoc(doc(db, 'suppliers', supplier.supplierId));
      if (supplierDoc.exists()) {
        setSupplierInfo(supplierDoc.data() as Supplier);
      }
    } catch (error) {
      console.error('Error loading supplier info:', error);
    } finally {
      setLoadingInfo(false);
    }
  }, [supplier]);

  useEffect(() => {
    if (open && supplier) {
      loadSupplierInfo();
    }
  }, [open, supplier, loadSupplierInfo]);

  // 매입주문 생성 버튼 클릭
  const handleCreateClick = () => {
    setConfirmDialogOpen(true);
  };

  // 확인 다이얼로그에서 확인 클릭
  const handleConfirmCreate = () => {
    setConfirmDialogOpen(false);
    if (onCreatePurchaseOrder && supplier) {
      onCreatePurchaseOrder(supplier);
    }
  };

  // 확인 다이얼로그 취소
  const handleCancelCreate = () => {
    setConfirmDialogOpen(false);
  };

  if (!supplier) return null;

  // 상품 목록 데이터 (소계를 수량 × 매입가격으로 계산)
  const productRows = supplier.products.map((product, index) => {
    const quantity = product.totalQuantity;
    const purchasePrice = product.unitPrice || 0;
    const subtotal = quantity * purchasePrice;

    return {
      id: index,
      productName: product.productName,
      specification: product.specification || '-',
      quantity,
      purchasePrice,
      subtotal
    };
  });

  // 통계 계산 (재계산된 소계 기준)
  const totalProductTypes = supplier.products.length;
  const totalQuantity = productRows.reduce((sum, p) => sum + p.quantity, 0);
  const totalAmount = productRows.reduce((sum, p) => sum + p.subtotal, 0);

  // 커스텀 DataGrid Footer (페이지네이션만)
  const CustomFooter = () => {
    return (
      <GridFooterContainer>
        <GridPagination />
      </GridFooterContainer>
    );
  };

  // 상품 목록 컬럼 정의
  const productColumns: GridColDef[] = [
    {
      field: 'productName',
      headerName: `상품명 (${totalProductTypes})`,
      flex: 0.3,
      minWidth: 180
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.2,
      minWidth: 120
    },
    {
      field: 'quantity',
      headerName: `수량 (${totalQuantity.toLocaleString()})`,
      flex: 0.15,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'purchasePrice',
      headerName: '매입가격',
      flex: 0.15,
      minWidth: 100,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'subtotal',
      headerName: '소계',
      flex: 0.2,
      minWidth: 120,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    }
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{
          fontWeight: 600,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
            일일식품 매입주문 생성 - {supplierInfo?.businessNumber || supplier.supplierId}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleCreateClick}
              variant="contained"
              disabled={loading || supplier.hasPurchaseOrder || cutoffStatus !== 'closed'}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': { bgcolor: 'grey.100' }
              }}
            >
              일일식품 매입주문 생성
            </Button>
            <Button
              onClick={onClose}
              variant="outlined"
              disabled={loading}
              sx={{
                color: 'white',
                borderColor: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              닫기
            </Button>
          </Box>
        </Box>
      <DialogContent sx={{ pt: 1 }}>
        {loadingInfo ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* 가로 배치: 상호, 대표자, 매입 금액, 상태 */}
            <Box sx={{
              display: 'flex',
              gap: 2,
              mb: 1,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1
            }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  상호
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {supplierInfo?.businessName || supplier.supplierName}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  대표자
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {supplierInfo?.president || '-'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  매입 금액
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {totalAmount.toLocaleString()}원
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  상태
                </Typography>
                <Chip
                  label={supplier.hasPurchaseOrder ? '생성' : '집계'}
                  color={supplier.hasPurchaseOrder ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>

            {/* 상품 목록 */}
            <Box sx={{ height: 400, width: '100%' }}>
              <DataGrid
                rows={productRows}
                columns={productColumns}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } }
                }}
                pageSizeOptions={[10, 20, 30]}
                disableRowSelectionOnClick
                rowHeight={38}
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
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* 확인 다이얼로그 */}
    <Dialog
      open={confirmDialogOpen}
      onClose={handleCancelCreate}
    >
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          일일식품 매입주문을 생성하시겠습니까?
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button
            onClick={handleCancelCreate}
            variant="outlined"
            disabled={loading}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirmCreate}
            variant="contained"
            disabled={loading}
          >
            확인
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default SupplierPurchaseOrderDetailDialog;
