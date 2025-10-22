/**
 * 파일 경로: /src/pages/inbound/InboundInspectionPage.tsx
 * 작성 날짜: 2025-10-18
 * 주요 내용: 입고 검수 페이지
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
  PlaylistAdd as PlaylistAddIcon
} from '@mui/icons-material';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { completeInbound, type InboundInspectionItem } from '../../services/inboundService';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import type { Product } from '../../types/product';
import type { PurchaseLedger } from '../../types/purchaseLedger';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import QuickProductAddDialog from '../../components/inbound/QuickProductAddDialog';

const InboundInspectionPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [purchaseLedger, setPurchaseLedger] = useState<PurchaseLedger | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [quickAddDialogOpen, setQuickAddDialogOpen] = useState(false);

  interface InboundInspectionItemWithCategory extends InboundInspectionItem {
    category?: string;
    inboundUnitPrice?: number; // 입고가격 추가
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

      // 매입원장 데이터 저장
      setPurchaseLedger(ledger);

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
          inboundUnitPrice: item.unitPrice,
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
      let purchaseOrderNumber = orderId;

      // ID 패턴 확인: PL-로 시작하면 매입원장번호
      if (orderId.startsWith('PL-')) {
        // 매입원장에서 매입주문번호 찾기 (purchaseLedgerNumber 필드로 쿼리)
        const ledgerQuery = query(
          collection(db, 'purchaseLedgers'),
          where('purchaseLedgerNumber', '==', orderId)
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (ledgerSnapshot.empty) {
          setError('매입원장을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        const ledger = ledgerSnapshot.docs[0].data() as PurchaseLedger;
        purchaseOrderNumber = ledger.purchaseOrderNumber;
      }

      const order = await purchaseOrderService.getPurchaseOrderById(purchaseOrderNumber);

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

      // completed가 아닌 경우 매입원장 초기화
      setPurchaseLedger(null);

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
            inboundUnitPrice: product?.purchasePrice || 0,
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
            inboundUnitPrice: 0,
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
    // 쉼표 제거 후 숫자로 변환
    const quantity = parseInt(value.replace(/,/g, '')) || 0;
    setInspectionItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, receivedQuantity: quantity }
          : item
      )
    );
  };

  const handleInboundPriceChange = (productId: string, value: string) => {
    // 쉼표 제거 후 숫자로 변환
    const price = parseInt(value.replace(/,/g, '')) || 0;
    setInspectionItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, inboundUnitPrice: price }
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
      inboundUnitPrice: 0,
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
    const newItem: InboundInspectionItemWithCategory = {
      productId: product.productId!,
      productName: product.productName,
      specification: product.specification || '',
      orderedQuantity: 0, // 주문수량 0
      orderedUnitPrice: product.purchasePrice || 0, // 최근 매입가격
      receivedQuantity: 0, // 입고수량 0 (사용자가 입력)
      inboundUnitPrice: product.purchasePrice || 0, // 입고가격 초기값
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
    const hasInvalidQuantity = inspectionItems.some(item => item.receivedQuantity < 0);
    if (hasInvalidQuantity) {
      setSnackbar({
        open: true,
        message: '입고 수량은 0 이상이어야 합니다.',
        severity: 'error'
      });
      return;
    }

    // 입고가격 필수 검사
    const hasInvalidPrice = inspectionItems.some(item => (item.inboundUnitPrice || 0) <= 0);
    if (hasInvalidPrice) {
      setSnackbar({
        open: true,
        message: '입고가격은 필수 항목입니다. 0보다 큰 값을 입력해주세요.',
        severity: 'error'
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await completeInbound({
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

      // 매입원장번호로 URL 변경
      if (result.purchaseLedgerNumber) {
        navigate(`/orders/inbound/inspect/${result.purchaseLedgerNumber}`, { replace: true });
      }
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
          {purchaseLedger && (
            <Grid size={{ xs: 12, md: 2.2 }}>
              <Typography variant="caption" color="text.secondary">
                매입원장 번호
              </Typography>
              <Typography variant="body1" fontWeight="medium" color="primary.main">
                {purchaseLedger.purchaseLedgerNumber}
              </Typography>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: purchaseLedger ? 2 : 2.2 }}>
            <Typography variant="caption" color="text.secondary">
              매입주문 번호
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseOrder.purchaseOrderNumber}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: purchaseLedger ? 2 : 2.2 }}>
            <Typography variant="caption" color="text.secondary">
              {purchaseLedger ? '입고일시' : '생성일시'}
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseLedger
                ? `${purchaseLedger.receivedAt.toDate().toLocaleDateString('ko-KR')} ${purchaseLedger.receivedAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                : `${purchaseOrder.placedAt.toDate().toLocaleDateString('ko-KR')} ${purchaseOrder.placedAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
              }
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: purchaseLedger ? 1.6 : 2 }}>
            <Typography variant="caption" color="text.secondary">
              합계 금액
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="primary.main">
              ₩{purchaseLedger
                ? purchaseLedger.totalAmount.toLocaleString()
                : inspectionItems.reduce((sum, item) => sum + (item.receivedQuantity * (item.inboundUnitPrice || 0)), 0).toLocaleString()
              }
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: purchaseLedger ? 2.2 : 3 }}>
            <Typography variant="caption" color="text.secondary">
              공급사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseLedger ? purchaseLedger.supplierInfo.businessName : purchaseOrder.supplierInfo.businessName}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Typography variant="caption" color="text.secondary">
              상품 종류
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseLedger ? purchaseLedger.itemCount : purchaseOrder.orderItems.length}종
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Typography variant="caption" color="text.secondary">
              상품 수량
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {purchaseLedger
                ? purchaseLedger.ledgerItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()
                : inspectionItems.reduce((sum, item) => sum + item.receivedQuantity, 0).toLocaleString()
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
              field: 'receivedQuantity',
              headerName: '입고수량',
              flex: 0.15,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', width: '100%' }}>
                  {purchaseOrder?.status === 'completed' && !isEditMode ? (
                    <Typography variant="body2" color="text.secondary">
                      {params.value.toLocaleString()}
                    </Typography>
                  ) : (
                    <TextField
                      type="text"
                      size="small"
                      value={params.value.toLocaleString()}
                      onChange={(e) => handleReceivedQuantityChange(params.row.productId, e.target.value)}
                      sx={{ width: '100px' }}
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
              field: 'inboundUnitPrice',
              headerName: '입고가격',
              flex: 0.12,
              align: 'right',
              headerAlign: 'right',
              renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', width: '100%' }}>
                  {purchaseOrder?.status === 'completed' && !isEditMode ? (
                    <Typography variant="body2" color="text.secondary">
                      {(params.value || 0).toLocaleString()}
                    </Typography>
                  ) : (
                    <TextField
                      type="text"
                      size="small"
                      value={(params.value || 0).toLocaleString()}
                      onChange={(e) => handleInboundPriceChange(params.row.productId, e.target.value)}
                      sx={{ width: '100px' }}
                      error={(params.value || 0) <= 0}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
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
                const subtotal = params.row.receivedQuantity * (params.row.inboundUnitPrice || 0);
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
      {purchaseOrder?.status !== 'completed' || isEditMode ? (
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
        initialSearchText={purchaseOrder?.supplierInfo.businessName || ''}
        showPurchasePrice={true}
        mode="inbound"
      />
    </Container>
  );
};

export default InboundInspectionPage;
