/**
 * 파일 경로: /src/components/shop/CartItemCard.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 장바구니 아이템 카드 컴포넌트 (텍스트 전용)
 * 특징: 컴팩트 레이아웃, 수량 증감, 삭제 기능
 * 업데이트: 상품 사진 제거, 공간 효율 50% 개선
 */

import React from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  TextField,
  Chip,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { Product } from '../../types/product';

interface CartItemCardProps {
  product: Product;
  quantity: number;
  price: number;
  onQuantityChange: (newQuantity: number) => void;
  onRemove: () => void;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

const CartItemCard: React.FC<CartItemCardProps> = ({
  product,
  quantity,
  price,
  onQuantityChange,
  onRemove,
  compact = false,
  sx,
}) => {
  const lineTotal = price * quantity;

  // 수량 증가
  const handleIncrease = () => {
    onQuantityChange(quantity + 1);
  };

  // 수량 감소
  const handleDecrease = () => {
    if (quantity > 1) {
      onQuantityChange(quantity - 1);
    }
    // 최소값 1 유지 (더 이상 감소하지 않음)
  };

  // 직접 입력
  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value) || 1;
    if (newQuantity < 1) {
      onQuantityChange(1);
    } else {
      onQuantityChange(newQuantity);
    }
  };

  return (
    <Card
      elevation={1}
      sx={{
        mb: compact ? 0.5 : 0.75,
        borderRadius: 2,
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 3,
        },
        ...sx,
      }}
    >
      <Box sx={{ p: compact ? 1.5 : 2 }}>
        {/* 상단: 상품명 + 삭제 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              fontSize: compact ? '0.95rem' : { xs: '1rem', sm: '1.05rem' },
              lineHeight: 1.3,
              flex: 1,
              pr: 1,
            }}
          >
            {product.productName}
          </Typography>

          {/* 삭제 버튼 */}
          <IconButton
            size="small"
            color="error"
            onClick={onRemove}
            sx={{
              flexShrink: 0,
              mt: -0.5,
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* 카테고리 + 규격 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {/* 메인 카테고리 */}
          {product.mainCategory && (
            <Chip
              label={product.mainCategory}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
              }}
            />
          )}

          {/* 규격 */}
          {product.specification && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.8rem',
              }}
            >
              {product.specification}
            </Typography>
          )}
        </Box>

        {/* 가격 */}
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            fontSize: compact ? '0.85rem' : { xs: '0.9rem', sm: '1rem' },
            mb: 1.5,
          }}
        >
          ₩{price.toLocaleString()}
        </Typography>

        {/* 하단: 수량 조절 + 소계 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          {/* 수량 조절 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={handleDecrease}
              sx={{
                border: 1,
                borderColor: 'divider',
                width: compact ? 28 : 32,
                height: compact ? 28 : 32,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.lighter',
                },
              }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>

            <TextField
              size="small"
              value={quantity}
              onChange={handleDirectInput}
              sx={{
                width: compact ? 45 : 55,
                '& input': {
                  textAlign: 'center',
                  fontSize: compact ? '0.85rem' : '0.95rem',
                  fontWeight: 600,
                  padding: compact ? '4px 6px' : '6px 8px',
                },
              }}
              inputProps={{
                min: 1,
                type: 'number',
              }}
            />

            <IconButton
              size="small"
              onClick={handleIncrease}
              sx={{
                border: 1,
                borderColor: 'divider',
                width: compact ? 28 : 32,
                height: compact ? 28 : 32,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.lighter',
                },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* 라인 총액 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              소계
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: compact ? '0.95rem' : { xs: '1rem', sm: '1.1rem' },
                color: 'primary.main',
                lineHeight: 1.2,
              }}
            >
              ₩{lineTotal.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Card>
  );
};

export default CartItemCard;
