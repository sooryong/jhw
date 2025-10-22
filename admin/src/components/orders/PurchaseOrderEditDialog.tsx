/**
 * 파일 경로: /src/components/orders/PurchaseOrderEditDialog.tsx
 * 작성 날짜: 2025-10-19
 * 주요 내용: 매입주문 수정 다이얼로그
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Alert,
  Snackbar
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/purchaseOrder';
import { getPurchaseOrderStatusLabel, getPurchaseOrderStatusColor } from '../../types/purchaseOrder';
import type { Supplier } from '../../types/company';
import type { Product } from '../../types/product';
import type { Timestamp } from 'firebase/firestore';
import { sendMessage } from '../../services/smsService';
import { generatePurchaseOrderMessage } from '../../utils/smsTemplates';
import purchaseOrderService from '../../services/purchaseOrderService';

interface PurchaseOrderEditDialogProps {
  open: boolean;
  purchaseOrder: PurchaseOrder | null;
  onClose: () => void;
  onSendSms?: (purchaseOrderNumber: string) => void;
  onUpdateStatus?: (purchaseOrderNumber: string, status: PurchaseOrder['status']) => void;
  loading?: boolean;
}

const PurchaseOrderEditDialog = ({
  open,
  purchaseOrder,
  onClose,
  loading = false
}: PurchaseOrderEditDialogProps) => {
  const [supplierInfo, setSupplierInfo] = useState<Supplier | null>(null);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [loadingInfo, setLoadingInfo] = useState(false);

  // 현재 상태 (로컬 관리)
  const [currentStatus, setCurrentStatus] = useState<PurchaseOrder['status']>(purchaseOrder?.status || 'placed');

  // 케밥 메뉴
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // SMS 재전송 모달
  const [smsResendModalOpen, setSmsResendModalOpen] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState(false);
  const [selectedSecondary, setSelectedSecondary] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResults, setSmsResults] = useState<{
    primary?: { status: 'pending' | 'success' | 'failed'; error?: string };
    secondary?: { status: 'pending' | 'success' | 'failed'; error?: string };
  }>({});

  // 상태 변경 모달
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'confirmed' | 'pended' | 'cancelled'>('confirmed');
  const [statusChanging, setStatusChanging] = useState(false);

  // 스낵바
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const loadSupplierAndProductInfo = useCallback(async () => {
    if (!purchaseOrder) return;

    setLoadingInfo(true);
    try {
      // 공급사 정보 조회
      const supplierDoc = await getDoc(doc(db, 'suppliers', purchaseOrder.supplierId));
      if (supplierDoc.exists()) {
        setSupplierInfo(supplierDoc.data() as Supplier);
      }

      // 상품 정보 조회 (매입가격 가져오기)
      const productIds = purchaseOrder.orderItems.map(item => item.productId);
      const products = new Map<string, Product>();

      for (const productId of productIds) {
        try {
          const productDoc = await getDoc(doc(db, 'products', productId));
          if (productDoc.exists()) {
            products.set(productId, {
              productId: productDoc.id,
              ...productDoc.data()
            } as Product);
          }
        } catch (error) {
          console.error(`Error loading product ${productId}:`, error);
        }
      }

      setProductMap(products);
    } catch (error) {
      console.error('Error loading info:', error);
    } finally {
      setLoadingInfo(false);
    }
  }, [purchaseOrder]);

  useEffect(() => {
    if (open && purchaseOrder) {
      loadSupplierAndProductInfo();
      setCurrentStatus(purchaseOrder.status);
    }
  }, [open, purchaseOrder, loadSupplierAndProductInfo]);

  // 케밥 메뉴 핸들러
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSmsResendClick = () => {
    handleMenuClose();
    // 모달 열 때 초기화
    setSelectedPrimary(!!purchaseOrder?.supplierInfo?.primaryContact?.mobile);
    setSelectedSecondary(!!purchaseOrder?.supplierInfo?.secondaryContact?.mobile);
    setSmsResults({});
    setSmsResendModalOpen(true);
  };

  const handleStatusChangeClick = () => {
    handleMenuClose();
    // 현재 상태를 선택된 상태로 설정 (로컬 currentStatus 사용)
    if (currentStatus === 'confirmed' || currentStatus === 'pended' || currentStatus === 'cancelled') {
      setSelectedStatus(currentStatus);
    } else {
      setSelectedStatus('confirmed');
    }
    setStatusChangeModalOpen(true);
  };

  // SMS 재전송 핸들러
  const handleSmsResend = async () => {
    if (!purchaseOrder || (!selectedPrimary && !selectedSecondary)) return;

    setSmsSending(true);
    setSmsResults({});

    try {
      const message = generatePurchaseOrderMessage(purchaseOrder);
      const recipients: Array<{ phone: string; name: string }> = [];

      // Primary contact
      if (selectedPrimary && purchaseOrder.supplierInfo?.primaryContact?.mobile) {
        recipients.push({
          phone: purchaseOrder.supplierInfo.primaryContact.mobile,
          name: purchaseOrder.supplierInfo.primaryContact.name || '담당자'
        });
      }

      // Secondary contact
      if (selectedSecondary && purchaseOrder.supplierInfo?.secondaryContact?.mobile) {
        recipients.push({
          phone: purchaseOrder.supplierInfo.secondaryContact.mobile,
          name: purchaseOrder.supplierInfo.secondaryContact.name || '부담당자'
        });
      }

      // Send SMS
      const result = await sendMessage(message, recipients, { messageType: 'purchase_order' });

      // Update results
      const newResults: typeof smsResults = {};

      if (selectedPrimary) {
        const primaryResult = result.results[0];
        newResults.primary = {
          status: primaryResult?.success ? 'success' : 'failed',
          error: primaryResult?.error
        };
      }

      if (selectedSecondary) {
        const secondaryIndex = selectedPrimary ? 1 : 0;
        const secondaryResult = result.results[secondaryIndex];
        newResults.secondary = {
          status: secondaryResult?.success ? 'success' : 'failed',
          error: secondaryResult?.error
        };
      }

      setSmsResults(newResults);

      // Update SMS sent time in DB
      await purchaseOrderService.updateSmsSentTime(
        purchaseOrder.purchaseOrderNumber,
        result.success
      );

      // SMS 발송 성공 시 상태를 'confirmed'로 변경
      if (result.success) {
        await purchaseOrderService.updatePurchaseOrderStatus(
          purchaseOrder.purchaseOrderNumber,
          'confirmed'
        );

        // 로컬 상태도 업데이트
        setCurrentStatus('confirmed');
      }

      setSnackbar({
        open: true,
        message: result.success
          ? `SMS 발송 완료 및 상태 확정됨 (성공: ${result.successCount}명, 실패: ${result.failureCount}명)`
          : `SMS 발송 실패 (성공: ${result.successCount}명, 실패: ${result.failureCount}명)`,
        severity: result.success ? 'success' : 'error'
      });

    } catch (error) {
      console.error('SMS 발송 실패:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'SMS 발송에 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setSmsSending(false);
    }
  };

  // 상태 변경 핸들러
  const handleStatusChange = async () => {
    if (!purchaseOrder) return;

    setStatusChanging(true);

    try {
      await purchaseOrderService.updatePurchaseOrderStatus(
        purchaseOrder.purchaseOrderNumber,
        selectedStatus
      );

      // 로컬 상태 업데이트
      setCurrentStatus(selectedStatus);

      setSnackbar({
        open: true,
        message: `상태가 ${getPurchaseOrderStatusLabel(selectedStatus)}(으)로 변경되었습니다.`,
        severity: 'success'
      });

      // 상태 변경 모달만 닫기 (메인 모달은 유지)
      setStatusChangeModalOpen(false);

      // 부모 컴포넌트 콜백 호출은 하지 않음 (메인 모달을 닫지 않기 위해)
      // 목록 갱신은 메인 모달을 닫을 때 수행됨

    } catch (error) {
      console.error('상태 변경 실패:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setStatusChanging(false);
    }
  };

  if (!purchaseOrder) return null;

  // 상품 목록 데이터 (매입가격이 없으면 상품 정보에서 가져오기)
  const productRows = (purchaseOrder.orderItems || []).map((item: PurchaseOrderItem, index: number) => {
    const product = productMap.get(item.productId);
    const unitPrice = item.unitPrice || product?.purchasePrice || product?.latestPurchasePrice || 0;
    const quantity = item.quantity || 0;
    const subtotal = item.lineTotal || (quantity * unitPrice);

    return {
      id: index,
      productName: item.productName || '-',
      specification: item.specification || '-',
      quantity,
      purchasePrice: unitPrice,
      subtotal
    };
  });

  // 통계 계산
  const totalProductTypes = purchaseOrder.itemCount || 0;
  const totalQuantity = productRows.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = productRows.reduce((sum, item) => sum + item.subtotal, 0);

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

  // 생성일시 포맷 (제목용 - 짧은 형식)
  const formatDateShort = (timestamp: Timestamp | Date | null | undefined) => {
    if (!timestamp) return '-';
    const hasToDate = typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp;
    const date = hasToDate ? (timestamp as Timestamp).toDate() : new Date(timestamp as Date);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // SMS 결과 표시 (3가지 상태: 미발송/성공/실패)
  const getSmsResultChip = () => {
    // SMS 재전송 결과가 있으면 우선 표시
    const hasResults = smsResults.primary || smsResults.secondary;
    if (hasResults) {
      const anySuccess = smsResults.primary?.status === 'success' ||
                         smsResults.secondary?.status === 'success';
      const allFailed = (smsResults.primary?.status === 'failed' || !smsResults.primary) &&
                        (smsResults.secondary?.status === 'failed' || !smsResults.secondary);

      // 1명이라도 성공하면 '성공'
      if (anySuccess) {
        return <Chip label="성공" color="success" size="small" />;
      } else if (allFailed && (smsResults.primary || smsResults.secondary)) {
        return <Chip label="실패" color="error" size="small" />;
      }
    }

    // 기본: purchaseOrder의 status 기반
    if (purchaseOrder.status === 'confirmed') {
      return <Chip label="성공" color="success" size="small" />;
    }
    return <Chip label="미발송" color="default" size="small" />;
  };

  return (
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
          일일식품 매입주문 확정 - {purchaseOrder.purchaseOrderNumber}({formatDateShort(purchaseOrder.placedAt)})
        </Typography>
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
      <DialogContent sx={{ pt: 1 }}>
        {loadingInfo ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* 상단 정보 섹션 */}
            <Box sx={{
              display: 'flex',
              gap: 2,
              mb: 1,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              position: 'relative'
            }}>
              {/* 케밥 메뉴 */}
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8
                }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleSmsResendClick}>SMS 재전송</MenuItem>
                <MenuItem onClick={handleStatusChangeClick}>상태 변경</MenuItem>
              </Menu>

              {/* 공급사 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  공급사
                </Typography>
                <Typography variant="body1">
                  {purchaseOrder.supplierInfo?.businessName || '-'}
                </Typography>
              </Box>

              {/* 대표자 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  대표자
                </Typography>
                <Typography variant="body1">
                  {supplierInfo?.president || '-'}
                </Typography>
              </Box>

              {/* 매입 금액 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  매입 금액
                </Typography>
                <Typography variant="body1" sx={{ color: 'info.main' }}>
                  {totalAmount.toLocaleString()}원
                </Typography>
              </Box>

              {/* SMS결과 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  SMS결과
                </Typography>
                {getSmsResultChip()}
              </Box>

              {/* 상태 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  상태
                </Typography>
                <Chip
                  label={getPurchaseOrderStatusLabel(currentStatus)}
                  color={getPurchaseOrderStatusColor(currentStatus)}
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
                  footer: () => (
                    <GridFooterContainer>
                      <GridPagination />
                    </GridFooterContainer>
                  )
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

      {/* SMS 재전송 모달 */}
      <Dialog
        open={smsResendModalOpen}
        onClose={() => !smsSending && setSmsResendModalOpen(false)}
        maxWidth="sm"
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
            SMS 재전송
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            일일식품 매입주문을 전송하겠습니까?
          </Typography>

          {/* 연락처 선택 및 발송 결과 */}
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* 담당자 */}
            {purchaseOrder?.supplierInfo?.primaryContact?.mobile && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedPrimary}
                      onChange={(e) => setSelectedPrimary(e.target.checked)}
                      disabled={smsSending}
                    />
                  }
                  label={`담당자: ${purchaseOrder.supplierInfo.primaryContact.name || '담당자'} (${purchaseOrder.supplierInfo.primaryContact.mobile})`}
                  sx={{ flex: 1, m: 0 }}
                />
                {smsResults.primary && (
                  <Chip
                    label={smsResults.primary.status === 'success' ? '발송 성공' : '발송 실패'}
                    color={smsResults.primary.status === 'success' ? 'success' : 'error'}
                    size="small"
                  />
                )}
              </Box>
            )}

            {/* 부담당자 */}
            {purchaseOrder?.supplierInfo?.secondaryContact?.mobile && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedSecondary}
                      onChange={(e) => setSelectedSecondary(e.target.checked)}
                      disabled={smsSending}
                    />
                  }
                  label={`부담당자: ${purchaseOrder.supplierInfo.secondaryContact.name || '부담당자'} (${purchaseOrder.supplierInfo.secondaryContact.mobile})`}
                  sx={{ flex: 1, m: 0 }}
                />
                {smsResults.secondary && (
                  <Chip
                    label={smsResults.secondary.status === 'success' ? '발송 성공' : '발송 실패'}
                    color={smsResults.secondary.status === 'success' ? 'success' : 'error'}
                    size="small"
                  />
                )}
              </Box>
            )}
          </Box>

          {/* 버튼 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button
              onClick={() => setSmsResendModalOpen(false)}
              variant="outlined"
              disabled={smsSending}
            >
              닫기
            </Button>
            <Button
              onClick={handleSmsResend}
              variant="contained"
              disabled={smsSending || (!selectedPrimary && !selectedSecondary)}
            >
              {smsSending ? '발송 중...' : '발송'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog
        open={statusChangeModalOpen}
        onClose={() => !statusChanging && setStatusChangeModalOpen(false)}
        maxWidth="sm"
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
            상태 변경
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 2 }}>
          <RadioGroup
            row
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'confirmed' | 'pended' | 'cancelled')}
            sx={{ justifyContent: 'center', gap: 2 }}
          >
            <FormControlLabel
              value="confirmed"
              control={<Radio disabled={statusChanging} />}
              label="확정"
            />
            <FormControlLabel
              value="pended"
              control={<Radio disabled={statusChanging} />}
              label="보류"
            />
            <FormControlLabel
              value="cancelled"
              control={<Radio disabled={statusChanging} />}
              label="취소"
            />
          </RadioGroup>

          {/* 버튼 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button
              onClick={() => setStatusChangeModalOpen(false)}
              variant="outlined"
              disabled={statusChanging}
            >
              취소
            </Button>
            <Button
              onClick={handleStatusChange}
              variant="contained"
              disabled={statusChanging}
            >
              {statusChanging ? '저장 중...' : '저장'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

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

export default PurchaseOrderEditDialog;
