/**
 * 파일 경로: /src/pages/shop/FavoriteEditPage.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 즐겨찾기 편집 페이지 (모바일 최적화 - 카드형)
 * 관련 데이터: customers.favoriteProducts, products
 * 업데이트: 테이블 → 가로 카드 리스트, 상품 상세 Dialog
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
  Typography,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomer } from '../../contexts/CustomerContext';
import type { Product } from '../../types/product';
import type { Customer, FavoriteProduct } from '../../types/company';
import { getProducts } from '../../services/productService';
import { updateCustomer } from '../../services/customerService';
import { getSetting } from '../../services/settingsService';
import FavoriteEditCard from '../../components/shop/FavoriteEditCard';

interface CategoryTab {
  code: string;
  name: string;
  count: number;
}

const FavoriteEditPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { customer: customerFromContext, updateFavorites } = useCustomer();

  // 상태 관리
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // 스크롤 이벤트 핸들러
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 100) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY) {
        setShowHeader(false); // 아래로 스크롤
      } else {
        setShowHeader(true); // 위로 스크롤
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // 고객사 변경 시 데이터 로드
  useEffect(() => {
    if (customerFromContext) {
      if (!customer || customer.businessNumber !== customerFromContext.businessNumber) {
        setFavoriteProductIds([]);
        setAllProducts([]);
        loadData();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerFromContext]);

  const loadData = async () => {
    if (!customerFromContext) {
      setError('선택된 고객사가 없습니다. 고객사를 선택해주세요.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 고객사 정보 설정
      setCustomer(customerFromContext);

      // 즐겨찾기 상품 ID 목록 설정
      const favoriteIds = customerFromContext.favoriteProducts?.map(fp => fp.productId) || [];
      setFavoriteProductIds(favoriteIds);

      // 병렬 실행: 전체 상품 조회 + 설정 조회
      const [products, settings] = await Promise.all([
        getProducts(), // 전체 상품 조회
        getSetting()
      ]);

      setAllProducts(products);

      // 카테고리 목록 생성
      const productCategories = settings?.productCategories || {};
      loadCategoriesSync(products, productCategories);

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
    // 전체 상품들의 카테고리별 개수 계산
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
    let filtered = allProducts;

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      const selectedCategoryName = categories.find(cat => cat.code === selectedCategory)?.name;
      filtered = allProducts.filter(product => product.mainCategory === selectedCategoryName);
    }

    // 검색 필터링
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(product =>
        product.productName.toLowerCase().includes(searchLower) ||
        product.specification?.toLowerCase().includes(searchLower) ||
        product.mainCategory?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allProducts, selectedCategory, searchText, categories]);

  // 즐겨찾기 토글 (낙관적 업데이트)
  const handleFavoriteToggle = async (product: Product) => {
    if (!customer || !user) return;

    const productId = product.productId;
    if (!productId) return;

    // 1. UI 즉시 업데이트 (낙관적)
    const isFavorite = favoriteProductIds.includes(productId);
    const previousFavoriteIds = [...favoriteProductIds];

    if (isFavorite) {
      setFavoriteProductIds(prev => prev.filter(id => id !== productId));
    } else {
      setFavoriteProductIds(prev => [...prev, productId]);
    }

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
      setFavoriteProductIds(previousFavoriteIds);
    }
  };

  // 상품 클릭 (상세보기)
  const handleProductClick = (product: Product) => {
    const customerParam = searchParams.get('customer');
    const targetPath = customerParam ? `/shop/favorites/product/${product.productId}?customer=${customerParam}` : `/shop/favorites/product/${product.productId}`;
    navigate(targetPath);
  };

  // 검색창 초기화
  const handleClearSearch = () => {
    setSearchText('');
  };

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
        {/* 검색창 */}
        <Box sx={{ p: 2, pb: 1 }}>
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
                    <CloseIcon fontSize="small" />
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
        </Box>

        {/* 즐겨찾기 배지 */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            전체 상품: {filteredProducts.length}개
          </Typography>
          <Chip
            icon={<StarIcon />}
            label={`즐겨찾기: ${favoriteProductIds.length}개`}
            color="warning"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        {/* 카테고리 탭 */}
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
      </Paper>

      {/* 상품 리스트 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {filteredProducts.length === 0 ? (
            <Alert severity="info" sx={{ mt: 4 }}>
              {searchText
                ? `'${searchText}'에 대한 검색 결과가 없습니다.`
                : '선택한 카테고리에 상품이 없습니다.'}
            </Alert>
          ) : (
            <Box sx={{ px: { xs: 1, sm: 0 } }}>
              {filteredProducts.map((product) => (
                <FavoriteEditCard
                  key={product.productId}
                  product={product}
                  customer={customer}
                  isFavorite={favoriteProductIds.includes(product.productId || '')}
                  onToggleFavorite={handleFavoriteToggle}
                  onClick={handleProductClick}
                />
              ))}
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default FavoriteEditPage;
