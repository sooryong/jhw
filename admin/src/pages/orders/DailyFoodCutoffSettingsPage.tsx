/**
 * 파일 경로: /src/pages/orders/DailyFoodCutoffSettingsPage.tsx
 * 작성 날짜: 2025-10-18
 * 업데이트: 2025-10-20 (파일명 및 함수명 변경)
 * 주요 내용: 일일식품 마감 설정 페이지
 *   - 하단 좌: 일일식품 집계 마감 제어
 *   - 하단 우: 매입주문 발주 현황
 * 관련 데이터: saleOrders, purchaseOrders, cutoff
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import cutoffService from '../../services/cutoffService';
// import dailyFoodPurchaseAggregationService from '../../services/dailyFoodPurchaseAggregationService';
import { useAuth } from '../../hooks/useAuth';
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/purchaseOrder';

const DailyFoodCutoffSettingsPage = () => {

  const { user } = useAuth();
  const { orderStats: saleOrderStats, cutoffInfo, refreshData: contextRefreshData } = useSaleOrderContext();
  const [loading, setLoading] = useState(false);

  // 마감 상태는 Context에서 가져온 것 사용
  const cutoffStatus = cutoffInfo.status;
  const cutoffOpenedAt = cutoffInfo.openedAt;
  const cutoffClosedAt = cutoffInfo.closedAt;

  // 매입주문 집계만 로컬에서 관리
  const [purchaseOrderStats, setPurchaseOrderStats] = useState({ count: 0, quantity: 0, amount: 0, placed: 0, confirmed: 0 });

  // 다이얼로그
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // 스낵바
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // cutoffOpenedAt이 변경될 때마다 매입주문 데이터 로드
  useEffect(() => {
    loadPurchaseOrderStats();

    // Firestore 실시간 리스너 설정 (매입주문만)
    let unsubscribePurchaseOrders: (() => void) | null = null;

    const setupListener = async () => {
      if (!cutoffOpenedAt) return;

      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('category', '==', '일일식품'),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt))
      );

      unsubscribePurchaseOrders = onSnapshot(purchaseOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadPurchaseOrderStats();
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribePurchaseOrders) unsubscribePurchaseOrders();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoffOpenedAt]);

  const loadPurchaseOrderStats = async () => {
    if (!cutoffOpenedAt) {
      setPurchaseOrderStats({
        count: 0,
        quantity: 0,
        amount: 0,
        placed: 0,
        confirmed: 0
      });
      return;
    }

    setLoading(true);
    try {
      const purchaseOrdersQuery = query(
        collection(db, 'purchaseOrders'),
        where('category', '==', '일일식품'),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt))
      );

      const purchaseSnapshot = await getDocs(purchaseOrdersQuery);
      const purchaseOrders = purchaseSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseOrder[];

      let totalPurchaseQuantity = 0;
      let totalPurchaseAmount = 0;
      let placedCount = 0;
      let confirmedCount = 0;

      purchaseOrders.forEach((po: PurchaseOrder) => {
        if (po.orderItems) {
          po.orderItems.forEach((item: PurchaseOrderItem) => {
            totalPurchaseQuantity += item.quantity || 0;
            totalPurchaseAmount += item.lineTotal || 0;
          });
        }
        if (po.status === 'placed') {
          placedCount++;
        }
        if (po.status === 'confirmed') {
          confirmedCount++;
        }
      });

      setPurchaseOrderStats({
        count: purchaseOrders.length,
        quantity: totalPurchaseQuantity,
        amount: totalPurchaseAmount,
        placed: placedCount,
        confirmed: confirmedCount
      });

    } catch (error) {
      console.error('Error loading purchase orders:', error);
      showSnackbar('매입주문 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    contextRefreshData();
    loadPurchaseOrderStats();
  };

  const handleOpenClick = () => {
    setOpenDialogOpen(true);
  };

  const handleCloseClick = () => {
    setCloseDialogOpen(true);
  };

  const handleStartAggregation = async () => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    setOpenDialogOpen(false);

    try {
      await cutoffService.open();
      contextRefreshData();
      showSnackbar('일일식품 주문 접수를 시작했습니다.', 'success');
    } catch (error) {
      console.error('Error opening cutoff:', error);
      showSnackbar('주문 접수 시작 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCloseAggregation = async () => {
    if (!user) {
      showSnackbar('사용자 정보를 확인할 수 없습니다.', 'error');
      return;
    }

    setCloseDialogOpen(false);
    setLoading(true);

    try {
      // closeOnly: cutoff status만 'closed'로 변경 (PO 생성 없음)
      await cutoffService.closeOnly(user.uid, user.name || '관리자');
      contextRefreshData();

      showSnackbar(
        '일일식품 주문 접수를 마감했습니다. 매입 집계 페이지에서 매입주문을 생성해주세요.',
        'success'
      );
    } catch (error) {
      console.error('Error closing cutoff:', error);
      const errorMessage = error instanceof Error ? error.message : '주문 접수 마감 중 오류가 발생했습니다.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };


  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

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
                  onClick={handleRefresh}
                >
                  일일식품 마감 설정
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading}
              >
                새로고침
              </Button>
            </Box>
          </Box>

          {/* 하단: 접수 제어 및 매입주문 발주 */}
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              {/* 하단 좌카드: 일일식품 집계 마감 */}
              <Box sx={{ flex: 1 }}>
                <Card
                  sx={{
                    borderLeft: 4,
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        color: 'primary.main'
                      }}
                    >
                      집계 마감 설정
                    </Typography>

                    {/* 커스텀 슬라이더 스위치 - 세로 중앙 배치 */}
                    <Box sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <Box sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        gap: 3
                      }}>
                      {/* 좌측: 집계 시작 일시 */}
                      <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        alignItems: 'center',
                        justifyContent: { xs: 'space-between', md: 'flex-start' },
                        gap: { xs: 1, md: 0 }
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: { xs: 0, md: 0.5 }, textAlign: 'left' }}>
                          집계 시작
                        </Typography>
                        <Typography variant="body1" sx={{
                          fontWeight: 700,
                          color: cutoffOpenedAt ? 'info.main' : 'text.secondary',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          textAlign: 'right'
                        }}>
                          {cutoffOpenedAt
                            ? cutoffOpenedAt.toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })
                            : '-'}
                        </Typography>
                      </Box>

                      {/* 중앙: 스위치 */}
                      <Box sx={{
                        position: 'relative',
                        width: { xs: '100%', md: '25%' },
                        height: 50,
                        bgcolor: 'grey.100',
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': { opacity: 0.9 },
                        boxShadow: 2,
                        flexShrink: 0
                      }}
                      onClick={() => {
                        if (cutoffStatus === 'open') {
                          handleCloseClick();
                        } else {
                          handleOpenClick();
                        }
                      }}
                      >
                        {/* 왼쪽 "시작" 레이블 (노브 뒤에 배치) */}
                        <Typography
                          variant="body2"
                          sx={{
                            position: 'absolute',
                            left: 20,
                            fontWeight: 400,
                            color: 'text.disabled',
                            opacity: cutoffStatus === 'open' ? 0 : 0.75,
                            transition: 'all 0.3s ease',
                            userSelect: 'none',
                            zIndex: 0
                          }}
                        >
                          시작
                        </Typography>

                        {/* 오른쪽 "마감" 레이블 (노브 뒤에 배치) */}
                        <Typography
                          variant="body2"
                          sx={{
                            position: 'absolute',
                            right: 20,
                            fontWeight: 400,
                            color: 'text.disabled',
                            opacity: cutoffStatus === 'closed' ? 0 : 0.75,
                            transition: 'all 0.3s ease',
                            userSelect: 'none',
                            zIndex: 0
                          }}
                        >
                          마감
                        </Typography>

                        {/* 노브 */}
                        <Box sx={{
                          position: 'absolute',
                          left: cutoffStatus === 'open' ? 6 : 'auto',
                          right: cutoffStatus === 'closed' ? 6 : 'auto',
                          width: 60,
                          height: 38,
                          bgcolor: cutoffStatus === 'open' ? 'info.main' : 'warning.main',
                          borderRadius: 5,
                          transition: 'all 0.3s ease',
                          boxShadow: 3,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1
                        }}>
                          <Typography variant="caption" sx={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.65rem',
                            userSelect: 'none'
                          }}>
                            {cutoffStatus === 'open' ? '시작' : '마감'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* 우측: 집계 마감 일시 */}
                      <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        alignItems: 'center',
                        justifyContent: { xs: 'space-between', md: 'flex-end' },
                        gap: { xs: 1, md: 0 }
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: { xs: 0, md: 0.5 }, textAlign: 'left' }}>
                          집계 마감
                        </Typography>
                        <Typography variant="body1" sx={{
                          fontWeight: 700,
                          color: cutoffClosedAt ? 'warning.main' : 'text.secondary',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          textAlign: 'right'
                        }}>
                          {cutoffClosedAt
                            ? cutoffClosedAt.toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })
                            : '-'}
                        </Typography>
                      </Box>
                      </Box>
                    </Box>

                    {/* 현재 상태 표시 */}
                    <Alert
                      severity={cutoffStatus === 'open' ? 'info' : 'warning'}
                      sx={{ mt: 2 }}
                    >
                      {cutoffStatus === 'open'
                        ? '현재 일일식품 주문 집계가 진행 중입니다.'
                        : '현재 일일식품 주문 집계가 마감되었습니다.'}
                    </Alert>
                  </CardContent>
                </Card>
              </Box>

              {/* 하단 우카드: 매입 발주 현황 */}
              <Box sx={{ flex: 1 }}>
                <Card
                  sx={{
                    borderLeft: 4,
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        color: 'primary.main'
                      }}
                    >
                      매입 발주 현황
                    </Typography>

                    {/* 통계 항목 */}
                    <Box sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: { xs: 0.5, md: 2 }
                    }}>
                      <Box sx={{
                        flex: 1,
                        p: { xs: 1, md: 1.5 },
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        justifyContent: { xs: 'space-between', md: 'center' },
                        alignItems: 'center',
                        gap: { xs: 0.5, md: 1 }
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          집계 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {saleOrderStats.count.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: { xs: 1, md: 1.5 },
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        justifyContent: { xs: 'space-between', md: 'center' },
                        alignItems: 'center',
                        gap: { xs: 0.5, md: 1 }
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          생성 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {purchaseOrderStats.placed.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        p: { xs: 1, md: 1.5 },
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        justifyContent: { xs: 'space-between', md: 'center' },
                        alignItems: 'center',
                        gap: { xs: 0.5, md: 1 }
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          확정 건수
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {purchaseOrderStats.confirmed.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* 주문 접수 시작 다이얼로그 */}
      <Dialog
        open={openDialogOpen}
        onClose={() => setOpenDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'info.main', color: 'white' }}>
          일일식품 정규 집계 시작
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            일일식품의 정규 집계를 시작하시겠습니까?
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            매출주문 접수와 집계가 시작됩니다.
          </Alert>
          <Alert severity="info">
            지금부터 마감까지는 '정규' 주문, 이후는 '추가' 주문으로 분류됩니다.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenDialogOpen(false)} variant="outlined">
            취소
          </Button>
          <Button onClick={handleStartAggregation} variant="contained" color="info" autoFocus>
            시작
          </Button>
        </DialogActions>
      </Dialog>

      {/* 주문 접수 마감 다이얼로그 */}
      <Dialog
        open={closeDialogOpen}
        onClose={() => setCloseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'warning.main', color: 'white' }}>
          일일식품 접수 마감
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            일일식품 주문 집계를 마감하시겠습니까?
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            집계 마감 후 일일식품 매출주문은 '추가'로 분류됩니다.
          </Alert>
          <Alert severity="info">
            일일식품 매입주문을 발주해주세요.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCloseDialogOpen(false)} variant="outlined">
            취소
          </Button>
          <Button onClick={handleCloseAggregation} variant="contained" color="warning" autoFocus>
            마감
          </Button>
        </DialogActions>
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

export default DailyFoodCutoffSettingsPage;
