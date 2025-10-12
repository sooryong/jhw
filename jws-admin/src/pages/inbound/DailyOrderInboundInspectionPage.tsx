/**
 * 파일 경로: /src/pages/inbound/DailyOrderInboundInspectionPage.tsx
 * 작성 날짜: 2025-10-06
 * 주요 내용: 일일주문 입고 검수 페이지
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  PlaylistAdd as PlaylistAddIcon
} from '@mui/icons-material';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { completeInbound, type InboundInspectionItem } from '../../services/dailyOrderInboundService';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import type { Product } from '../../types/product';
import type { PurchaseLedger } from '../../types/purchaseLedger';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const DailyOrderInboundInspectionPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  interface InboundInspectionItemWithCategory extends InboundInspectionItem {
    category?: string;
  }
  const [inspectionItems, setInspectionItems] = useState<InboundInspectionItemWithCategory[]>([]);

  useEffect(() => {
    if (orderId) {
      loadPurchaseOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // sessionStorage에서 선택된 상품 확인
  useEffect(() => {
    const selectedProductJson = sessionStorage.getItem('selectedProductForInbound');
    if (selectedProductJson) {
      try {
        const product: Product = JSON.parse(selectedProductJson);
        handleProductSelect(product);
        sessionStorage.removeItem('selectedProductForInbound');
      } catch (err) {
        console.error('Error parsing selected product:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPurchaseLedger = async (ledgerId: string, order: PurchaseOrder) => {
    try {
      const ledgerRef = doc(db, 'purchaseLedgers', ledgerId);
      const ledgerDoc = await getDoc(ledgerRef);

      if (!ledgerDoc.exists()) {
        setError('매입원장을 찾을 수 없습니다.');
        return;
      }

      const ledger = ledgerDoc.data() as PurchaseLedger;

      // Convert ledger items to inspection items format
      // 주문수량은 원본 매입주문에서 가져오기
      const items: InboundInspectionItemWithCategory[] = ledger.ledgerItems.map(item => {
        const orderItem = order.orderItems.find(oi => oi.productId === item.productId);
        return {
          productId: item.productId,
          productName: item.productName,
          specification: item.specification,
          orderedQuantity: orderItem?.quantity || 0,
          orderedUnitPrice: item.unitPrice,
          receivedQuantity: item.quantity,
          category: item.category
        };
      });

      setInspectionItems(items);
    } catch (err) {
      console.error('Error loading purchase ledger:', err);
      setError('매입원장을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrder = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const order = await purchaseOrderService.getPurchaseOrderById(orderId);

      if (!order) {
        setError('매입주문을 찾을 수 없습니다.');
        return;
      }

      setPurchaseOrder(order);

      // completed 상태인 경우 매입원장에서 데이터 로드
      if (order.status === 'completed' && order.purchaseLedgerId) {
        await loadPurchaseLedger(order.purchaseLedgerId, order);
        return;
      }

      if (order.status !== 'confirmed') {
        setError('확정된 주문만 입고 처리할 수 있습니다.');
        return;
      }

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
            orderedUnitPrice: product?.purchasePrice || 0,
            receivedQuantity: item.quantity,
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
            receivedQuantity: item.quantity,
            category: '미분류'
          };
        }
      });

      const items = await Promise.all(itemsPromises);
      setInspectionItems(items);
    } catch (err) {
      console.error('Error loading purchase order:', err);
      setError('매입주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReceivedQuantityChange = (productId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setInspectionItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, receivedQuantity: quantity }
          : item
      )
    );
  };

  const handleUnitPriceChange = (productId: string, value: string) => {
    const price = parseInt(value) || 0;
    setInspectionItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, orderedUnitPrice: price }
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

    const newItem: InboundInspectionItemWithCategory = {
      productId: product.productId!,
      productName: product.productName,
      specification: product.specification || '',
      orderedQuantity: 0,
      orderedUnitPrice: 0,
      receivedQuantity: 0,
      category: product.mainCategory || '미분류'
    };
    setInspectionItems(prev => [...prev, newItem]);
  };



  const handleComplete = async () => {
    if (!orderId || !user) {
      return;
    }

    // 유효성 검사
    const hasInvalidQuantity = inspectionItems.some(item => item.receivedQuantity < 0);
    if (hasInvalidQuantity) {
      setSnackbar({
        open: true,
        message: '입고 수량은 0 이상이어야 합니다.',
        severity: 'error'
      });
      return;
    }

    // 매입단가 필수 검사
    const hasInvalidPrice = inspectionItems.some(item => item.orderedUnitPrice <= 0);
    if (hasInvalidPrice) {
      setSnackbar({
        open: true,
        message: '매입단가는 필수 항목입니다. 0보다 큰 값을 입력해주세요.',
        severity: 'error'
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await completeInbound({
        purchaseOrderNumber: orderId,
        inspectionItems,
        notes: '',
        receivedBy: user.uid
      });

      setSnackbar({
        open: true,
        message: '입고 처리가 완료되었습니다.',
        severity: 'success'
      });

      // 데이터 다시 로드하여 화면 갱신 (completed 상태로 전환됨)
      await loadPurchaseOrder();
      setIsEditMode(false);
    } catch (err) {
      console.error('Error completing inbound:', err);
      setSnackbar({
        open: true,
        message: '입고 처리 중 오류가 발생했습니다.',
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
    loadPurchaseOrder();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !purchaseOrder) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/orders/inbound')}
          sx={{ mt: 2 }}
        >
          목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/orders/inbound')}>
            <BackIcon />
          </IconButton>
          <PlaylistAddIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            매입주문 입고 등록
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={loadPurchaseOrder}
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
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              매입주문 코드
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseOrder.purchaseOrderNumber}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              상태
            </Typography>
            <Box>
              <Chip
                label={purchaseOrder.status === 'completed' ? '입고완료' : '확정'}
                size="small"
                color={purchaseOrder.status === 'completed' ? 'success' : 'primary'}
                variant="outlined"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">
              공급사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseOrder.supplierInfo.businessName}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Typography variant="caption" color="text.secondary">
              총수량
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseOrder.orderItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 검수 품목 */}
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '12%' }}>카테고리</TableCell>
              <TableCell sx={{ width: '28%' }}>상품명</TableCell>
              <TableCell sx={{ width: '15%' }}>규격</TableCell>
              <TableCell align="right" sx={{ width: '13%' }}>주문수량</TableCell>
              <TableCell align="right" sx={{ width: '13%' }}>입고수량</TableCell>
              <TableCell align="right" sx={{ width: '19%' }}>매입단가(원)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inspectionItems.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <Chip
                    label={item.category || '미분류'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.specification || '-'}</TableCell>
                <TableCell align="right">{item.orderedQuantity.toLocaleString()}</TableCell>
                <TableCell align="right">
                  {purchaseOrder?.status === 'completed' && !isEditMode ? (
                    <Box sx={{ textAlign: 'right' }}>{item.receivedQuantity.toLocaleString()}</Box>
                  ) : (
                    <TextField
                      type="number"
                      size="small"
                      value={item.receivedQuantity}
                      onChange={(e) => handleReceivedQuantityChange(item.productId, e.target.value)}
                      sx={{ width: 100 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {purchaseOrder?.status === 'completed' && !isEditMode ? (
                    <Box sx={{ textAlign: 'right' }}>{item.orderedUnitPrice.toLocaleString()}</Box>
                  ) : (
                    <TextField
                      type="number"
                      size="small"
                      value={item.orderedUnitPrice}
                      onChange={(e) => handleUnitPriceChange(item.productId, e.target.value)}
                      sx={{ width: 120 }}
                      error={item.orderedUnitPrice <= 0}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 액션 버튼 */}
      {purchaseOrder?.status !== 'completed' || isEditMode ? (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              const currentPath = location.pathname;
              const params = new URLSearchParams({
                mode: 'select',
                returnTo: currentPath,
                ...(purchaseOrder?.supplierId && { supplierId: purchaseOrder.supplierId })
              });
              navigate(`/products?${params.toString()}`);
            }}
          >
            상품 추가
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={isEditMode ? handleCancelEdit : () => navigate('/orders/inbound')}
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
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mb: 3 }}>
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
    </Container>
  );
};

export default DailyOrderInboundInspectionPage;
