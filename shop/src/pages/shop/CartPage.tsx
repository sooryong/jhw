/**
 * 파일 경로: /src/pages/shop/CartPage.tsx
 * 작성 날짜: 2025-10-03
 * 주요 내용: 모바일 전용 장바구니 페이지 (쿠팡 스타일)
 * 관련 데이터: cart, products, customers
 * 업데이트: CartItemCard 컴포넌트로 리팩토링
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomer } from '../../contexts/CustomerContext';
import type { Product } from '../../types/product';
import type { CreateSaleOrderData, OrderItem } from '../../types/saleOrder';
import { getProducts } from '../../services/productService';
import { createSaleOrder } from '../../services/saleOrderService';
import CartItemCard from '../../components/shop/CartItemCard';

const DRAWER_WIDTH = 240;

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { state: cartState, updateCartItem, removeFromCart, clearCart } = useCart();
  const { customer } = useCustomer();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // 상품 데이터 로드
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await getProducts();
      setProducts(allProducts);
    } catch (error) {
      // Error handled silently
      console.error('상품 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 장바구니 아이템에 해당하는 상품 정보 조회
  const getCartItemsWithProducts = () => {
    return cartState.items.map(cartItem => {
      const product = products.find(p => p.productId === cartItem.productId);
      return {
        cartItem,
        product,
      };
    }).filter(item => item.product);
  };

  // 고객사 유형별 가격 계산
  const getCustomerPrice = (product: Product): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
  };

  // 총액 계산
  const calculateTotal = () => {
    let total = 0;
    cartState.items.forEach(cartItem => {
      const product = products.find(p => p.productId === cartItem.productId);
      if (product) {
        total += getCustomerPrice(product) * cartItem.quantity;
      }
    });
    return total;
  };

  // 수량 변경
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      updateCartItem(productId, newQuantity);
    }
  };

  // 주문하기
  const handleOrder = async () => {
    if (!customer || !user || cartState.items.length === 0) return;

    try {
      setOrderLoading(true);
      setOrderError(null);

      // 주문 아이템 구성
      const orderItems: OrderItem[] = cartState.items.map(cartItem => {
        const product = products.find(p => p.productId === cartItem.productId);
        if (!product || !product.productId) throw new Error(`상품을 찾을 수 없습니다: ${cartItem.productId}`);

        const unitPrice = getCustomerPrice(product);
        return {
          productId: product.productId,
          productName: product.productName,
          specification: product.specification || '',
          quantity: cartItem.quantity,
          unitPrice,
          lineTotal: unitPrice * cartItem.quantity,
        };
      });

      // 주문 데이터 구성
      const totalAmount = calculateTotal();
      const orderData: CreateSaleOrderData = {
        customerId: customer.businessNumber, // 하이픈 포함 형식
        customerInfo: {
          businessName: customer.businessName,
          customerType: customer.customerType,
        },
        orderItems,
        finalAmount: totalAmount,
        itemCount: cartState.items.length,
        orderType: 'customer',  // 고객이 직접 주문
        createdBy: user.uid,
      };

      // 주문 생성
      const orderId = await createSaleOrder(orderData);

      // 성공 처리 - 장바구니를 먼저 비운 후 성공 다이얼로그 표시
      clearCart(); // 즉시 장바구니 비우기 (배지 리셋)
      setCompletedOrderId(orderId);
      setOrderSuccess(true);

    } catch (error) {
      // Error handled silently
      console.error('주문 생성 실패:', error);
      setOrderError(error instanceof Error ? error.message : '주문 처리에 실패했습니다.');
    } finally {
      setOrderLoading(false);
    }
  };

  const cartItemsWithProducts = getCartItemsWithProducts();
  const totalAmount = calculateTotal();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  // 빈 장바구니
  if (cartState.items.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <ShoppingCartIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 3 }} />
        <Typography variant="h5" gutterBottom>
          장바구니가 비어있습니다
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            const customerParam = searchParams.get('customer');
            const targetPath = customerParam ? `/shop?customer=${customerParam}` : '/shop';
            navigate(targetPath);
          }}
          sx={{ minWidth: 200 }}
        >
          쇼핑 계속하기
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* 헤더 */}
      <Paper
        elevation={2}
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 0 },
          zIndex: 100,
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <ShoppingCartIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flex: 1 }}>
            장바구니
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {cartState.items.length}개 상품
          </Typography>
        </Box>
      </Paper>

      {/* 에러 메시지 */}
      {orderError && (
        <Alert
          severity="error"
          sx={{ m: 2 }}
          onClose={() => setOrderError(null)}
        >
          {orderError}
        </Alert>
      )}

      {/* 장바구니 아이템 목록 */}
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 14, md: 2 } }}>
        {cartItemsWithProducts.map(({ cartItem, product }, index) => (
          <CartItemCard
            key={cartItem.productId}
            product={product!}
            quantity={cartItem.quantity}
            price={getCustomerPrice(product!)}
            onQuantityChange={(newQuantity) => handleQuantityChange(cartItem.productId, newQuantity)}
            onRemove={() => removeFromCart(cartItem.productId)}
            sx={index === cartItemsWithProducts.length - 1 ? { mb: '50px' } : undefined}
          />
        ))}
      </Container>

      {/* 하단 고정 영역 */}
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: { xs: 64, md: 0 },
          left: { xs: 0, md: `${DRAWER_WIDTH}px` },
          right: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          p: { xs: 1.5, sm: 2 },
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          {/* 총액 - 1줄 레이아웃 */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: { xs: 1.5, sm: 2 },
            px: { xs: 1, sm: 0 }
          }}>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}
            >
              총 상품: {cartState.items.length}개
            </Typography>
            <Box component="span">
              <Typography
                component="span"
                variant="h6"
                color="text.secondary"
                sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, mr: 0.5 }}
              >
                합계:
              </Typography>
              <Typography
                component="span"
                variant="h5"
                sx={{
                  color: 'primary.main',
                  fontWeight: 'bold',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' }
                }}
              >
                ₩{totalAmount.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {/* 버튼들 */}
          <Box sx={{ display: 'flex', gap: 1, px: { xs: 1, sm: 0 } }}>
            <Button
              variant="outlined"
              size="large"
              onClick={() => setClearDialogOpen(true)}
              disabled={orderLoading}
              sx={{ flex: 1, fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              비우기
            </Button>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleOrder}
              disabled={orderLoading || !customer}
              startIcon={orderLoading ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
              sx={{ flex: 2, fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              {orderLoading ? '주문 처리중...' : '주문하기'}
            </Button>
          </Box>
        </Container>
      </Paper>

      {/* 주문 성공 다이얼로그 */}
      <Dialog
        open={orderSuccess}
        onClose={() => setOrderSuccess(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>주문 완료</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'success.main' }}>
              ✓ 주문이 성공적으로 접수되었습니다!
            </Typography>
            {completedOrderId && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                주문번호: {completedOrderId}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              주문 내역에서 확인하실 수 있습니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              setOrderSuccess(false);
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop?customer=${customerParam}` : '/shop';
              navigate(targetPath);
            }}
            sx={{ minWidth: 140 }}
          >
            계속 쇼핑하기
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={() => {
              setOrderSuccess(false);
              const customerParam = searchParams.get('customer');
              const targetPath = customerParam ? `/shop/orders?customer=${customerParam}` : '/shop/orders';
              navigate(targetPath);
            }}
            sx={{ minWidth: 140 }}
          >
            주문 내역 보기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 장바구니 비우기 확인 다이얼로그 */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>장바구니 비우기</DialogTitle>
        <DialogContent>
          <Typography>
            장바구니의 모든 상품을 제거하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>취소</Button>
          <Button
            onClick={() => {
              clearCart();
              setClearDialogOpen(false);
            }}
            color="error"
          >
            비우기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CartPage;
