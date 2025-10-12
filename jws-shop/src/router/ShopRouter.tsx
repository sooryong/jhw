/**
 * 파일 경로: /src/router/ShopRouter.tsx
 * 작성 날짜: 2025-10-12
 * 주요 내용: JWS Shop v2.0 라우팅 시스템
 * 관련 데이터: React Router, 쇼핑몰 라우트
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ShopLayout from '../pages/shop/ShopLayout';
import CustomerSelectionPage from '../pages/shop/CustomerSelectionPage';
import CartPage from '../pages/shop/CartPage';
import OrderHistoryPage from '../pages/shop/OrderHistoryPage';
import OrderDetailPage from '../pages/shop/OrderDetailPage';
import FavoriteEditPage from '../pages/shop/FavoriteEditPage';
import ProductDetailPage from '../pages/shop/ProductDetailPage';
import ChangePasswordPage from '../pages/shop/ChangePasswordPage';
import MobileProductList from '../pages/shop/MobileProductList';

/**
 * JWS Shop Router
 * - 쇼핑몰 전용 라우팅 (v2.0)
 * - 고객사 선택 → 쇼핑 → 주문 흐름
 */

const ShopRouter: React.FC = () => {
  return (
    <Routes>
      {/* 고객사 선택 페이지 (진입점) */}
      <Route path="/shop/select-customer" element={<CustomerSelectionPage />} />

      {/* 비밀번호 변경 페이지 */}
      <Route path="/shop/change-password" element={<ChangePasswordPage />} />

      {/* 쇼핑몰 레이아웃으로 래핑된 라우트들 */}
      <Route path="/shop" element={<ShopLayout />}>
        {/* 모바일 상품 목록 */}
        <Route index element={<MobileProductList />} />

        {/* 상품 상세 */}
        <Route path="products/:productId" element={<ProductDetailPage />} />

        {/* 장바구니 */}
        <Route path="cart" element={<CartPage />} />

        {/* 주문 내역 */}
        <Route path="orders" element={<OrderHistoryPage />} />

        {/* 주문 상세 */}
        <Route path="orders/:orderId" element={<OrderDetailPage />} />

        {/* 즐겨찾기 편집 */}
        <Route path="favorites/edit" element={<FavoriteEditPage />} />
      </Route>

      {/* 루트 경로 → 고객사 선택 페이지로 리다이렉트 */}
      <Route path="/" element={<Navigate to="/shop/select-customer" replace />} />

      {/* 404 처리 → 고객사 선택 페이지로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/shop/select-customer" replace />} />
    </Routes>
  );
};

export default ShopRouter;
