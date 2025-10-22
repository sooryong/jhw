/**
* 파일 경로: /src/pages/outbound/OutboundInspectionPage.tsx
* 작성 날짜: 2025-10-18
* 주요 내용: 출하 검수 페이지
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { DataGrid } from '@mui/x-data-grid';
import type { GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  LocalShipping as ShippingIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { completeOutbound, type OutboundInspectionItem } from '../../services/outboundService';
import type { SaleOrder } from '../../types/saleOrder';
import type { Product } from '../../types/product';
import type { SaleLedger } from '../../types/saleLedger';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import QuickProductAddDialog from '../../components/inbound/QuickProductAddDialog';
import { openPrintCenter } from '../../utils/printUtils';

const OutboundInspectionPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [saleLedger, setSaleLedger] = useState<SaleLedger | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [quickAddDialogOpen, setQuickAddDialogOpen] = useState(false);

  interface OutboundInspectionItemWithCategory extends OutboundInspectionItem {
    category?: string;
  }
  const [inspectionItems, setInspectionItems] = useState<OutboundInspectionItemWithCategory[]>([]);

  useEffect(() => {
    if (orderId) {
      loadSaleOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // sessionStorage에서 선택된 상품 확인
  useEffect(() => {
    const selectedProductJson = sessionStorage.getItem('selectedProductForOutbound');
    if (selectedProductJson) {
      try {
        const product: Product = JSON.parse(selectedProductJson);
        handleProductSelect(product);
        sessionStorage.removeItem('selectedProductForOutbound');
      } catch (err) {
        console.error('Error parsing selected product:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSaleLedger = async (ledgerId: string, order: SaleOrder) => {
    try {
      const ledgerRef = doc(db, 'saleLedgers', ledgerId);
      const ledgerDoc = await getDoc(ledgerRef);

      if (!ledgerDoc.exists()) {
        setError('매출원장을 찾을 수 없습니다.');
        return;
      }

      const ledger = ledgerDoc.data() as SaleLedger;

      // 매출원장 데이터 저장
      setSaleLedger(ledger);

      // Convert ledger items to inspection items format
      // 주문수량은 원본 매출주문에서 가져오기
      const items: OutboundInspectionItemWithCategory[] = ledger.ledgerItems.map(item => {
        const orderItem = order.orderItems.find(oi => oi.productId === item.productId);
        return {
          productId: item.productId,
          productName: item.productName,
          specification: item.specification,
          orderedQuantity: orderItem?.quantity || 0,
          orderedUnitPrice: orderItem?.unitPrice || item.unitPrice,
          shippedQuantity: item.quantity,
          category: item.category
        };
      });

      setInspectionItems(items);
    } catch (err) {
      console.error('Error loading sale ledger:', err);
      setError('매출원장을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSaleOrder = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      let saleOrderNumber = orderId;

      // ID 패턴 확인: SL-로 시작하면 매출원장번호
      if (orderId.startsWith('SL-')) {
        // 매출원장에서 매출주문번호 찾기 (saleLedgerNumber 필드로 쿼리)
        const ledgerQuery = query(
          collection(db, 'saleLedgers'),
          where('saleLedgerNumber', '==', orderId)
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (ledgerSnapshot.empty) {
          setError('매출원장을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        const ledger = ledgerSnapshot.docs[0].data() as SaleLedger;
        saleOrderNumber = ledger.saleOrderNumber;
      }

      // saleOrderNumber로 매출주문 조회
      const q = query(
        collection(db, 'saleOrders'),
        where('saleOrderNumber', '==', saleOrderNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('매출주문을 찾을 수 없습니다.');
        return;
      }

      const order = snapshot.docs[0].data() as SaleOrder;
      setSaleOrder(order);

      // completed 상태인 경우 매출원장에서 데이터 로드
      if (order.status === 'completed' && order.saleLedgerId) {
        await loadSaleLedger(order.saleLedgerId, order);
        return;
      }

      // completed가 아닌 경우 매출원장 초기화
      setSaleLedger(null);

      // 검수 품목 초기화 (주문 수량으로) + 카테고리 조회
      const itemsPromises = order.orderItems.map(async (item) => {
        // 상품 정보 조회하여 카테고리 가져오기
        try {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await getDoc(productRef);
          const product = productDoc.exists() ? (productDoc.data() as Product) : null;

          return {
            productId: item.productId,
            productName: item.productName,
            specification: item.specification,
            orderedQuantity: item.quantity,
            orderedUnitPrice: item.unitPrice,
            shippedQuantity: item.quantity,
            category: product?.mainCategory || '미분류'
          };
        } catch (err) {
          console.error('Error loading product category:', err);
          return {
            productId: item.productId,
            productName: item.productName,
            specification: item.specification,
            orderedQuantity: item.quantity,
            orderedUnitPrice: 0,
            shippedQuantity: item.quantity,
            category: '미분류'
          };
        }
      });

      const items = await Promise.all(itemsPromises);
      setInspectionItems(items);
    } catch (err) {
      console.error('Error loading sale order:', err);
      setError('매출주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleShippedQuantityChange = (productId: string, value: string) => {
    // 쉼표 제거 후 숫자로 변환
    const quantity = parseInt(value.replace(/,/g, '')) || 0;
    setInspectionItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, shippedQuantity: quantity }
          : item
      )
    );
  };

  const handleProductSelect = (product: Product) => {
    // 중복 확인
    const isDuplicate = inspectionItems.some(item => item.productId === product.productId);
    if (isDuplicate) {
      setError('이미 추가된 상품입니다.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newItem: OutboundInspectionItemWithCategory = {
      productId: product.productId!,
      productName: product.productName,
      specification: product.specification || '',
      orderedQuantity: 0,
      orderedUnitPrice: 0,
      shippedQuantity: 0,
      category: product.mainCategory || '미분류'
    };
    setInspectionItems(prev => [...prev, newItem]);
  };

  const handleQuickAddProduct = (product: Product) => {
    // 중복 확인
    const isDuplicate = inspectionItems.some(item => item.productId === product.productId);
    if (isDuplicate) {
      setSnackbar({
        open: true,
        message: '이미 추가된 상품입니다.',
        severity: 'error'
      });
      return;
    }

    // 새 항목 추가
    const newItem: OutboundInspectionItemWithCategory = {
      productId: product.productId!,
      productName: product.productName,
      specification: product.specification || '',
      orderedQuantity: 0, // 주문수량 0
      orderedUnitPrice: product.salePrice || 0, // 판매가격
      shippedQuantity: 0, // 출하수량 0 (사용자가 입력)
      category: product.mainCategory || '미분류'
    };

    setInspectionItems(prev => [...prev, newItem]);
    setQuickAddDialogOpen(false);

    setSnackbar({
      open: true,
      message: '상품이 추가되었습니다.',
      severity: 'success'
    });
  };



  const handleComplete = async () => {
    if (!orderId || !user) {
      return;
    }

    // 유효성 검사
    const hasInvalidQuantity = inspectionItems.some(item => item.shippedQuantity < 0);
    if (hasInvalidQuantity) {
      setSnackbar({
        open: true,
        message: '출하 수량은 0 이상이어야 합니다.',
        severity: 'error'
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await completeOutbound({
        saleOrderNumber: orderId,
        inspectionItems,
        notes: '',
        shippedBy: user.uid
      });

      setSnackbar({
        open: true,
        message: '출하 처리가 완료되었습니다.',
        severity: 'success'
      });

      // 데이터 다시 로드하여 화면 갱신 (completed 상태로 전환됨)
      await loadSaleOrder();
      setIsEditMode(false);

      // 매출전표(거래명세서) 프린트 센터에 추가
      if (result.saleLedgerId) {
        openPrintCenter('sale-slip', [result.saleLedgerId]);
      }

      // 매출원장번호로 URL 변경
      if (result.saleLedgerNumber) {
        navigate(`/orders/outbound/inspect/${result.saleLedgerNumber}`, { replace: true });
      }
    } catch (err) {
      console.error('Error completing outbound:', err);
      setSnackbar({
        open: true,
        message: '출하 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    loadSaleOrder();
  };

  const handlePrintSaleSlip = () => {
    if (saleOrder?.saleLedgerId) {
      openPrintCenter('sale-slip', [saleOrder.saleLedgerId]);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !saleOrder) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/orders/outbound')}
          sx={{ mt: 2 }}
        >
          목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  if (!saleOrder) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/orders/outbound')}>
            <BackIcon />
          </IconButton>
          <ShippingIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            매출주문 출하 등록
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={loadSaleOrder}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 주문 정보 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          {saleLedger && (
            <Grid size={{ xs: 12, md: 2.2 }}>
              <Typography variant="caption" color="text.secondary">
                매출원장 번호
              </Typography>
              <Typography variant="body1" fontWeight="medium" color="primary.main">
                {saleLedger.saleLedgerNumber}
              </Typography>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: saleLedger ? 2 : 2.2 }}>
            <Typography variant="caption" color="text.secondary">
              매출주문 번호
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleOrder.saleOrderNumber}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: saleLedger ? 2 : 2.2 }}>
            <Typography variant="caption" color="text.secondary">
              {saleLedger ? '출하일시' : '생성일시'}
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger
                ? `${saleLedger.shippedAt.toDate().toLocaleDateString('ko-KR')} ${saleLedger.shippedAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                : `${saleOrder.placedAt.toDate().toLocaleDateString('ko-KR')} ${saleOrder.placedAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
              }
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: saleLedger ? 1.6 : 2 }}>
            <Typography variant="caption" color="text.secondary">
              합계 금액
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="primary.main">
              ₩{saleLedger
                ? saleLedger.totalAmount.toLocaleString()
                : inspectionItems.reduce((sum, item) => sum + (item.shippedQuantity * item.orderedUnitPrice), 0).toLocaleString()
              }
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: saleLedger ? 2.2 : 3 }}>
            <Typography variant="caption" color="text.secondary">
              고객사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger ? saleLedger.customerInfo.businessName : saleOrder.customerInfo.businessName}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Typography variant="caption" color="text.secondary">
              상품 종류
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger ? saleLedger.itemCount : saleOrder.orderItems.length}종
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Typography variant="caption" color="text.secondary">
              상품 수량
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleLedger
                ? saleLedger.ledgerItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()
                : inspectionItems.reduce((sum, item) => sum + item.shippedQuantity, 0).toLocaleString()
              }개
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 검수 품목 */}
      <Paper sx={{ minHeight: 400, maxHeight: 600, width: '100%', mb: 3 }}>
        <DataGrid
          autoHeight
          rows={inspectionItems}
          columns={[
            {
              field: 'category',
              headerName: '카테고리',
              flex: 0.12,
              align: 'center',
              headerAlign: 'center',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Chip
                    label={params.value || '미분류'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )
            },
            {
              field: 'productName',
              headerName: '상품명',
              flex: 0.28,
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'specification',
              headerName: '규격',
              flex: 0.15,
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value || '-'}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'orderedQuantity',
              headerName: '주문수량',
              flex: 0.15,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value.toLocaleString()}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'shippedQuantity',
              headerName: '출하수량',
              flex: 0.15,
              align: 'center',
              headerAlign: 'center',
              renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                  {saleOrder?.status === 'completed' && !isEditMode ? (
                    <Typography variant="body2" color="text.secondary">
                      {params.value.toLocaleString()}
                    </Typography>
                  ) : (
                    <TextField
                      type="text"
                      size="small"
                      value={params.value.toLocaleString()}
                      onChange={(e) => handleShippedQuantityChange(params.row.productId, e.target.value)}
                      sx={{ width: '100px' }}
                      inputProps={{ style: { textAlign: 'center' } }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </Box>
              )
            },
            {
              field: 'orderedUnitPrice',
              headerName: '주문가격',
              flex: 0.12,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {params.value.toLocaleString()}
                  </Typography>
                </Box>
              )
            },
            {
              field: 'subtotal',
              headerName: '소계',
              flex: 0.13,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params) => {
                const subtotal = params.row.shippedQuantity * params.row.orderedUnitPrice;
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Typography variant="body2" color="primary.main" fontWeight="medium">
                      {subtotal.toLocaleString()}
                    </Typography>
                  </Box>
                );
              }
            }
          ]}
          getRowId={(row) => row.productId}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[10, 20, 30]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } }
          }}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
          }}
        />
      </Paper>

      {/* 액션 버튼 */}
      {saleOrder?.status !== 'completed' || isEditMode ? (
        <Box sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'space-between',
          mb: 3,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1
        }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setQuickAddDialogOpen(true)}
          >
            상품 추가
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={isEditMode ? handleCancelEdit : () => navigate('/orders/outbound')}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <CheckIcon />}
              onClick={handleComplete}
              disabled={saving}
            >
              저장
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end',
          mb: 3,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1
        }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintSaleSlip}
          >
            거래명세서 인쇄
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            수정
          </Button>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 빠른 상품 추가 다이얼로그 */}
      <QuickProductAddDialog
        open={quickAddDialogOpen}
        onClose={() => setQuickAddDialogOpen(false)}
        onSelect={handleQuickAddProduct}
        initialSearchText=""
        showPurchasePrice={false}
        mode="outbound"
      />
    </Container>
  );
};

export default OutboundInspectionPage;
