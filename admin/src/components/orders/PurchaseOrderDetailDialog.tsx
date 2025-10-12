/**
 * 파일 경로: /src/components/orders/PurchaseOrderDetailDialog.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 매입주문 상세 다이얼로그
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { Close as CloseIcon, Send as SendIcon } from '@mui/icons-material';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import purchaseOrderService from '../../services/purchaseOrderService';
import productService from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';

interface PurchaseOrderDetailDialogProps {
  open: boolean;
  order: PurchaseOrder | null;
  onClose: () => void;
  onStatusChanged?: () => void;
}

const PurchaseOrderDetailDialog = ({
  open,
  order,
  onClose,
  onStatusChanged
}: PurchaseOrderDetailDialogProps) => {
  const { isAdmin, isStaff } = useAuth();
  const [sendingSms, setSendingSms] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(order?.status || 'placed');
  const [processing, setProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [orderItemsWithPrice, setOrderItemsWithPrice] = useState<Array<any>>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // order가 변경될 때 currentStatus 동기화
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);
    }
  }, [order]);

  // 각 상품의 매입단가를 조회하여 orderItems에 추가
  useEffect(() => {
    const fetchPrices = async () => {
      if (!order) return;

      setLoadingPrices(true);
      const itemsWithPrice = await Promise.all(
        order.orderItems.map(async (item, index) => {
          try {
            const product = await productService.getProduct(item.productId);
            const unitPrice = product?.purchasePrice || 0;
            const lineTotal = unitPrice * item.quantity;

            return {
              id: index + 1,
              ...item,
              category: order.category,
              unitPrice,
              lineTotal
            };
          } catch (error) {
            console.error(`상품 ${item.productId} 정보 조회 실패:`, error);
            return {
              id: index + 1,
              ...item,
              category: order.category,
              unitPrice: 0,
              lineTotal: 0
            };
          }
        })
      );

      setOrderItemsWithPrice(itemsWithPrice);
      setLoadingPrices(false);
    };

    if (order && open) {
      fetchPrices();
    }
  }, [order, open]);

  if (!order) return null;

  // 상태 변경 권한 확인
  const canChangeStatus = isAdmin() || isStaff();

  // 상태 변경 함수
  const handleStatusChange = async (newStatus: string) => {
    if (processing || newStatus === currentStatus) return;

    setProcessing(true);

    try {
      await purchaseOrderService.updatePurchaseOrderStatus(
        order.purchaseOrderNumber,
        newStatus as PurchaseOrder['status']
      );
      setCurrentStatus(newStatus as PurchaseOrder['status']);

      const statusMessages: Record<string, string> = {
        placed: '주문이 발주되었습니다.',
        confirmed: '주문이 확정되었습니다.',
        pended: '주문이 보류되었습니다.',
        cancelled: '주문이 취소되었습니다.',
        completed: '주문이 입고 완료되었습니다.'
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
      setSnackbar({
        open: true,
        message: error.message || '상태 변경에 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // 주문 품목 컬럼 정의
  const orderItemColumns: GridColDef[] = [
    {
      field: 'category',
      headerName: '카테고리',
      flex: 0.15,
      minWidth: 100
    },
    {
      field: 'productName',
      headerName: '상품명',
      flex: 0.30,
      minWidth: 180
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.20,
      minWidth: 100
    },
    {
      field: 'quantity',
      headerName: '수량',
      flex: 0.12,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'unitPrice',
      headerName: '매입가격',
      flex: 0.12,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    },
    {
      field: 'lineTotal',
      headerName: '소계',
      flex: 0.12,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => value?.toLocaleString()
    }
  ];

  // 합계 계산
  const totalQuantity = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = orderItemsWithPrice.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 커스텀 DataGrid Footer (페이지네이션 + SMS 재발송/닫기 버튼)
  const CustomFooter = () => {
    return (
      <GridFooterContainer>
        <GridPagination />
        <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
          {/* placed 상태이고 SMS 실패한 경우에만 재발송 버튼 표시 */}
          {order.status === 'placed' && order.smsSuccess === false && (
            <Button
              onClick={handleResendSms}
              variant="contained"
              color="info"
              size="small"
              startIcon={sendingSms ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              disabled={sendingSms}
            >
              {sendingSms ? '발송 중...' : 'SMS 재발송'}
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="outlined"
            size="small"
          >
            닫기
          </Button>
        </Box>
      </GridFooterContainer>
    );
  };

  // 개별 SMS 재발송
  const handleResendSms = async () => {
    if (!order) return;

    setSendingSms(true);
    try {
      const result = await purchaseOrderService.sendBatchSms([order.purchaseOrderNumber]);

      if (result.results[0]?.success) {
        // SMS 성공 시 자동 confirmed 처리
        await purchaseOrderService.updatePurchaseOrderStatus(
          order.purchaseOrderNumber,
          'confirmed'
        );

        setSnackbar({
          open: true,
          message: 'SMS 발송 및 주문 확정이 완료되었습니다.',
          severity: 'success'
        });

        // 상태 변경 알림
        if (onStatusChanged) {
          onStatusChanged();
        }

        // 다이얼로그 닫기
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setSnackbar({
          open: true,
          message: `SMS 발송 실패: ${result.results[0]?.error || '알 수 없는 오류'}`,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('SMS 재발송 중 오류:', error);
      setSnackbar({
        open: true,
        message: 'SMS 발송 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSendingSms(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2, fontWeight: 600 }}>
        매입주문 상세: {order.purchaseOrderNumber}
        <Button
          onClick={onClose}
          size="small"
          sx={{ minWidth: 'auto', p: 0.5 }}
        >
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent dividers>
        {/* 주문 정보 (1줄 배치) */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start', mb: 3 }}>
          {/* 매입주문번호 */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              매입주문번호
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {order.purchaseOrderNumber}
              </Typography>
            </Box>
          </Box>

          {/* 발주일시 */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              발주일시
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {formatDate(order.placedAt)}
              </Typography>
            </Box>
          </Box>

          {/* 공급사 */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              공급사
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {order.supplierInfo.businessName}
              </Typography>
            </Box>
          </Box>

          {/* SMS 수신자 - 세로 배치 */}
          {order.supplierInfo.smsRecipients && order.supplierInfo.smsRecipients.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                SMS 수신자
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: '42px', justifyContent: 'center' }}>
                {order.supplierInfo.smsRecipients.map((recipient, index) => (
                  <Typography key={index} variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {recipient.name}: {recipient.mobile}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {/* 상품 종류 */}
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

          {/* 상품 수량 */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              상품 수량
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {totalQuantity.toLocaleString()}개
              </Typography>
            </Box>
          </Box>

          {/* 금액 */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              금액
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
                {totalAmount.toLocaleString()}원
              </Typography>
            </Box>
          </Box>

          {/* 상태 - 라디오버튼 */}
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
                value="cancelled"
                control={<Radio size="small" />}
                label="취소"
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

        {/* DataGrid - 주문 품목 */}
        <Box sx={{ width: '100%', height: 400 }}>
          <DataGrid
            rows={orderItemsWithPrice}
            columns={orderItemColumns}
            loading={loadingPrices}
            pagination
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } }
            }}
            disableRowSelectionOnClick
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
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              },
              '& .MuiDataGrid-cell:focus-within': {
                outline: 'none'
              }
            }}
          />
        </Box>
      </DialogContent>

      {/* Snackbar 알림 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default PurchaseOrderDetailDialog;
