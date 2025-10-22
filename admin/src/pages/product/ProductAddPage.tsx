/**
 * 파일 경로: /src/pages/product/ProductAddPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 등록 페이지
 * 관련 데이터: products 컬렉션
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Inventory as ProductIcon
} from '@mui/icons-material';
import { productService } from '../../services/productService';
import { settingsService } from '../../services/settingsService';
import ProductForm from '../../components/product/ProductForm';
import type { ProductFormData, SalePrices } from '../../types/product';
import { createDefaultSalePrices } from '../../types/product';
import {
  validateProductForm,
  hasValidationErrors,
} from '../../utils/productValidation';

const ProductAddPage: React.FC = () => {
  const navigate = useNavigate();

  // 상태 관리
  const [formData, setFormData] = useState<ProductFormData>({
    productCode: undefined, // 서버에서 생성
    productName: '',
    specification: '',
    mainCategory: '',
    subCategory: '',
    purchasePrice: 0, // 기본값 0
    salePrices: {
      standard: 0,
      customerTypes: {}
    },
    stockQuantity: 0, // 기본값 0
    minimumStock: 0, // 기본값 0
    supplierId: '',
    image: '',
    images: [],
    primaryImageIndex: 0,
    description: '',
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);

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

  // 고객사 유형 및 다음 상품 코드 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 고객사 유형 로드
        const types = await settingsService.getCustomerTypes();
        setCustomerTypes(types);

        // 다음 상품 코드 미리보기
        const nextCode = await productService.getNextProductCode();

        // 기본 판매가격 구조 및 상품 코드 설정
        setFormData(prev => ({
          ...prev,
          productCode: nextCode,
          salePrices: createDefaultSalePrices(0, types)
        }));
      } catch {
      // Error handled silently
        // 오류 처리: 데이터 로드 실패
      }
    };

    loadInitialData();
  }, []);

  // 입력값 변경 처리
  const handleChange = (field: string, value: string | number | boolean | SalePrices | string[] | undefined) => {
    setFormData(prev => ({
      ...prev,
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

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    const validationErrors = validateProductForm(formData, customerTypes);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  };

  // 취소 - 폼 초기화
  const handleCancel = () => {
    // 사용자가 실제로 입력한 필드만 체크
    const hasUserInput =
      formData.productName !== '' ||
      formData.specification !== '' ||
      formData.mainCategory !== '' ||
      formData.subCategory !== '' ||
      (formData.purchasePrice !== undefined && formData.purchasePrice !== 0) ||
      formData.salePrices.standard !== 0 ||
      (formData.stockQuantity !== undefined && formData.stockQuantity !== 0) ||
      (formData.minimumStock !== undefined && formData.minimumStock !== 0) ||
      formData.supplierId !== '' ||
      formData.image !== '' ||
      (formData.images && formData.images.length > 0 && formData.images.some(img => img !== '')) ||
      formData.description !== '';

    if (hasUserInput) {
      if (!window.confirm('작성 중인 내용을 모두 지우시겠습니까?')) {
        return;
      }
    }

    resetForm();
  };

  // 폼 초기화 함수
  const resetForm = async () => {
    try {
      // 다음 상품 코드 미리보기
      const nextCode = await productService.getNextProductCode();

      setFormData({
        productCode: nextCode,
        productName: '',
        specification: '',
        mainCategory: '',
        subCategory: '',
        purchasePrice: 0, // 기본값 0
        salePrices: createDefaultSalePrices(0, customerTypes),
        stockQuantity: 0, // 기본값 0
        minimumStock: 0, // 기본값 0
        supplierId: '',
        image: '',
        images: [],
        primaryImageIndex: 0,
        description: '',
        isActive: true
      });
      setErrors({});
      setSubmitError(null);
    } catch {
      // Error handled silently
      // 코드 로드 실패 시 undefined로 설정
      setFormData({
        productCode: undefined,
        productName: '',
        specification: '',
        mainCategory: '',
        subCategory: '',
        purchasePrice: 0,
        salePrices: createDefaultSalePrices(0, customerTypes),
        stockQuantity: 0,
        minimumStock: 0,
        supplierId: '',
        image: '',
        images: [],
        primaryImageIndex: 0,
        description: '',
        isActive: true
      });
      setErrors({});
      setSubmitError(null);
    }
  };

  // 저장 처리
  const handleSubmit = async () => {
    if (!validateForm()) {
      setSubmitError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      await productService.createProduct(formData);

      // 성공 시 폼 초기화
      resetForm();

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `상품 '${formData.productName}' 추가가 완료되었습니다.`,
        severity: 'success',
      });
    } catch (error) {
      // Error handled silently
      // 오류 처리: 상품 등록 실패
      const errorMessage = error instanceof Error ? error.message : '상품 등록 중 오류가 발생했습니다.';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

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
            상품 추가
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : '저장'}
          </Button>
        </Box>
      </Box>

      {/* 에러 메시지 */}
      {submitError && (
        <Box sx={{ px: 3, pb: 2, flexShrink: 0 }}>
          <Alert severity="error">
            {submitError}
          </Alert>
        </Box>
      )}

      {/* 폼 영역 - 스크롤 가능한 영역 */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 3, pb: 3 }}>
        <Box sx={{ width: '100%' }}>
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
            readOnly={false}
          />
        </Box>
      </Box>

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

export default ProductAddPage;