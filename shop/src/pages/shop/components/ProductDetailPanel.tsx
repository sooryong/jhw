/**
 * 파일 경로: /src/pages/shop/components/ProductDetailPanel.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 상품 상세 패널 컴포넌트
 * 관련 데이터: products 컬렉션
 */

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Divider,
  Button,
  Chip,
  CardMedia,
  List,
  ListItem,
  CircularProgress,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Category as CategoryIcon,
  MonetizationOn as PriceIcon,
} from '@mui/icons-material';
import type { Product } from '../../../types/product'; // Updated: 2025-09-28
import type { Customer } from '../../../types/company'; // Updated: 2025-09-28

interface ProductDetailPanelProps {
  product: Product;
  customer: Customer | null;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  saving: boolean;
}

const ProductDetailPanel: React.FC<ProductDetailPanelProps> = ({
  product,
  customer,
  isFavorite,
  onFavoriteToggle,
  saving,
}) => {
  // 이미지 갤러리 상태
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  // 표시할 이미지 목록 (images 우선, 없으면 image 사용)
  const displayImages = React.useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    if (product.image) {
      return [product.image];
    }
    return ['/images/no-image.png'];
  }, [product.images, product.image]);

  // 고객사 유형별 가격 계산
  const getCustomerPrice = (): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
  };

  // 할인율 계산
  const getDiscountRate = (): number => {
    const standardPrice = product.salePrices.standard;
    const customerPrice = getCustomerPrice();
    if (standardPrice === 0) return 0;
    return Math.round(((standardPrice - customerPrice) / standardPrice) * 100);
  };


  return (
    <Paper
      elevation={3}
      sx={{
        width: { xs: '100%', lg: 450 },
        height: { xs: '100%', lg: 'calc(100vh - 16px)' },
        m: { xs: 0, lg: 1 },
        display: 'flex',
        flexDirection: 'column',
        position: { xs: 'static', lg: 'sticky' },
        top: { xs: 'auto', lg: 8 },
        overflow: 'hidden',
      }}
    >
      {/* 내용 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* 상품 이미지 갤러리 */}
        <Box>
          {/* 메인 이미지 */}
          <CardMedia
            component="img"
            height="250"
            image={displayImages[selectedImageIndex]}
            alt={product.productName}
            sx={{ objectFit: 'cover', cursor: displayImages.length > 1 ? 'pointer' : 'default' }}
            onClick={() => {
              if (displayImages.length > 1) {
                setSelectedImageIndex((prev) => (prev + 1) % displayImages.length);
              }
            }}
          />

          {/* 썸네일 리스트 (이미지가 2개 이상일 때만 표시) */}
          {displayImages.length > 1 && (
            <Box sx={{
              display: 'flex',
              gap: 1,
              p: 1,
              overflowX: 'auto',
              bgcolor: 'grey.50',
              borderBottom: 1,
              borderColor: 'divider'
            }}>
              {displayImages.map((img, index) => (
                <Box
                  key={index}
                  component="img"
                  src={img}
                  alt={`${product.productName} ${index + 1}`}
                  onClick={() => setSelectedImageIndex(index)}
                  sx={{
                    width: 60,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: 2,
                    borderColor: selectedImageIndex === index ? 'primary.main' : 'transparent',
                    opacity: selectedImageIndex === index ? 1 : 0.6,
                    transition: 'all 0.2s',
                    '&:hover': {
                      opacity: 1,
                      borderColor: 'primary.light',
                    }
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2 }}>
          {/* 상품명 */}
          <Typography variant="h6" component="h3" gutterBottom>
            {product.productName}
          </Typography>

          {/* 상품 규격 */}
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {product.specification}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* 카테고리 정보 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CategoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {product.mainCategory}
                {product.subCategory && ` > ${product.subCategory}`}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* 가격 정보 */}
          <Box sx={{ mb: 2 }}>
            {/* 고객사 최종 할인가격 */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, border: 2, borderColor: 'primary.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PriceIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    최종 할인가격
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  ₩{getCustomerPrice().toLocaleString()}
                </Typography>
              </Box>
            </Box>

            {/* 표준 가격 및 할인율 */}
            <List dense>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">표준 가격</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ₩{product.salePrices.standard.toLocaleString()}
                  </Typography>
                </Box>
              </ListItem>

              {getDiscountRate() > 0 && (
                <ListItem sx={{ px: 0, py: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2" color="text.secondary">할인율</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      {getDiscountRate()}% 할인
                    </Typography>
                  </Box>
                </ListItem>
              )}
            </List>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* 상품 상태 */}
          <Box sx={{ mb: 2 }}>
            <Chip
              label={product.isActive ? '판매중' : '판매중지'}
              color={product.isActive ? 'success' : 'error'}
              size="small"
            />
          </Box>

          {/* 유통기한 정보 */}
          {(product.expirationDate || product.shelfLife) && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ mb: 2 }}>
                {product.expirationDate && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>유통기한:</strong> {product.expirationDate}
                  </Typography>
                )}
                {product.shelfLife && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>보관기간:</strong> {product.shelfLife}
                  </Typography>
                )}
              </Box>
            </>
          )}

          {/* 상품 설명 */}
          {product.description && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {product.description}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* 하단 버튼 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          variant={isFavorite ? 'outlined' : 'contained'}
          fullWidth
          size="large"
          onClick={onFavoriteToggle}
          disabled={saving}
          startIcon={
            saving ? (
              <CircularProgress size={20} />
            ) : isFavorite ? (
              <StarIcon />
            ) : (
              <StarBorderIcon />
            )
          }
          color={isFavorite ? 'warning' : 'primary'}
        >
          {saving
            ? '처리 중...'
            : isFavorite
            ? '즐겨찾기에서 제거'
            : '즐겨찾기에 추가'
          }
        </Button>
      </Box>
    </Paper>
  );
};

export default ProductDetailPanel;