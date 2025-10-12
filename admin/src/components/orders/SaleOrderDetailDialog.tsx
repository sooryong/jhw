/**
 * 파일 경로: /src/components/orders/SaleOrderDetailDialog.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 매출주문 상세 다이얼로그
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
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert,
  Button
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import type { SaleOrder } from '../../types/saleOrder';
import { useAuth } from '../../contexts/AuthContext';
import { updateSaleOrderStatus } from '../../services/saleOrderService';

interface SaleOrderDetailDialogProps {
  open: boolean;
  order: SaleOrder | null;
  onClose: () => void;
  onStatusChanged?: () => void;
}

const SaleOrderDetailDialog = ({
  open,
  order,
  onClose,
  onStatusChanged
}: SaleOrderDetailDialogProps) => {
  const { isAdmin, isStaff } = useAuth();

  // 상태 변경
  const [currentStatus, setCurrentStatus] = useState(order?.status || 'confirmed');
  const [processing, setProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // order가 변경될 때 currentStatus 동기화
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);
    }
  }, [order]);

  if (!order) return null;

  // 주문 상품 컬럼 정의
  const orderItemColumns: GridColDef[] = [
    {
      field: 'productName',
      headerName: '상품명',
      flex: 0.35,
      minWidth: 200
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.20,
      minWidth: 120
    },
    {
      field: 'quantity',
      headerName: '수량',
      flex: 0.15,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'unitPrice',
      headerName: '단가',
      flex: 0.15,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'lineTotal',
      headerName: '소계',
      flex: 0.15,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    }
  ];

  // 주문 상품 데이터 (id 추가)
  const orderItemsWithId = order.orderItems.map((item, index) => ({
    id: index + 1,
    ...item
  }));

  // 합계 계산
  const totalQuantity = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // 상태 레이블 및 색상
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
      placed: { label: '접수', color: 'default' },
      confirmed: { label: '확정', color: 'primary' },
      completed: { label: '완료', color: 'success' },
      pended: { label: '검토대기', color: 'warning' },
      rejected: { label: '거부', color: 'error' },
      cancelled: { label: '취소', color: 'error' }
    };
    return statusMap[status] || { label: status, color: 'default' };
  };

  const statusInfo = getStatusInfo(order.status);

  // 주문 단계 (정규/추가)
  const orderPhaseLabel = order.orderPhase === 'regular' ? '정규' : '추가';
  const orderPhaseColor = order.orderPhase === 'regular' ? 'primary' : 'secondary';

  // 주문 일시 포맷
  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // 상태 변경 함수
  const handleStatusChange = async (newStatus: string) => {
    if (processing || newStatus === currentStatus) return;

    setProcessing(true);

    try {
      await updateSaleOrderStatus(order.saleOrderNumber, newStatus as 'confirmed' | 'pended' | 'rejected');
      setCurrentStatus(newStatus as 'confirmed' | 'pended' | 'rejected' | 'completed' | 'placed' | 'cancelled');

      const statusMessages: Record<string, string> = {
        confirmed: '주문이 확정되었습니다.',
        pended: '주문이 보류되었습니다.',
        rejected: '주문이 거절되었습니다.'
      };

      setSnackbar({
        open: true,
        message: statusMessages[newStatus] || '주문 상태가 변경되었습니다.',
        severity: 'success'
      });

      // 성공 후 콜백 호출
      setTimeout(() => {
        if (onStatusChanged) {
          onStatusChanged();
        }
      }, 500);
    } catch (error: any) {
      console.error('상태 변경 실패:', error);
      setSnackbar({ open: true, message: error.message || '상태 변경에 실패했습니다.', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // 상태 변경 권한 확인
  const canChangeStatus = isAdmin() || isStaff();

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
            주문 상세: {order.saleOrderNumber}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 주문 기본 정보 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* 좌측: 기본 정보 필드들 */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  구분
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Chip
                    label={orderPhaseLabel}
                    color={orderPhaseColor}
                    size="small"
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  주문번호
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {order.saleOrderNumber}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  고객사
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {order.customerInfo.businessName}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  주문일시
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {formatDate(order.placedAt)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  상품 종류
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {order.itemCount.toLocaleString()}종
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  총 수량
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {totalQuantity.toLocaleString()}개
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  주문금액
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
                    {order.finalAmount.toLocaleString()}원
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  상태
                </Typography>
                <RadioGroup
                  row
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <FormControlLabel
                    value="confirmed"
                    control={<Radio size="small" />}
                    label="확정"
                    disabled={!canChangeStatus || processing}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 600 } }}
                  />
                  <FormControlLabel
                    value="pended"
                    control={<Radio size="small" />}
                    label="보류"
                    disabled={!canChangeStatus || processing}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 600 } }}
                  />
                  <FormControlLabel
                    value="rejected"
                    control={<Radio size="small" />}
                    label="거절"
                    disabled={!canChangeStatus || processing}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 600 } }}
                  />
                </RadioGroup>
                {processing && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    처리 중...
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 주문 상품 목록 */}
        <Box>
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={orderItemsWithId}
              columns={orderItemColumns}
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
        </Box>
      </DialogContent>

      {/* 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default SaleOrderDetailDialog;
