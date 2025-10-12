/**
 * 파일 경로: /src/components/shop/FavoriteEditCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 즐겨찾기 편집용 가로 카드 (상품 정보 + 즐겨찾기 토글)
 * 특징: 클릭 시 상세보기, 즐겨찾기 추가/제거 버튼
 */

import React from 'react';
import {
  Card,
  CardMedia,
  Box,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import type { Product } from '../../types/product';
import type { Customer } from '../../types/company';

interface FavoriteEditCardProps {
  product: Product;
  customer: Customer | null;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  onClick: (product: Product) => void;
}

const FavoriteEditCard: React.FC<FavoriteEditCardProps> = ({
  product,
  customer,
  isFavorite,
  onToggleFavorite,
  onClick,
}) => {
  // 고객사 유형별 가격 계산
  const getCustomerPrice = (): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
  };

  // 할인 정보 계산
  const getDiscountInfo = () => {
    const standardPrice = product.salePrices.standard;
    const customerPrice = getCustomerPrice();

    if (customerPrice >= standardPrice) {
      return null;
    }

    const discountRate = Math.round(
      ((standardPrice - customerPrice) / standardPrice) * 100
    );

    if (discountRate === 0) {
      return null;
    }

    return {
      standardPrice,
      customerPrice,
      discountRate,
    };
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(product);
  };

  const discountInfo = getDiscountInfo();
  const price = getCustomerPrice();

  return (
    <Card
      elevation={1}
      sx={{
        mb: 1,
        borderRadius: 2,
        transition: 'all 0.2s',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 3,
        },
        '@media (hover: none)': {
          '&:active': {
            transform: 'scale(0.99)',
          },
        },
      }}
      onClick={() => onClick(product)}
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
          {/* 상품명 */}
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

          {/* 하단: 판매가 + 즐겨찾기 버튼 */}
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

            {/* 즐겨찾기 버튼 */}
            <IconButton
              color={isFavorite ? 'warning' : 'default'}
              onClick={handleFavoriteClick}
              sx={{
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              {isFavorite ? (
                <StarIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
              )}
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Card>
  );
};

export default FavoriteEditCard;
