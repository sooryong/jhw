/**
 * 파일 경로: /src/pages/shop/ProductDetailPage.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 상품 상세 페이지 (즐겨찾기 편집용)
 * 관련 데이터: products, customers.favoriteProducts
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomer } from '../../contexts/CustomerContext';
import type { Product } from '../../types/product';
import type { Customer, FavoriteProduct } from '../../types/company';
import { getProductsByIds } from '../../services/productService';
import { updateCustomer } from '../../services/customerService';
import ProductDetailPanel from './components/ProductDetailPanel';

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { customer: customerFromContext, updateFavorites } = useCustomer();

  const [product, setProduct] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상품 데이터 로드
  useEffect(() => {
    loadProduct();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, customerFromContext]);

  const loadProduct = async () => {
    if (!productId || !customerFromContext) {
      setError('상품 정보를 불러올 수 없습니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 상품 조회
      const products = await getProductsByIds([productId]);
      if (!products || products.length === 0) {
        setError('상품을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setProduct(products[0]);
      setCustomer(customerFromContext);

      // 즐겨찾기 여부 확인
      const favoriteIds = customerFromContext.favoriteProducts?.map(fp => fp.productId) || [];
      setIsFavorite(favoriteIds.includes(productId));

    } catch (err) {
      console.error('상품 로드 실패:', err);
      setError(err instanceof Error ? err.message : '상품을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 토글
  const handleFavoriteToggle = async () => {
    if (!product || !customer || !user) return;

    const productId = product.productId;
    if (!productId) return;

    // 1. UI 즉시 업데이트 (낙관적)
    const previousFavorite = isFavorite;
    setIsFavorite(!isFavorite);

    // 2. 백그라운드에서 서버 업데이트
    try {
      let updatedFavorites: FavoriteProduct[];

      if (isFavorite) {
        // 제거
        updatedFavorites = (customer.favoriteProducts || []).filter(
          fp => fp.productId !== productId
        );
      } else {
        // 추가
        const newFavorite: FavoriteProduct = {
          productId,
          productName: product.productName,
          productImage: product.image,
          displayOrder: (customer.favoriteProducts?.length || 0) + 1,
          isActive: true,
        };
        updatedFavorites = [...(customer.favoriteProducts || []), newFavorite];
      }

      // Firestore 고객사 정보 업데이트
      await updateCustomer(customer.businessNumber, {
        favoriteProducts: updatedFavorites,
      });

      // 로컬 customer 상태 업데이트
      setCustomer(prev => prev ? { ...prev, favoriteProducts: updatedFavorites } : null);

      // CustomerContext 업데이트 (즐겨찾기 주문 페이지와 동기화)
      updateFavorites(updatedFavorites);

    } catch (error) {
      console.error('즐겨찾기 업데이트 실패:', error);
      setError('즐겨찾기 업데이트에 실패했습니다.');

      // 3. 실패 시 롤백
      setIsFavorite(previousFavorite);
    }
  };

  // 뒤로가기
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !product) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error || '상품을 찾을 수 없습니다.'}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 상단 AppBar */}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            상품 상세
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 상품 상세 내용 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        py: 3,
        width: '100%'
      }}>
        <Box sx={{
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
          px: 2,
          '& > .MuiPaper-root': {
            m: 0,
            width: '100%',
            height: 'auto',
            position: 'static'
          }
        }}>
          <ProductDetailPanel
            product={product}
            customer={customer}
            isFavorite={isFavorite}
            onFavoriteToggle={handleFavoriteToggle}
            saving={false}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ProductDetailPage;
