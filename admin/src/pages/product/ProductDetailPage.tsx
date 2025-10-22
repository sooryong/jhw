/**
 * 파일 경로: /src/pages/product/ProductDetailPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 상세보기/수정 페이지
 * 관련 데이터: products 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Inventory as ProductIcon,
  Assessment as StatsIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { productService } from '../../services/productService';
import ProductForm from '../../components/product/ProductForm';
import type { Product, ProductFormData, SalePrices } from '../../types/product';
import { productToFormData } from '../../types/product';
import {
  validateProductBasicForm,
  hasValidationErrors,
} from '../../utils/productValidation';

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  // 상태 관리
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData | null>(null);
  const [originalData, setOriginalData] = useState<ProductFormData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Snackbar 상태
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 데이터 로드 함수
  const loadProduct = useCallback(async () => {
    if (!productId) {
      navigate('/products');
      return;
    }

    setLoading(true);
    try {
      const productData = await productService.getProduct(productId);
      if (!productData) {
        navigate('/products');
        return;
      }

      setProduct(productData);

      // FormData로 변환
      const formDataObj = productToFormData(productData);
      setFormData(formDataObj);
      setOriginalData(formDataObj);
    } catch {
      // Error handled silently
      // 오류 처리: 상품 정보 로드 실패
      setSubmitError('상품 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [productId, navigate]);

  // 데이터 로드
  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // 입력값 변경 처리
  const handleChange = (field: string, value: string | number | boolean | string[] | SalePrices | undefined) => {
    if (!formData) return;

    setFormData(prev => ({
      ...prev!,
      [field]: value
    }));

    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    setSubmitError(null);
  };

  // 변경사항 확인
  const hasChanges = (): boolean => {
    if (!originalData || !formData) return false;
    return JSON.stringify(originalData) !== JSON.stringify(formData);
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    if (editMode) {
      // 취소 시 변경사항 확인
      if (hasChanges()) {
        if (!window.confirm('변경사항이 있습니다. 취소하시겠습니까?')) {
          return;
        }
        // 취소 메시지 표시
        setSnackbar({
          open: true,
          message: '수정이 취소되었습니다.',
          severity: 'success',
        });
      }
      // 원래 데이터로 복원
      setFormData(originalData);
      setErrors({});
      setSubmitError(null);
    }
    setEditMode(!editMode);
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    if (!formData) return false;

    const validationErrors = validateProductBasicForm(formData);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  };

  // 저장
  const handleSave = async () => {
    if (!formData || !productId || !product) return;

    if (!validateForm()) {
      setSubmitError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      await productService.updateProduct(productId, formData);

      // 데이터 새로고침
      const updatedProduct = await productService.getProduct(productId);
      if (updatedProduct) {
        setProduct(updatedProduct);
        const newFormData = productToFormData(updatedProduct);
        setFormData(newFormData);
        setOriginalData(newFormData);
      }

      setEditMode(false);

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `상품 '${product.productName}' 수정이 완료되었습니다.`,
        severity: 'success',
      });
    } catch (error) {
      // Error handled silently
      // 오류 처리: 상품 수정 실패
      const errorMessage = error instanceof Error ? error.message : '상품 수정 중 오류가 발생했습니다.';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 상태 토글 처리
  const handleStatusToggle = () => {
    setStatusDialog(true);
  };

  const handleStatusConfirm = async () => {
    if (!productId || !product) return;

    setStatusDialog(false);
    setStatusLoading(true);

    try {
      const newStatus = !product.isActive;

      // 낙관적 업데이트
      setProduct(prev => prev ? { ...prev, isActive: newStatus } : null);

      // 서버 업데이트
      await productService.updateProduct(productId, { isActive: newStatus });

      // FormData도 동기화
      if (formData) {
        setFormData(prev => prev ? { ...prev, isActive: newStatus } : null);
        setOriginalData(prev => prev ? { ...prev, isActive: newStatus } : null);
      }

    } catch {
      // Error handled silently
      // 오류 처리: 상품 상태 변경 실패

      // 롤백
      setProduct(prev => prev ? { ...prev, isActive: !product.isActive } : null);

      setSubmitError('상품 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setStatusLoading(false);
    }
  };

  // 삭제
  const handleDelete = useCallback(async () => {
    if (!productId) return;

    setDeleteDialog(false);
    setLoading(true);

    try {
      await productService.deleteProduct(productId);
      navigate('/products');
    } catch {
      // Error handled silently
      // 오류 처리: 상품 삭제 실패
      setSubmitError('상품 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [productId, navigate]);

  if (loading && !formData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product || !formData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          상품 정보를 찾을 수 없습니다.
        </Alert>
      </Box>
    );
  }

  // const stockStatus = stockUtils.getStockStatus(product.stockQuantity, product.minimumStock);

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      width: '80%',
      margin: '0 auto',
      maxWidth: '100vw',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3,
        pb: 2,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/products')}>
            <BackIcon />
          </IconButton>
          <ProductIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            {product.productName}
          </Typography>
          {/* 상태 토글 스위치 */}
          <FormControlLabel
            control={
              <Switch
                checked={product.isActive}
                onChange={handleStatusToggle}
                disabled={statusLoading}
                color="success"
              />
            }
            label={product.isActive ? "활성" : "비활성"}
            sx={{
              ml: 2,
              '& .MuiFormControlLabel-label': {
                color: product.isActive ? 'success.main' : 'text.secondary',
                fontWeight: 'medium'
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {editMode ? (
            <>
              <Button
                startIcon={<CancelIcon />}
                onClick={toggleEditMode}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={loading}
              >
                저장
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialog(true)}
                disabled={loading}
              >
                삭제
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={toggleEditMode}
                disabled={loading}
              >
                수정
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            onClick={loadProduct}
            disabled={loading}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 에러 메시지 및 폼 영역 - 스크롤 가능한 영역 */}
      <Box sx={{ px: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* ProductForm 컴포넌트 사용 */}
          <Grid size={{ xs: 12 }}>
            <ProductForm
              productCode={formData.productCode}
              productName={formData.productName}
              specification={formData.specification}
              mainCategory={formData.mainCategory}
              subCategory={formData.subCategory}
              purchasePrice={formData.purchasePrice}
              salePrices={formData.salePrices}
              stockQuantity={formData.stockQuantity}
              minimumStock={formData.minimumStock}
              supplierId={formData.supplierId}
              image={formData.image}
              images={formData.images}
              primaryImageIndex={formData.primaryImageIndex}
              description={formData.description}
              isActive={formData.isActive}
              onChange={handleChange}
              errors={errors}
              readOnly={!editMode}
            />
          </Grid>

          {/* 등록 정보 (읽기 전용) */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <StatsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  등록 정보
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="등록일" color="primary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={product.createdAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="수정일" color="secondary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={product.updatedAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 로트 이력 정보 */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  로트 이력
                </Typography>
              </Box>

              {product.lots && product.lots.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>입고날짜</strong></TableCell>
                        <TableCell align="right"><strong>입고수량</strong></TableCell>
                        <TableCell align="right"><strong>잔여수량</strong></TableCell>
                        <TableCell align="right"><strong>매입가격</strong></TableCell>
                        <TableCell align="center"><strong>상태</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {product.lots
                        .sort((a, b) => b.lotDate.localeCompare(a.lotDate)) // 최신순 정렬
                        .map((lot) => (
                          <TableRow key={lot.lotDate}>
                            <TableCell>
                              {lot.lotDate.slice(0, 4)}-{lot.lotDate.slice(4, 6)}-{lot.lotDate.slice(6, 8)}
                            </TableCell>
                            <TableCell align="right">
                              {lot.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{
                              color: lot.stock === 0 ? 'text.secondary' :
                                     lot.stock <= lot.quantity * 0.2 ? 'warning.main' : 'text.primary'
                            }}>
                              {lot.stock.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              ₩{lot.price.toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              {lot.stock === 0 ? (
                                <Chip label="소진" size="small" color="default" />
                              ) : lot.stock <= lot.quantity * 0.2 ? (
                                <Chip label="부족" size="small" color="warning" />
                              ) : (
                                <Chip label="정상" size="small" color="success" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary'
                }}>
                  <HistoryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography variant="body1">
                    등록된 로트 정보가 없습니다.
                  </Typography>
                  <Typography variant="body2">
                    상품 입고 시 로트 정보가 자동으로 기록됩니다.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">상품 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            <strong>{product.productName}</strong> 상품을 삭제하시겠습니까?
          </DialogContentText>
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            ⚠️ 이 작업은 복구할 수 없습니다.
            <br />
            해당 상품의 모든 데이터가 영구적으로 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)} autoFocus>
            취소
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            완전 삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상태 변경 확인 다이얼로그 */}
      <Dialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        aria-labelledby="status-dialog-title"
        aria-describedby="status-dialog-description"
      >
        <DialogTitle id="status-dialog-title">
          상품 상태 변경 확인
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="status-dialog-description">
            <strong>{product.productName}</strong> 상품을 <strong>{product.isActive ? '비활성' : '활성'}</strong> 상태로 변경하시겠습니까?
          </DialogContentText>
          {product.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
              ⚠️ 비활성화하면 상품 목록에서 숨겨지며, 새로운 주문이 제한될 수 있습니다.
            </Typography>
          )}
          {!product.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'success.main' }}>
              ✅ 활성화하면 상품 목록에 표시되며, 정상적인 주문이 가능해집니다.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStatusDialog(false)}
            disabled={statusLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleStatusConfirm}
            variant="contained"
            color={product.isActive ? "warning" : "success"}
            disabled={statusLoading}
            autoFocus
          >
            {product.isActive ? '비활성화' : '활성화'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
};

export default ProductDetailPage;