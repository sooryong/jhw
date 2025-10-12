/**
 * 파일 경로: /src/components/shop/ProductCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 쿠팡 스타일 모바일 상품 카드 컴포넌트
 * 특징: 터치 친화적, 즉시 장바구니 담기, 애니메이션
 */

import React, { useState } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import type { Product } from '../../types/product';
import type { Customer } from '../../types/company';

interface ProductCardProps {
  product: Product;
  customer: Customer | null;
  onAddToCart: (productId: string, quantity: number) => void;
  compact?: boolean; // 컴팩트 모드 (더 작은 카드)
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  customer,
  onAddToCart,
  compact = false,
}) => {
  const [showToast, setShowToast] = useState(false);
  const [addAnimation, setAddAnimation] = useState(false);

  // 고객사 유형별 가격 계산
  const getCustomerPrice = (): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
  };

  // 장바구니 담기 핸들러
  const handleAddToCart = () => {
    if (!product.productId) return;
    setAddAnimation(true);
    onAddToCart(product.productId, 1);
    setShowToast(true);

    // 애니메이션 초기화
    setTimeout(() => {
      setAddAnimation(false);
    }, 300);
  };

  const price = getCustomerPrice();

  return (
    <>
      <Card
        elevation={1}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease-in-out',
          borderRadius: 2,
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
          // 모바일 터치 최적화
          '@media (hover: none)': {
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
        }}
      >
        {/* 상품 이미지 */}
        <Box sx={{ position: 'relative' }}>
          <CardMedia
            component="img"
            image={
              (product.images && product.images.length > 0)
                ? product.images[0]
                : (product.image || '/images/no-image.png')
            }
            alt={product.productName}
            loading="lazy"
            sx={{
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              backgroundColor: '#f5f5f5',
            }}
          />

          {/* 카테고리 뱃지 (데스크톱만) */}
          {product.mainCategory && !compact && (
            <Chip
              label={product.mainCategory}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                fontWeight: 600,
                fontSize: '0.7rem',
                display: { xs: 'none', sm: 'flex' },
              }}
            />
          )}
        </Box>

        {/* 상품 정보 */}
        <CardContent
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            p: compact ? 1.5 : 2,
            '&:last-child': {
              pb: compact ? 1.5 : 2,
            },
          }}
        >
          {/* 상품명 */}
          <Typography
            variant="body1"
            component="h3"
            sx={{
              fontWeight: 600,
              fontSize: compact ? '0.875rem' : { xs: '0.95rem', sm: '1rem' },
              lineHeight: 1.3,
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: compact ? '2.3em' : '2.6em',
            }}
          >
            {product.productName}
          </Typography>

          {/* 규격 (모바일에서는 숨김) */}
          {product.specification && !compact && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.75rem',
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {product.specification}
            </Typography>
          )}

          {/* 가격 */}
          <Typography
            variant="h6"
            color="primary"
            sx={{
              fontWeight: 700,
              fontSize: compact ? '1rem' : { xs: '1.1rem', sm: '1.25rem' },
              mb: compact ? 1 : 1.5,
              mt: 'auto',
            }}
          >
            ₩{price.toLocaleString()}
          </Typography>

          {/* 장바구니 담기 버튼 */}
          <Button
            variant="contained"
            fullWidth
            startIcon={addAnimation ? <ShoppingCartIcon /> : <AddIcon />}
            onClick={handleAddToCart}
            sx={{
              minHeight: { xs: 44, sm: 48 },
              fontSize: compact ? '0.8rem' : { xs: '0.85rem', sm: '0.95rem' },
              fontWeight: 600,
              borderRadius: 2,
              boxShadow: 'none',
              transition: 'all 0.2s',
              transform: addAnimation ? 'scale(0.95)' : 'scale(1)',
              '&:hover': {
                boxShadow: 2,
              },
            }}
          >
            담기
          </Button>
        </CardContent>
      </Card>

      {/* 장바구니 추가 토스트 알림 */}
      <Snackbar
        open={showToast}
        autoHideDuration={1500}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, md: 24 } }}
      >
        <Alert
          onClose={() => setShowToast(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          장바구니에 담았습니다
        </Alert>
      </Snackbar>
    </>
  );
};

export default ProductCard;
