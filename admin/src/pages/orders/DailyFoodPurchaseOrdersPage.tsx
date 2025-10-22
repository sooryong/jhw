/**
 * 파일 경로: /src/pages/orders/DailyFoodPurchaseOrdersPage.tsx
 * 작성 날짜: 2025-10-19
 * 주요 내용: 일일식품 매입 발주 목록 페이지
 *   - 생성된 PO 목록 표시 (status='placed')
 *   - 개별/일괄 SMS 발송 및 확정
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Chip,
  Container,
  Dialog,
  DialogContent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import dailyFoodPurchaseOrderService from '../../services/dailyFoodPurchaseOrderService';
import purchaseOrderService from '../../services/purchaseOrderService';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/purchaseOrder';
import { getPurchaseOrderStatusLabel, getPurchaseOrderStatusColor } from '../../types/purchaseOrder';
import { useAuth } from '../../hooks/useAuth';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';
import PurchaseOrderEditDialog from '../../components/orders/PurchaseOrderEditDialog';

const DailyFoodPurchaseOrdersPage = () => {

  const { user } = useAuth();
  const { cutoffInfo } = useSaleOrderContext();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState({ count: 0, productTypes: 0, productCount: 0, totalAmount: 0, confirmedCount: 0 });

  // 집계 마감 상태 (cutoffInfo에서 가져옴)
  const cutoffStatus = cutoffInfo.status;

  // 스낵바
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // 다이얼로그
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [batchSmsDialogOpen, setBatchSmsDialogOpen] = useState(false);

  // SMS 일괄 발송 상태 관리
  type SmsStatus = 'pending' | 'sending' | 'success' | 'failed';
  const [smsStatuses, setSmsStatuses] = useState<Map<string, {
    primaryStatus: SmsStatus;
    secondaryStatus: SmsStatus;
    error?: string;
  }>>(new Map());
  const [smsSending, setSmsSending] = useState(false);
  const [smsCompleted, setSmsCompleted] = useState(false);
  const [batchSmsTargets, setBatchSmsTargets] = useState<PurchaseOrder[]>([]);

  const loadPurchaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      // 오늘 생성된 일일식품 매입주문 조회
      const orders = await dailyFoodPurchaseOrderService.getTodayOrders();

      setPurchaseOrders(orders);

      // 통계 계산
      let totalProductTypes = 0;
      let totalProductCount = 0;
      let totalAmount = 0;
      let confirmedCount = 0;

      orders.forEach(order => {
        totalProductTypes += order.itemCount || 0;
        if (order.status === 'confirmed') {
          confirmedCount++;
        }
        order.orderItems?.forEach((item: PurchaseOrderItem) => {
          totalProductCount += item.quantity || 0;
          totalAmount += (item.quantity || 0) * (item.unitPrice || 0);
        });
      });

      setStats({
        count: orders.length,
        productTypes: totalProductTypes,
        productCount: totalProductCount,
        totalAmount: totalAmount,
        confirmedCount: confirmedCount
      });
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      showSnackbar('매입주문 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchaseOrders();

    // Firestore 실시간 리스너 설정
    let purchaseOrdersUnsubscribe: (() => void) | null = null;

    const setupListeners = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 오늘 생성된 일일식품 PO 리스닝
      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('category', '==', '일일식품'),
        where('placedAt', '>=', Timestamp.fromDate(today))
      );

      purchaseOrdersUnsubscribe = onSnapshot(purchaseOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadPurchaseOrders();
        }
      });
    };

    setupListeners();

    return () => {
      if (purchaseOrdersUnsubscribe) {
        purchaseOrdersUnsubscribe();
      }
    };
  }, [loadPurchaseOrders]);

  // 스낵바 표시
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 수정 다이얼로그 열기
  const handleEditPurchaseOrder = (po: PurchaseOrder) => {
    setSelectedPurchaseOrder(po);
    setEditDialogOpen(true);
  };

  // 수정 다이얼로그 닫기
  const handleEditDialogClose = async () => {
    setEditDialogOpen(false);
    setSelectedPurchaseOrder(null);
    // 모달을 닫을 때 목록 갱신 (상태 변경 반영)
    await loadPurchaseOrders();
  };

  // 다이얼로그에서 SMS 전송
  const handleDialogSendSms = async (purchaseOrderNumber: string) => {
    const po = purchaseOrders.find(p => p.purchaseOrderNumber === purchaseOrderNumber);
    if (po) {
      await handleSendSingleSMS(purchaseOrderNumber, po.supplierInfo?.businessName || '공급사');
      handleEditDialogClose();
    }
  };

  // 다이얼로그에서 상태 변경
  const handleDialogUpdateStatus = async (purchaseOrderNumber: string, newStatus: PurchaseOrder['status']) => {
    setLoading(true);
    try {
      await purchaseOrderService.updatePurchaseOrderStatus(purchaseOrderNumber, newStatus);
      showSnackbar(`상태가 ${newStatus === 'confirmed' ? '확정' : '대기'}으로 변경되었습니다.`, 'success');
      await loadPurchaseOrders();
      handleEditDialogClose();
    } catch (error) {
      console.error('Error updating status:', error);
      showSnackbar('상태 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 개별 SMS 발송 및 확정
  const handleSendSingleSMS = async (purchaseOrderNumber: string, supplierName: string) => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    if (cutoffStatus !== 'closed') {
      showSnackbar('집계 마감 후 SMS를 발송할 수 있습니다.', 'error');
      return;
    }

    setLoading(true);
    try {
      // SMS 발송
      const result = await dailyFoodPurchaseOrderService.sendBatchSms([purchaseOrderNumber]);

      if (result.totalSuccess > 0) {
        // SMS 발송 성공 시 상태를 confirmed로 변경
        await purchaseOrderService.updatePurchaseOrderStatus(purchaseOrderNumber, 'confirmed');

        showSnackbar(
          `${supplierName}의 매입주문(${purchaseOrderNumber})이 발송되고 확정되었습니다.`,
          'success'
        );

        // 데이터 다시 로드
        await loadPurchaseOrders();
      } else {
        showSnackbar(`SMS 발송 실패: ${result.results[0]?.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      const errorMessage = error instanceof Error ? error.message : 'SMS 발송 중 오류가 발생했습니다.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 일괄 SMS 발송 모달 열기
  const handleBatchSmsClick = () => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    if (cutoffStatus !== 'closed') {
      showSnackbar('집계 마감 후 SMS를 발송할 수 있습니다.', 'error');
      return;
    }

    const placedOrders = purchaseOrders.filter(po => po.status === 'placed');

    if (placedOrders.length === 0) {
      showSnackbar('발송할 매입주문이 없습니다.', 'error');
      return;
    }

    // 상태 초기화 및 발송 대상 저장
    const initialStatuses = new Map();
    placedOrders.forEach(po => {
      initialStatuses.set(po.purchaseOrderNumber, {
        primaryStatus: 'pending' as SmsStatus,
        secondaryStatus: 'pending' as SmsStatus
      });
    });
    setSmsStatuses(initialStatuses);
    setSmsSending(false);
    setSmsCompleted(false);
    setBatchSmsTargets([...placedOrders]); // 발송 대상 목록 저장

    setBatchSmsDialogOpen(true);
  };

  // 일괄 SMS 발송 확인 (순차 발송 + 실시간 상태 업데이트)
  const handleConfirmBatchSMS = async () => {
    const placedOrders = purchaseOrders.filter(po => po.status === 'placed');

    setSmsSending(true);
    setLoading(true);

    try {
      // 순차적으로 SMS 발송
      for (const po of placedOrders) {
        const purchaseOrderNumber = po.purchaseOrderNumber;

        // 발송 중 상태로 변경
        setSmsStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(purchaseOrderNumber, {
            primaryStatus: 'sending',
            secondaryStatus: 'sending'
          });
          return newMap;
        });

        try {
          // SMS 발송
          const result = await dailyFoodPurchaseOrderService.sendBatchSms([purchaseOrderNumber]);

          if (result.totalSuccess > 0) {
            // 성공
            setSmsStatuses(prev => {
              const newMap = new Map(prev);
              newMap.set(purchaseOrderNumber, {
                primaryStatus: 'success',
                secondaryStatus: 'success'
              });
              return newMap;
            });

            // 상태를 confirmed로 변경
            await purchaseOrderService.updatePurchaseOrderStatus(purchaseOrderNumber, 'confirmed');
          } else {
            // 실패
            setSmsStatuses(prev => {
              const newMap = new Map(prev);
              newMap.set(purchaseOrderNumber, {
                primaryStatus: 'failed',
                secondaryStatus: 'failed',
                error: result.results[0]?.error || '발송 실패'
              });
              return newMap;
            });
          }
        } catch (error) {
          // 에러 발생
          const errorMessage = error instanceof Error ? error.message : '발송 실패';
          setSmsStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(purchaseOrderNumber, {
              primaryStatus: 'failed',
              secondaryStatus: 'failed',
              error: errorMessage
            });
            return newMap;
          });
        }
      }

      // 데이터 다시 로드
      await loadPurchaseOrders();

      // 완료 상태로 변경
      setSmsCompleted(true);

    } catch (error) {
      console.error('Error sending batch SMS:', error);
      const errorMessage = error instanceof Error ? error.message : 'SMS 일괄 발송 중 오류가 발생했습니다.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
      setSmsSending(false);
    }
  };

  // 일괄 SMS 발송 모달 닫기
  const handleBatchSmsDialogClose = () => {
    if (!smsSending) {
      setBatchSmsDialogOpen(false);
    }
  };

  // DataGrid 행 데이터 생성
  const getRows = () => {
    return purchaseOrders.map((po, index) => ({
      id: po.purchaseOrderNumber || index,
      purchaseOrderNumber: po.purchaseOrderNumber,
      supplierName: po.supplierInfo?.businessName || '-',
      itemCount: po.itemCount || 0,
      totalQuantity: po.orderItems?.reduce((sum: number, item: PurchaseOrderItem) => sum + (item.quantity || 0), 0) || 0,
      totalAmount: po.orderItems?.reduce((sum: number, item: PurchaseOrderItem) =>
        sum + (item.quantity || 0) * (item.unitPrice || 0), 0) || 0,
      smsSuccess: po.smsSuccess,
      status: po.status,
      confirmedAt: po.confirmedAt,
      purchaseOrder: po
    }));
  };

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'purchaseOrderNumber',
      headerName: '매입주문 번호',
      flex: 0.15,
      minWidth: 120
    },
    {
      field: 'supplierName',
      headerName: '공급사',
      flex: 0.23,
      minWidth: 120
    },
    {
      field: 'itemCount',
      headerName: `상품 종류 (${stats.productTypes})`,
      flex: 0.12,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalQuantity',
      headerName: `상품 수량 (${stats.productCount.toLocaleString()})`,
      flex: 0.12,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'totalAmount',
      headerName: '매입 금액',
      flex: 0.12,
      minWidth: 110,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'smsSuccess',
      headerName: 'SMS결과',
      flex: 0.10,
      minWidth: 90,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const smsSuccess = params.value;

        if (smsSuccess === undefined || smsSuccess === null) {
          return <Chip label="미발송" color="default" size="small" />;
        } else if (smsSuccess === true) {
          return <Chip label="발송완료" color="success" size="small" />;
        } else {
          return <Chip label="발송실패" color="error" size="small" />;
        }
      }
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      minWidth: 90,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value as PurchaseOrder['status'];
        const label = getPurchaseOrderStatusLabel(status);
        const color = getPurchaseOrderStatusColor(status);

        return <Chip label={label} color={color} size="small" />;
      }
    },
    {
      field: 'edit',
      headerName: '확정',
      flex: 0.10,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => (
        <IconButton
          color="primary"
          size="small"
          onClick={() => handleEditPurchaseOrder(params.row.purchaseOrder)}
          disabled={loading}
          title="매입주문 관리"
        >
          <EditIcon />
        </IconButton>
      )
    }
  ];

  const placedOrdersCount = purchaseOrders.filter(po => po.status === 'placed').length;

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8f9fa'
          }}
        >
          {/* 헤더 */}
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' }
                  }}
                  onClick={loadPurchaseOrders}
                >
                  일일식품 매입 발주
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleBatchSmsClick}
                  disabled={loading || placedOrdersCount === 0 || cutoffStatus !== 'closed'}
                >
                  SMS 일괄 발송 ({placedOrdersCount}건)
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={loadPurchaseOrders}
                  disabled={loading}
                >
                  새로고침
                </Button>
              </Box>
            </Box>
          </Box>

          {/* 통계 패널 - 3개 카드 */}
          <Box sx={{ px: 3, pb: 2 }}>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2
        }}>
          {/* 카드 1: 생성 건수 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  생성 건수
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {stats.count.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* 카드 2: 매입 금액 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  매입 금액
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {stats.totalAmount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* 카드 3: 확정 건수 */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent sx={{
                py: 2,
                px: 3,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60
              }}>
                <Typography variant="body2" color="text.secondary">
                  확정 건수
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {stats.confirmedCount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

          {/* DataGrid - 매입주문 목록 */}
          <Box sx={{ px: 3, pb: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <DataGrid
                rows={getRows()}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } },
                  sorting: { sortModel: [{ field: 'purchaseOrderNumber', sort: 'asc' }] }
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
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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

      {/* 매입주문 수정 다이얼로그 */}
      <PurchaseOrderEditDialog
        open={editDialogOpen}
        purchaseOrder={selectedPurchaseOrder}
        onClose={handleEditDialogClose}
        onSendSms={handleDialogSendSms}
        onUpdateStatus={handleDialogUpdateStatus}
        loading={loading}
      />

      {/* SMS 일괄 발송 확인 모달 */}
      <Dialog
        open={batchSmsDialogOpen}
        onClose={handleBatchSmsDialogClose}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            일일식품 매입주문 일괄 발송
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!smsCompleted && (
              <>
                <Button
                  onClick={handleBatchSmsDialogClose}
                  variant="outlined"
                  disabled={smsSending}
                  sx={{
                    color: 'white',
                    borderColor: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmBatchSMS}
                  variant="contained"
                  disabled={smsSending}
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'grey.100' }
                  }}
                >
                  {smsSending ? <CircularProgress size={20} /> : '발송'}
                </Button>
              </>
            )}
            {smsCompleted && (
              <Button
                onClick={handleBatchSmsDialogClose}
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                닫기
              </Button>
            )}
          </Box>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          {/* 안내 메시지 */}
          <Typography variant="body1" sx={{ mb: 2 }}>
            {placedOrdersCount}건의 매입주문서를 공급사에 일괄 발송하시겠습니까?
          </Typography>

          {/* 발송 대상 목록 (DataGrid) */}
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={batchSmsTargets
                .map((po, index) => ({
                  id: index,
                  purchaseOrderNumber: po.purchaseOrderNumber,
                  businessName: po.supplierInfo?.businessName || '-',
                  mainMobile: po.supplierInfo?.primaryContact?.mobile || '-',
                  subMobile: po.supplierInfo?.secondaryContact?.mobile || '-',
                  primaryStatus: smsStatuses.get(po.purchaseOrderNumber)?.primaryStatus || 'pending',
                  secondaryStatus: smsStatuses.get(po.purchaseOrderNumber)?.secondaryStatus || 'pending',
                  error: smsStatuses.get(po.purchaseOrderNumber)?.error
                }))}
              columns={[
                {
                  field: 'purchaseOrderNumber',
                  headerName: '매입주문번호',
                  flex: 0.18,
                  minWidth: 120
                },
                {
                  field: 'businessName',
                  headerName: '상호',
                  flex: 0.30,
                  minWidth: 120
                },
                {
                  field: 'mainMobile',
                  headerName: '주담당자 휴대폰',
                  flex: 0.13,
                  minWidth: 120,
                  align: 'center',
                  headerAlign: 'center'
                },
                {
                  field: 'primaryStatus',
                  headerName: 'SMS결과',
                  flex: 0.13,
                  minWidth: 100,
                  align: 'center',
                  headerAlign: 'center',
                  renderCell: (params) => {
                    const status = params.value as SmsStatus;

                    if (status === 'pending') {
                      return <Chip label="대기" color="default" size="small" />;
                    } else if (status === 'sending') {
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CircularProgress size={16} />
                          <Chip label="발송중" color="info" size="small" />
                        </Box>
                      );
                    } else if (status === 'success') {
                      return <Chip label="성공" color="success" size="small" />;
                    } else {
                      return <Chip label="실패" color="error" size="small" />;
                    }
                  }
                },
                {
                  field: 'subMobile',
                  headerName: '부담당자 휴대폰',
                  flex: 0.13,
                  minWidth: 120,
                  align: 'center',
                  headerAlign: 'center'
                },
                {
                  field: 'secondaryStatus',
                  headerName: 'SMS결과',
                  flex: 0.13,
                  minWidth: 100,
                  align: 'center',
                  headerAlign: 'center',
                  renderCell: (params) => {
                    const status = params.value as SmsStatus;
                    const subMobile = params.row.subMobile;

                    // 부담당자가 없으면 표시 안 함
                    if (subMobile === '-') {
                      return <Typography variant="caption" color="text.secondary">-</Typography>;
                    }

                    if (status === 'pending') {
                      return <Chip label="대기" color="default" size="small" />;
                    } else if (status === 'sending') {
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CircularProgress size={16} />
                          <Chip label="발송중" color="info" size="small" />
                        </Box>
                      );
                    } else if (status === 'success') {
                      return <Chip label="성공" color="success" size="small" />;
                    } else {
                      return <Chip label="실패" color="error" size="small" />;
                    }
                  }
                }
              ]}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } }
              }}
              pageSizeOptions={[5, 10, 20]}
              disableRowSelectionOnClick
              rowHeight={38}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiDataGrid-columnHeaders': {
                  display: 'none'
                },
                '& .MuiDataGrid-virtualScroller': {
                  marginTop: '0 !important'
                },
                '& .MuiDataGrid-cell': {
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-row': {
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DailyFoodPurchaseOrdersPage;
