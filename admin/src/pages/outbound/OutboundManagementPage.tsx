/**
 * 파일 경로: /src/pages/outbound/OutboundManagementPage.tsx
 * 작성 날짜: 2025-10-18
 * 주요 내용: 출하 관리 메인 페이지
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  LocalShipping as OutboundIcon,
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import type { SaleOrder } from '../../types/saleOrder';
import { collection, query, where, getDocs, orderBy, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { openPrintCenter } from '../../utils/printUtils';
// import timeRangeService from '../../services/timeRangeService';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';

const OutboundManagementPage = () => {
  const navigate = useNavigate();
  const { cutoffInfo } = useSaleOrderContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // 출하 완료 관련 상태
  const [isAllCompleted, setIsAllCompleted] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');

  // Snackbar 표시 함수 (useEffect보다 먼저 선언)
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  // 실시간 데이터 감시 및 출하 완료 상태 자동 업데이트
  useEffect(() => {
    let unsubscribeOrders: (() => void) | undefined;

    setLoading(true);
    setError(null);

    // cutoffInfo가 없으면 기본값 사용
    const cutoffOpenedAt = cutoffInfo.openedAt || new Date(new Date().setHours(0, 0, 0, 0));
    const isCutoffClosed = cutoffInfo.status === 'closed';

    // 매출주문 목록 실시간 감시
    const setupOrdersListener = () => {
      const ordersQuery = query(
        collection(db, 'saleOrders'),
        where('status', 'in', ['confirmed', 'completed']),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt)),
        orderBy('placedAt', 'desc')
      );

      unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as unknown as SaleOrder));

          setSaleOrders(orders);

          // 출하 완료 여부 확인:
          // 마감 후 (cutoffStatus === 'closed') && confirmed 주문이 0개이면 출하 완료
          const confirmedCount = orders.filter(order => order.status === 'confirmed').length;
          const allCompleted = isCutoffClosed && confirmedCount === 0;

          setIsAllCompleted(allCompleted);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('Error watching sale orders:', error);
          setError('출하 대기 매출주문을 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );
    };

    setupOrdersListener();

    // 클린업: 컴포넌트 언마운트 시 리스너 해제
    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [cutoffInfo]);

  // 추가 주문 발생 시 모달 자동 닫기만 처리 (자동 열기 제거)
  useEffect(() => {
    if (!isAllCompleted && completionModalOpen) {
      // 추가 주문 발생 시 모달 자동 닫기
      setCompletionModalOpen(false);
      showSnackbar('추가 주문이 발생했습니다. 출하를 계속 진행해주세요.', 'info');
    }
  }, [isAllCompleted, completionModalOpen, showSnackbar]);

  // 수동 새로고침용 함수 (필요한 경우)
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // cutoffInfo 사용
      const cutoffOpenedAt = cutoffInfo.openedAt || new Date(new Date().setHours(0, 0, 0, 0));
      const isCutoffClosed = cutoffInfo.status === 'closed';

      // confirmed와 completed 상태의 현재 범위 주문만 조회
      const q = query(
        collection(db, 'saleOrders'),
        where('status', 'in', ['confirmed', 'completed']),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt)),
        orderBy('placedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as SaleOrder));

      setSaleOrders(orders);

      // 출하 완료 여부 확인
      const confirmedCount = orders.filter(order => order.status === 'confirmed').length;
      setIsAllCompleted(isCutoffClosed && confirmedCount === 0);
    } catch (err) {
      console.error('Error loading sale orders:', err);
      setError('출하 대기 매출주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (orderId: string) => {
    openPrintCenter('outbound-inspection', [orderId]);
  };

  const handleInspect = async (order: SaleOrder) => {
    // 완료된 주문이고 매출원장이 있으면 매출원장번호로 이동
    if (order.status === 'completed' && order.saleLedgerId) {
      try {
        const ledgerRef = doc(db, 'saleLedgers', order.saleLedgerId);
        const ledgerDoc = await getDoc(ledgerRef);

        if (ledgerDoc.exists()) {
          const ledger = ledgerDoc.data();
          navigate(`/orders/outbound/inspect/${ledger.saleLedgerNumber}`);
          return;
        }
      } catch (error) {
        console.error('Error fetching sale ledger:', error);
      }
    }

    // 그 외의 경우 매출주문번호로 이동
    navigate(`/orders/outbound/inspect/${order.saleOrderNumber}`);
  };

  const handlePrintAll = () => {
    if (saleOrders.length > 0) {
      const allOrderIds = saleOrders.map(order => order.saleOrderNumber);
      openPrintCenter('outbound-inspection', allOrderIds);
    }
  };

  const getSaleOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return '확정';
      case 'completed': return '출하완료';
      default: return status;
    }
  };

  const getSaleOrderStatusColor = (status: string): 'primary' | 'success' | 'default' => {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  // 주문 마감 버튼 클릭 핸들러
  const handleOpenCompletionModal = () => {
    if (!isAllCompleted) {
      showSnackbar('아직 출하되지 않은 주문이 있습니다.', 'warning');
      return;
    }
    setCompletionModalOpen(true);
  };

  // 출하 완료 처리 핸들러
  const handleCompletionModalClose = () => {
    setCompletionModalOpen(false);
  };

  const handleCompleteConfirm = async () => {
    setCompletionModalOpen(false);
    setLoading(true);

    try {
      // 데이터 새로고침
      await loadData();

      showSnackbar('모든 출하가 완료되었습니다.', 'success');
    } catch (error) {
      console.error('Error completing outbound:', error);
      showSnackbar('출하 완료 확인 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'saleOrderNumber',
      headerName: '매출주문 코드',
      flex: 0.15,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.10,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={getSaleOrderStatusLabel(params.value)}
            size="small"
            color={getSaleOrderStatusColor(params.value)}
            variant="outlined"
          />
        </Box>
      )
    },
    {
      field: 'customerName',
      headerName: '고객사',
      flex: 0.25,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'productTypes',
      headerName: '상품 종류',
      flex: 0.10,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value}종
          </Typography>
        </Box>
      )
    },
    {
      field: 'totalQuantity',
      headerName: '상품 수량',
      flex: 0.10,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value.toLocaleString()}개
          </Typography>
        </Box>
      )
    },
    {
      field: 'print',
      headerName: '검수표',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => {
        const order = params.row as SaleOrder;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={(e) => {
                e.stopPropagation();
                handlePrint(order.saleOrderNumber);
              }}
            >
              인쇄
            </Button>
          </Box>
        );
      }
    },
    {
      field: 'outbound',
      headerName: '출하 등록',
      flex: 0.15,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params) => {
        const order = params.row as SaleOrder;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Button
              variant={order.status === 'completed' ? 'outlined' : 'contained'}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleInspect(order);
              }}
            >
              {order.status === 'completed' ? '보기' : '출하'}
            </Button>
          </Box>
        );
      }
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <OutboundIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            매출주문 출하
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={handlePrintAll}
            startIcon={<PrintIcon />}
            disabled={saleOrders.length === 0}
          >
            검수표 전체 인쇄
          </Button>
          <Button variant="outlined" onClick={loadData} startIcon={<RefreshIcon />}>
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 로딩 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 에러 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 매출주문 목록 */}
      {!loading && !error && (
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={saleOrders.map(order => ({
              ...order,
              customerName: order.customerInfo.businessName,
              productTypes: order.orderItems.length,
              totalQuantity: order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
            }))}
            columns={columns}
            getRowId={(row) => row.saleOrderNumber}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            paginationMode="client"
            pageSizeOptions={[10, 20, 30]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            onRowClick={(params) => handleInspect(params.row as SaleOrder)}
            sx={{
              '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
              },
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
            }}
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <OutboundIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    출하 대기 중인 매출주문이 없습니다.
                  </Typography>
                </Box>
              ),
              loadingOverlay: () => (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              )
            }}
          />
        </Paper>
      )}

      {/* 출하 완료 모달 */}
      <Dialog
        open={completionModalOpen}
        onClose={handleCompletionModalClose}
        maxWidth="sm"
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 6
          }
        }}
      >
        <DialogTitle sx={{
          textAlign: 'center',
          pt: 4,
          pb: 2,
          bgcolor: 'success.main',
          color: 'white'
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ fontSize: 64 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              모든 출하가 완료되었습니다!
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              주문 출하를 완료하고 새로운 사이클을 시작하세요.
            </Typography>
          </Alert>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 모든 매출주문의 출하가 완료되었습니다.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 주문 사이클이 마감되고 새로운 사이클이 시작됩니다.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1.5, color: 'text.primary' }}>
              ✓ 이후 생성되는 주문은 다음 사이클의 정규 주문으로 분류됩니다.
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚠️ 이 작업은 되돌릴 수 없습니다!
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 2 }}>
          <Button
            onClick={handleCompletionModalClose}
            variant="outlined"
            size="large"
            sx={{ minWidth: 120 }}
          >
            취소
          </Button>
          <Button
            onClick={handleCompleteConfirm}
            variant="contained"
            color="error"
            size="large"
            startIcon={<CheckCircleIcon />}
            autoFocus
            sx={{
              minWidth: 200,
              fontWeight: 600
            }}
          >
            주문 마감
          </Button>
        </DialogActions>
      </Dialog>

      {/* 우측하단 주문 마감 버튼 */}
      <Button
        variant="contained"
        color="error"
        size="large"
        onClick={handleOpenCompletionModal}
        startIcon={<CheckCircleIcon />}
        disabled={!isAllCompleted}
        sx={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          fontWeight: 600,
          minWidth: 200,
          boxShadow: 4,
          '&:hover': {
            boxShadow: 8
          }
        }}
      >
        주문 마감
      </Button>

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
    </Container>
  );
};

export default OutboundManagementPage;
