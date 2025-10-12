/**
 * 파일 경로: /src/pages/shop/components/CartPanel.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 장바구니 패널 컴포넌트
 * 관련 데이터: 장바구니 상태 관리
 */

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  Box,
  IconButton,
  TextField,
  Button,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { Product } from '../../../types/product'; // Updated: 2025-09-28
import type { Customer } from '../../../types/company'; // Updated: 2025-09-28
import type { CreateSaleOrderData, OrderItem } from '../../../types/saleOrder'; // Updated: 2025-09-28
import { createSaleOrder } from '../../../services/saleOrderService';

interface CartPanelProps {
  products: Product[];
  customer: Customer | null;
}

const CartPanel: React.FC<CartPanelProps> = ({ products, customer }) => {
  const { user } = useAuth();
  const { state: cartState, updateCartItem, removeFromCart, clearCart } = useCart();

  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // 장바구니 아이템에 해당하는 상품 정보 조회
  const getCartItemsWithProducts = () => {
    return cartState.items.map(cartItem => {
      const product = products.find(p => p.productId === cartItem.productId);
      return {
        cartItem,
        product,
      };
    }).filter(item => item.product); // 상품 정보가 있는 것만 필터링
  };

  // 고객사 유형별 가격 계산
  const getCustomerPrice = (product: Product): number => {
    if (!customer) return product.salePrices.standard;
    const customerTypePrice = product.salePrices.customerTypes?.[customer.customerType];
    return customerTypePrice || product.salePrices.standard;
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
      const orderData: CreateSaleOrderData = {
        customerId: customer.businessNumber, // 하이픈 포함 형식
        customerInfo: {
          businessName: customer.businessName,
          customerType: customer.customerType,
        },
        orderItems,
        finalAmount: cartState.totalAmount,
        itemCount: cartState.totalItems,
        orderType: 'customer',  // 고객이 직접 주문
        createdBy: user.uid,
      };

      // 주문 생성
      await createSaleOrder(orderData);

      // 성공 처리
      setOrderSuccess(true);
      clearCart();

      // 3초 후 성공 메시지 숨김
      setTimeout(() => {
        setOrderSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('주문 생성 실패:', error);
      setOrderError(error instanceof Error ? error.message : '주문 처리에 실패했습니다.');
    } finally {
      setOrderLoading(false);
    }
  };

  // 장바구니 비우기 확인
  const handleClearCart = () => {
    setClearDialogOpen(true);
  };

  const handleClearConfirm = () => {
    clearCart();
    setClearDialogOpen(false);
  };

  const cartItemsWithProducts = getCartItemsWithProducts();

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          width: { xs: '100%', lg: 300 },
          height: { xs: 'auto', lg: 'calc(100vh - 16px)' },
          m: { xs: 0, lg: 1 },
          display: 'flex',
          flexDirection: 'column',
          position: { xs: 'static', lg: 'sticky' },
          top: { xs: 'auto', lg: 8 },
        }}
      >
        {/* 헤더 */}
        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCartIcon />
              <Typography variant="h6">장바구니</Typography>
            </Box>
            <Typography variant="body2">
              ({cartState.totalItems})
            </Typography>
          </Box>
        </Box>

        {/* 성공 메시지 */}
        {orderSuccess && (
          <Alert severity="success" sx={{ m: 1 }}>
            주문이 성공적으로 접수되었습니다!
          </Alert>
        )}

        {/* 에러 메시지 */}
        {orderError && (
          <Alert
            severity="error"
            sx={{ m: 1 }}
            onClose={() => setOrderError(null)}
          >
            {orderError}
          </Alert>
        )}

        {/* 장바구니 아이템 목록 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {cartItemsWithProducts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <ShoppingCartIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography>장바구니가 비어있습니다</Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {cartItemsWithProducts.map(({ cartItem, product }, index) => (
                <ListItem
                  key={cartItem.productId}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderBottom: 1,
                    borderColor: 'divider',
                    p: 2,
                    ...(index === cartItemsWithProducts.length - 1 && { mb: '50px' }),
                  }}
                >
                  {/* 상품 정보 */}
                  <Typography variant="subtitle2" noWrap sx={{ mb: 1 }}>
                    {product!.productName}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {product!.specification}
                  </Typography>

                  {/* 가격 */}
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 2 }}>
                    ₩{getCustomerPrice(product!).toLocaleString()}
                  </Typography>

                  {/* 수량 조절 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleQuantityChange(cartItem.productId, cartItem.quantity - 1)}
                      >
                        <RemoveIcon />
                      </IconButton>

                      <TextField
                        size="small"
                        value={cartItem.quantity}
                        onChange={(e) => {
                          const newQuantity = parseInt(e.target.value) || 0;
                          handleQuantityChange(cartItem.productId, newQuantity);
                        }}
                        sx={{ width: 60 }}
                        inputProps={{
                          min: 1,
                          style: { textAlign: 'center' }
                        }}
                      />

                      <IconButton
                        size="small"
                        onClick={() => handleQuantityChange(cartItem.productId, cartItem.quantity + 1)}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeFromCart(cartItem.productId)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  {/* 라인 총액 */}
                  <Typography
                    variant="body2"
                    sx={{ textAlign: 'right', mt: 1, fontWeight: 'bold' }}
                  >
                    소계: ₩{(getCustomerPrice(product!) * cartItem.quantity).toLocaleString()}
                  </Typography>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* 하단 요약 및 버튼 */}
        {cartItemsWithProducts.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              {/* 총합 */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">총 {cartState.totalItems}품목</Typography>
                  <Typography variant="body2">
                    ₩{cartState.totalAmount.toLocaleString()}
                  </Typography>
                </Box>

                <Typography variant="h6" sx={{ textAlign: 'right', color: 'primary.main' }}>
                  합계: ₩{cartState.totalAmount.toLocaleString()}
                </Typography>
              </Box>

              {/* 버튼들 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleOrder}
                  disabled={orderLoading || !customer}
                  startIcon={orderLoading ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
                >
                  {orderLoading ? '주문 처리중...' : '주문하기'}
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  onClick={handleClearCart}
                  startIcon={<ClearIcon />}
                  disabled={orderLoading}
                >
                  장바구니 비우기
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Paper>

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
          <Button onClick={handleClearConfirm} color="error">
            비우기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CartPanel;