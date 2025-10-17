/**
 * 파일 경로: /src/components/shop/HorizontalProductCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 가로형 상품 카드 컴포넌트 (리스트 스타일)
 * 특징: 할인율 표시, 표준가 vs 판매가, 빠른 주문
 */

import React, { useState } from 'react';
import {
  Card,
  CardMedia,
  Box,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import type { Product } from '../../types/product';
import type { Customer } from '../../types/company';

interface HorizontalProductCardProps {
  product: Product;
  customer: Customer | null;
  onAddToCart: (productId: string, quantity: number) => void;
  onProductClick?: (productId: string) => void;
}

interface DiscountInfo {
  standardPrice: number;
  customerPrice: number;
  discountRate: number;
  hasDiscount: boolean;
}

const HorizontalProductCard: React.FC<HorizontalProductCardProps> = ({
  product,
  customer,
  onAddToCart,
  onProductClick,
}) => {
  const [addAnimation, setAddAnimation] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // 고객사 유형별 가격 계산
  const getCustomerPrice = (): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
  };

  // 할인 정보 계산
  const getDiscountInfo = (): DiscountInfo | null => {
    const standardPrice = product.salePrices.standard;
    const customerPrice = getCustomerPrice();

    if (customerPrice >= standardPrice) {
      return null; // 할인 없음
    }

    const discountRate = Math.round(
      ((standardPrice - customerPrice) / standardPrice) * 100
    );

    if (discountRate === 0) {
      return null; // 1% 미만 차이는 표시 안 함
    }

    return {
      standardPrice,
      customerPrice,
      discountRate,
      hasDiscount: true,
    };
  };

  // 장바구니 담기 핸들러
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    if (!product.productId) return;
    setAddAnimation(true);
    setJustAdded(true);
    onAddToCart(product.productId, 1);

    setTimeout(() => {
      setAddAnimation(false);
    }, 300);

    setTimeout(() => {
      setJustAdded(false);
    }, 1000);
  };

  const discountInfo = getDiscountInfo();
  const price = getCustomerPrice();

  return (
    <>
      <Card
        elevation={1}
        onClick={() => product.productId && onProductClick?.(product.productId)}
        sx={{
          mb: 1,
          borderRadius: 2,
          transition: 'all 0.2s',
          cursor: onProductClick ? 'pointer' : 'default',
          '&:hover': {
            boxShadow: 3,
          },
          // 모바일 터치 최적화
          '@media (hover: none)': {
            '&:active': {
              transform: 'scale(0.99)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', p: 1.5 }}>
          {/* 상품 이미지 */}
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
              width: { xs: 80, sm: 100 },
              height: { xs: 80, sm: 100 },
              objectFit: 'cover',
              borderRadius: 2,
              flexShrink: 0,
              mr: 1.5,
            }}
          />

          {/* 상품 정보 */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* 상품명 + 삭제 버튼 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  lineHeight: 1.3,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  pr: 1,
                }}
              >
                {product.productName}
              </Typography>

              {/* 카테고리 (데스크톱만) */}
              {product.mainCategory && (
                <Chip
                  label={product.mainCategory}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}
                />
              )}
            </Box>

            {/* 규격 */}
            {product.specification && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.8rem',
                  mb: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {product.specification}
              </Typography>
            )}

            {/* 가격 정보 */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {/* 할인율 뱃지 */}
              {discountInfo && (
                <Chip
                  label={`${discountInfo.discountRate}% ▼`}
                  size="small"
                  color="error"
                  sx={{
                    height: 20,
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    fontWeight: 700,
                  }}
                />
              )}

              {/* 표준가 (취소선) */}
              {discountInfo && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    textDecoration: 'line-through',
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                  }}
                >
                  ₩{discountInfo.standardPrice.toLocaleString()}
                </Typography>
              )}
            </Box>

            {/* 하단: 판매가 + 담기 버튼 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
              {/* 판매가 */}
              <Typography
                variant="h6"
                color="primary"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                }}
              >
                ₩{price.toLocaleString()}
              </Typography>

              {/* 담기 버튼 */}
              <Button
                variant="contained"
                size="small"
                startIcon={justAdded ? <CheckIcon /> : <AddIcon />}
                onClick={handleAddToCart}
                sx={{
                  minHeight: { xs: 36, sm: 40 },
                  fontSize: { xs: '0.8rem', sm: '0.85rem' },
                  fontWeight: 600,
                  borderRadius: 2,
                  px: { xs: 3, sm: 10 },
                  boxShadow: 'none',
                  transition: 'all 0.2s',
                  transform: addAnimation ? 'scale(0.95)' : 'scale(1)',
                  bgcolor: justAdded ? 'primary.main' : 'success.main',
                  '&:hover': {
                    boxShadow: 2,
                    bgcolor: justAdded ? 'primary.dark' : 'success.dark',
                  },
                }}
              >
                {justAdded ? '담김' : '담기'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Card>
    </>
  );
};

export default HorizontalProductCard;
