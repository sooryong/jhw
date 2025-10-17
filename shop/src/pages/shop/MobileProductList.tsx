/**
 * 파일 경로: /src/pages/shop/MobileProductList.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 모바일 최적화 상품 리스트 (쿠팡 스타일)
 * 특징: 카드 그리드, 카테고리 탭, 실시간 검색, 무한 스크롤
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Container,
  Chip,
  Fab,
  Badge,
  Typography,
  IconButton,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useCart } from '../../contexts/CartContext';
import { useCustomer } from '../../contexts/CustomerContext';
import type { Product } from '../../types/product';
import { getProductsByIds } from '../../services/productService';
import { getSetting } from '../../services/settingsService';
import HorizontalProductCard from '../../components/shop/HorizontalProductCard';

interface CategoryTab {
  code: string;
  name: string;
  count: number;
}

const MobileProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: cartState, addToCart, calculateTotals } = useCart();
  const { customer, loading: customerLoading, error: customerError } = useCustomer();

  // 상태 관리
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // 플로팅 버튼 드래그 상태
  const [fabPosition, setFabPosition] = useState({ x: 75 }); // x는 퍼센트 (좌우 위치만)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0 });

  // 데이터 로드
  useEffect(() => {
    if (!customerLoading && customer) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, customerLoading]);

  // 장바구니 총액 계산
  useEffect(() => {
    if (favoriteProducts.length > 0) {
      calculateTotals(favoriteProducts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartState.items, favoriteProducts]);

  // 스크롤 이벤트 핸들러 (검색창 숨기기/보이기)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 100px 이상 스크롤 했을 때만 동작
      if (currentScrollY < 100) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY) {
        // 아래로 스크롤 → 숨김
        setShowHeader(false);
      } else {
        // 위로 스크롤 → 표시
        setShowHeader(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const loadData = async () => {
    if (customerLoading) {
      setLoading(true);
      return;
    }

    if (customerError) {
      setError(customerError);
      setLoading(false);
      return;
    }

    if (!customer) {
      setError('선택된 고객사가 없습니다. 고객사를 선택해주세요.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 즐겨찾기 상품 ID 목록
      const favoriteProductIds = customer.favoriteProducts?.map(fp => fp.productId) || [];

      // 병렬 실행: 즐겨찾기 상품만 조회 + 전체 설정 조회
      const [favoriteProductList, settings] = await Promise.all([
        getProductsByIds(favoriteProductIds),
        getSetting()
      ]);

      setFavoriteProducts(favoriteProductList);

      // 카테고리 목록 생성
      const productCategories = settings?.productCategories || {};
      loadCategoriesSync(favoriteProductList, productCategories);

    } catch (err) {
      console.error('데이터 로드 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesSync = (
    products: Product[],
    productCategories: Record<string, string>
  ) => {
    // 즐겨찾기 상품들의 카테고리별 개수 계산
    const categoryCounts: { [key: string]: number } = {};
    products.forEach(product => {
      const category = product.mainCategory || '기타';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // 카테고리 탭 구성
    const tabs: CategoryTab[] = [
      { code: 'all', name: '전체', count: products.length },
    ];

    Object.entries(productCategories).forEach(([code, name]) => {
      const count = categoryCounts[name] || 0;
      if (count > 0) {
        tabs.push({ code, name, count });
      }
    });

    setCategories(tabs);
  };

  // 카테고리 필터링 및 검색
  const filteredProducts = useMemo(() => {
    let filtered = favoriteProducts;

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      const selectedCategoryName = categories.find(cat => cat.code === selectedCategory)?.name;
      filtered = favoriteProducts.filter(product => product.mainCategory === selectedCategoryName);
    }

    // 검색 필터링 (debounce 적용됨)
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(product =>
        product.productName.toLowerCase().includes(searchLower) ||
        product.specification?.toLowerCase().includes(searchLower) ||
        product.mainCategory?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [favoriteProducts, selectedCategory, searchText, categories]);

  // 장바구니 추가 핸들러
  const handleAddToCart = (productId: string, quantity: number) => {
    addToCart(productId, quantity);
  };

  // 검색창 초기화
  const handleClearSearch = () => {
    setSearchText('');
  };

  // 플로팅 버튼 드래그 핸들러 (좌우로만 이동)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    // 현재 버튼의 절대 X 위치 계산
    const currentXPixels = window.innerWidth * fabPosition.x / 100;
    setDragStart({
      x: e.clientX - currentXPixels,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    // 새로운 X 위치 계산 (픽셀 단위)
    const newXPixels = e.clientX - dragStart.x;
    // 퍼센트로 변환
    const newX = (newXPixels / window.innerWidth) * 100;

    // 화면 경계 제한 (왼쪽 10% ~ 오른쪽 90%)
    const boundedX = Math.max(10, Math.min(90, newX));

    setFabPosition({ x: boundedX }); // Y축은 고정
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 드래그 이벤트 리스너
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragStart]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pb: { xs: 6, md: '60px' } }}>
      {/* 상단 고정 영역 */}
      <Paper
        elevation={2}
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 0 },
          zIndex: 100,
          borderRadius: 0,
          transform: showHeader ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* 검색창 + 장바구니 버튼 */}
        <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="상품명, 규격으로 검색..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: 'background.default',
              },
            }}
          />

          {/* 데스크톱: 텍스트 버튼 */}
          <Button
            variant="contained"
            color="primary"
            startIcon={
              <Badge badgeContent={cartState.totalItems} color="error">
                <ShoppingCartIcon />
              </Badge>
            }
            onClick={() => {
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop/cart?customer=${customerParam}` : '/shop/cart';
              navigate(targetPath);
            }}
            sx={{
              display: { xs: 'none', md: 'flex' },
              px: 12.66,
              whiteSpace: 'nowrap',
            }}
          >
            장바구니
          </Button>
        </Box>

        {/* 카테고리 탭 - 즐겨찾기 상품이 있을 때만 표시 */}
        {favoriteProducts.length > 0 && (
          <Tabs
            value={selectedCategory}
            onChange={(_, newValue) => setSelectedCategory(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 1,
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                fontWeight: 600,
              },
            }}
          >
            {categories.map((category) => (
              <Tab
                key={category.code}
                value={category.code}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {category.name}
                    <Chip
                      size="small"
                      label={category.count}
                      color={selectedCategory === category.code ? 'primary' : 'default'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        )}
      </Paper>

      {/* 상품 그리드 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {/* 검색 결과 안내 */}
          {searchText && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                <strong>{filteredProducts.length}개</strong>의 상품을 찾았습니다
              </Typography>
              <IconButton size="small" onClick={loadData}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
          )}

          {favoriteProducts.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
              gap: 2,
              mt: 4
            }}>
              <Alert severity="info" sx={{ maxWidth: '600px' }}>
                <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
                  즐겨찾기 상품이 없습니다.
                </Typography>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  즐겨찾기 편집 메뉴에서 자주 이용하는 상품을 즐겨찾기
                  <StarIcon sx={{ fontSize: '1rem', color: '#FFC107' }} />
                  로 선택하세요.
                </Typography>
              </Alert>
            </Box>
          ) : filteredProducts.length === 0 ? (
            <Alert severity="info" sx={{ mt: 4 }}>
              {searchText
                ? `'${searchText}'에 대한 검색 결과가 없습니다.`
                : '선택한 카테고리에 즐겨찾기 상품이 없습니다. 즐겨찾기 편집 메뉴에서 이 카테고리의 상품을 즐겨찾기로 추가하세요.'}
            </Alert>
          ) : (
            <Box sx={{ px: { xs: 1, sm: 0 } }}>
              {filteredProducts.map((product) => (
                <HorizontalProductCard
                  key={product.productId}
                  product={product}
                  customer={customer}
                  onAddToCart={handleAddToCart}
                  onProductClick={(productId) => {
                    const customerParam = searchParams.get('customer');
                    const targetPath = customerParam ? `/shop/favorites/product/${productId}?customer=${customerParam}` : `/shop/favorites/product/${productId}`;
                    navigate(targetPath);
                  }}
                />
              ))}
            </Box>
          )}
        </Container>
      </Box>

      {/* 데스크톱 플로팅 장바구니 버튼 (드래그 가능) */}
      {cartState.totalItems > 0 && (
        <Fab
          color="primary"
          aria-label="장바구니 보기"
          onClick={() => {
            if (!isDragging) {
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop/cart?customer=${customerParam}` : '/shop/cart';
              navigate(targetPath);
            }
          }}
          onMouseDown={handleMouseDown}
          sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'fixed',
            bottom: 24, // 하단 고정
            left: `${fabPosition.x}%`,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            boxShadow: 4,
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'all 0.3s',
            '&:hover': {
              transform: isDragging ? 'translateX(-50%)' : 'translateX(-50%) scale(1.05)',
            },
          }}
        >
          <Badge badgeContent={cartState.totalItems} color="error" max={99}>
            <ShoppingCartIcon />
          </Badge>
        </Fab>
      )}
    </Box>
  );
};

export default MobileProductList;
