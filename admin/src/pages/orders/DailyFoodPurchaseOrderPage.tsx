/**
 * 파일 경로: /src/pages/orders/DailyFoodPurchaseOrderPage.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 일일식품 매입주문 확정 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocalShipping as LocalShippingIcon,
  Send as SendIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import purchaseOrderService from '../../services/purchaseOrderService';
import dailyFoodPurchaseOrderService from '../../services/dailyFoodPurchaseOrderService';
import dailyOrderCycleService from '../../services/dailyOrderCycleService';
import productService from '../../services/productService';
import { supplierService } from '../../services/supplierService';
import PurchaseOrderDetailDialog from '../../components/orders/PurchaseOrderDetailDialog';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import { formatMobile } from '../../utils/numberUtils';

const DailyFoodPurchaseOrderPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<GridRowsProp>([]);
  const [stats, setStats] = useState({ orderCount: 0, productCount: 0, totalAmount: 0 });

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // 원본 주문 데이터 저장
  const [rawOrders, setRawOrders] = useState<PurchaseOrder[]>([]);

  // SMS 발송 상태
  const [sendingSms, setSendingSms] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // SMS 발송 확인 모달
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [smsStats, setSmsStats] = useState({
    success: 0,
    unsent: 0,
    failed: 0,
    total: 0
  });


  useEffect(() => {
    loadData();

    // Firestore 실시간 리스너 설정
    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      const status = await dailyOrderCycleService.getStatus();
      const resetAt = status.resetAt || new Date(new Date().setHours(0, 0, 0, 0));

      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('placedAt', '>=', Timestamp.fromDate(resetAt)),
        where('category', '==', '일일식품')
      );

      unsubscribe = onSnapshot(purchaseOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadData();
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // resetAt 기준 시간 조회
      const cycleStatus = await dailyOrderCycleService.getStatus();
      const resetAt = cycleStatus.resetAt;

      if (!resetAt) {
        // resetAt이 없습니다. 오늘 00:00 기준으로 조회합니다.
      }

      // 일일식품 매입주문 조회
      const orders = await dailyFoodPurchaseOrderService.getOrdersSinceReset(
        resetAt || new Date(new Date().setHours(0, 0, 0, 0))
      );

      // 원본 주문 데이터 저장
      setRawOrders(orders);

      // 주문별 집계 맵 생성
      const orderMap = new Map<string, unknown>();

      for (const order of orders) {
        if (!orderMap.has(order.purchaseOrderNumber)) {
          // 주문의 총 상품 수량 계산
          const totalQuantity = order.orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // 매입금액 계산 (각 상품의 매입단가 × 수량)
          let purchaseAmount = 0;
          for (const item of order.orderItems || []) {
            try {
              // 상품 정보 조회
              const product = await productService.getProduct(item.productId);
              if (product && product.purchasePrice) {
                purchaseAmount += product.purchasePrice * item.quantity;
              }
            } catch (error) {
              console.error(`상품 ${item.productId} 정보 조회 실패:`, error);
            }
          }

          // 공급사 정보 조회 (primaryContact, secondaryContact 가져오기)
          let primaryContactMobile = '';
          let secondaryContactMobile = '';
          try {
            const supplier = await supplierService.getSupplierById(order.supplierId);
            if (supplier?.primaryContact?.mobile) {
              primaryContactMobile = supplier.primaryContact.mobile;
            }
            if (supplier?.secondaryContact?.mobile) {
              secondaryContactMobile = supplier.secondaryContact.mobile;
            }
          } catch (error) {
            console.error(`공급사 ${order.supplierId} 정보 조회 실패:`, error);
          }

          orderMap.set(order.purchaseOrderNumber, {
            orderId: order.purchaseOrderNumber,
            supplierName: order.supplierInfo?.businessName || '알 수 없음',
            primaryContactMobile,
            secondaryContactMobile,
            createdAt: order.placedAt,
            totalQuantity,
            purchaseAmount,
            status: order.status,
            smsSuccess: order.smsSuccess,
            lastSmsSentAt: order.lastSmsSentAt
          });
        }
      }

      // Map을 배열로 변환하고 id 추가
      const ordersList = Array.from(orderMap.values()).map((order, index) => ({
        id: index + 1,
        ...order
      }));

      setPurchaseOrders(ordersList);

      // 통계 계산
      const totalProductCount = ordersList.reduce((sum, order) => sum + (order.totalQuantity || 0), 0);
      const totalAmount = ordersList.reduce((sum, order) => sum + (order.purchaseAmount || 0), 0);

      setStats({
        orderCount: ordersList.length,
        productCount: totalProductCount,
        totalAmount: totalAmount
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 행 클릭 핸들러
  const handleRowClick = (params: { row: { orderId: string } }) => {
    const purchaseOrderNumber = params.row.orderId;
    const order = rawOrders.find(o => o.purchaseOrderNumber === purchaseOrderNumber);
    if (order) {
      setSelectedOrder(order);
      setDialogOpen(true);
    }
  };

  // 다이얼로그 닫기
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
  };

  // SMS 발송 확인 모달 열기
  const handleOpenConfirmDialog = () => {
    if (rawOrders.length === 0) {
      setSnackbar({
        open: true,
        message: '발송할 매입주문이 없습니다.',
        severity: 'error'
      });
      return;
    }

    // 발송 통계 계산
    const successOrders = rawOrders.filter(order => order.smsSuccess === true);
    const unsentOrders = rawOrders.filter(order => order.status === 'placed' && (order.smsSuccess === undefined || order.smsSuccess === null));
    const failedOrders = rawOrders.filter(order => order.status === 'placed' && order.smsSuccess === false);
    const totalToSend = unsentOrders.length + failedOrders.length;

    if (totalToSend === 0) {
      setSnackbar({
        open: true,
        message: '발송 가능한 매입주문이 없습니다.',
        severity: 'error'
      });
      return;
    }

    setSmsStats({
      success: successOrders.length,
      unsent: unsentOrders.length,
      failed: failedOrders.length,
      total: totalToSend
    });

    setConfirmDialogOpen(true);
  };

  // SMS 발송 확인 모달 닫기
  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // 일괄 SMS 발송 (확인 후 실행)
  const handleSendBatchSms = async () => {
    setConfirmDialogOpen(false);

    // placed 상태인 주문만 필터링
    const placedOrders = rawOrders.filter(order => order.status === 'placed');

    setSendingSms(true);
    try {
      const purchaseOrderNumbers = placedOrders.map(order => order.purchaseOrderNumber);
      const result = await purchaseOrderService.sendBatchSms(purchaseOrderNumbers);

      // 성공한 주문은 자동으로 confirmed로 변경
      for (const smsResult of result.results) {
        if (smsResult.success) {
          await purchaseOrderService.updatePurchaseOrderStatus(
            smsResult.purchaseOrderNumber,
            'confirmed'
          );
        }
      }

      setSnackbar({
        open: true,
        message: `SMS 발송 완료: 총 ${result.totalSent}건 중 ${result.totalSuccess}건 성공`,
        severity: result.totalSuccess === result.totalSent ? 'success' : 'info'
      });

      // 데이터 새로고침
      await loadData();
    } catch (error) {
      console.error('SMS 발송 중 오류:', error);
      setSnackbar({
        open: true,
        message: 'SMS 발송 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSendingSms(false);
    }
  };

  // 실패 주문 재발송
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResendFailedSms = async () => {
    // placed 상태이면서 SMS 실패한 주문만 필터링
    const failedOrders = rawOrders.filter(
      order => order.status === 'placed' && order.smsSuccess === false
    );

    if (failedOrders.length === 0) {
      setSnackbar({
        open: true,
        message: '재발송할 실패 주문이 없습니다.',
        severity: 'info'
      });
      return;
    }

    setSendingSms(true);
    try {
      const purchaseOrderNumbers = failedOrders.map(order => order.purchaseOrderNumber);
      const result = await purchaseOrderService.sendBatchSms(purchaseOrderNumbers);

      // 성공한 주문은 자동으로 confirmed로 변경
      for (const smsResult of result.results) {
        if (smsResult.success) {
          await purchaseOrderService.updatePurchaseOrderStatus(
            smsResult.purchaseOrderNumber,
            'confirmed'
          );
        }
      }

      setSnackbar({
        open: true,
        message: `SMS 재발송 완료: 총 ${result.totalSent}건 중 ${result.totalSuccess}건 성공`,
        severity: result.totalSuccess === result.totalSent ? 'success' : 'info'
      });

      // 데이터 새로고침
      await loadData();
    } catch (error) {
      console.error('SMS 재발송 중 오류:', error);
      setSnackbar({
        open: true,
        message: 'SMS 재발송 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSendingSms(false);
    }
  };

  // Snackbar 닫기
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 매입주문 컬럼 정의
  const purchaseOrderColumns: GridColDef[] = [
    {
      field: 'orderId',
      headerName: '주문번호',
      flex: 0.13,
      minWidth: 100,
      align: 'left',
      headerAlign: 'left'
    },
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.20,
      minWidth: 120
    },
    {
      field: 'totalQuantity',
      headerName: '상품수량',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => value?.toLocaleString()
    },
    {
      field: 'purchaseAmount',
      headerName: '금액',
      flex: 0.13,
      minWidth: 90,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => value?.toLocaleString()
    },
    {
      field: 'primaryContactMobile',
      headerName: '담당자',
      flex: 0.14,
      minWidth: 90,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const primary = params.value;
        const secondary = params.row.secondaryContactMobile;

        if (!primary && !secondary) return '-';
        if (!primary) return formatMobile(secondary);

        const displayText = secondary
          ? `${formatMobile(primary)} (+1)`
          : formatMobile(primary);

        return displayText;
      }
    },
    {
      field: 'smsSuccess',
      headerName: 'SMS',
      flex: 0.10,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const smsStatus = params.value === undefined || params.value === null ? 'unsent' : (params.value ? 'success' : 'failed');
        const statusMap = {
          unsent: { label: '대기', color: 'default' as const },
          success: { label: '성공', color: 'info' as const },
          failed: { label: '실패', color: 'warning' as const }
        };
        const status = statusMap[smsStatus];

        return (
          <Chip
            label={status.label}
            color={status.color}
            size="small"
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const statusMap: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' }> = {
          placed: { label: '생성', color: 'warning' },
          pended: { label: '보류', color: 'warning' },
          rejected: { label: '거절', color: 'warning' },
          confirmed: { label: '확정', color: 'info' },
          completed: { label: '입고완료', color: 'success' },
          cancelled: { label: '취소', color: 'default' }
        };
        const status = statusMap[params.value] || { label: params.value, color: 'default' };
        return (
          <Chip
            label={status.label}
            color={status.color}
            size="small"
          />
        );
      }
    },
    {
      field: 'edit',
      headerName: '수정',
      flex: 0.10,
      minWidth: 70,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => {
        return (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick({ row: params.row });
            }}
            sx={{ color: 'primary.main' }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        );
      }
    }
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate('/orders/management')}>
                  <ArrowBackIcon />
                </IconButton>
                <LocalShippingIcon sx={{ fontSize: 32, color: 'info.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  일일식품 매입주문 확정
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={loadData}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 통계 패널 */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* 좌측 카드 - 통계 (75%) */}
              <Box sx={{ width: '75%' }}>
                <Card sx={{ borderLeft: 4, borderColor: 'info.main' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          주문 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {stats.orderCount.toLocaleString()}건
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          상품 수량
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {stats.productCount.toLocaleString()}개
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          매입 금액
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {stats.totalAmount.toLocaleString()}원
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* 우측 카드 - SMS 발송 (25%) */}
              <Box sx={{ width: '25%' }}>
                <Card sx={{ height: '100%', borderLeft: 4, borderColor: 'info.main' }}>
                  <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Button
                      variant="contained"
                      size="medium"
                      fullWidth
                      startIcon={<SendIcon />}
                      onClick={handleOpenConfirmDialog}
                      disabled={sendingSms || loading}
                      color="info"
                    >
                      {sendingSms ? 'SMS 발송 중...' : '전체 SMS 발송'}
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* DataGrid */}
          <Box sx={{ px: 2, pb: 2, flexGrow: 1 }}>
            <Box sx={{ height: 'calc(100vh - 240px)', width: '100%' }}>
              <DataGrid
                rows={purchaseOrders}
                columns={purchaseOrderColumns}
                loading={loading}
                disableRowSelectionOnClick
                onRowClick={handleRowClick}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } },
                  sorting: { sortModel: [{ field: 'createdAt', sort: 'desc' }] }
                }}
                pageSizeOptions={[10, 20, 30]}
                sx={{
                  bgcolor: 'background.paper',
                  '& .MuiDataGrid-cell': {
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: 'grey.100',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-row': {
                    cursor: 'pointer',
                  },
                }}
                slots={{
                  loadingOverlay: () => (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  )
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>

      {/* 매입주문 상세 다이얼로그 */}
      <PurchaseOrderDetailDialog
        open={dialogOpen}
        order={selectedOrder}
        onClose={handleDialogClose}
        onStatusChanged={loadData}
      />

      {/* Snackbar 알림 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* SMS 발송 확인 모달 */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCloseConfirmDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          SMS 발송 확인
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, mb: 2 }}>
              총 주문: {smsStats.success + smsStats.unsent + smsStats.failed}건
            </Typography>
            <Box sx={{ pl: 2, mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                ✅ 성공: {smsStats.success}건 (제외)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                📤 미발송: {smsStats.unsent}건
              </Typography>
              <Typography variant="body2">
                ❌ 실패: {smsStats.failed}건
              </Typography>
            </Box>
            <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                총 {smsStats.total}건을 발송하시겠습니까?
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirmDialog} variant="outlined">
            취소
          </Button>
          <Button onClick={handleSendBatchSms} variant="contained" color="info" autoFocus>
            발송
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DailyFoodPurchaseOrderPage;
