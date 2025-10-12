/**
 * 파일 경로: /src/router/AppRouter.tsx
 * 작성 날짜: 2025-09-22
 * 업데이트: 2025-09-30 (RBAC 권한 시스템 추가)
 * 주요 내용: JWS 플랫폼 라우팅 시스템 - 인증 기반 라우팅
 * 관련 데이터: React Router, 보호된 라우트, 공개 라우트
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import SystemManagementPage from '../pages/system/SystemManagementPage';
import SMSCenterPage from '../pages/sms/SMSCenterPage';
import CustomerListPage from '../pages/customer/CustomerListPage';
import CustomerAddPage from '../pages/customer/CustomerAddPage';
import CustomerDetailPage from '../pages/customer/CustomerDetailPage';
import SupplierListPage from '../pages/supplier/SupplierListPage';
import SupplierAddPage from '../pages/supplier/SupplierAddPage';
import SupplierDetailPage from '../pages/supplier/SupplierDetailPage';
import ProductListPage from '../pages/product/ProductListPage';
import ProductAddPage from '../pages/product/ProductAddPage';
import ProductDetailPage from '../pages/product/ProductDetailPage';
import UserSettings from '../pages/user/UserSettings';
import UserChangePasswordPage from '../pages/user/UserChangePasswordPage';
import ProxyShoppingPage from '../pages/proxy-shopping/ProxyShoppingPage';
// 일일주문 확정 시스템
import DailyOrderManagementPage from '../pages/orders/DailyOrderManagementPage';
import DailyFoodPurchaseOrderPage from '../pages/orders/DailyFoodPurchaseOrderPage';

// 공통 페이지 (변경 없음)
import CustomerOrderListPage from '../pages/orders/CustomerOrderListPage';
import ProductAggregationPage from '../pages/orders/ProductAggregationPage';
import ProductAggregationDetailPage from '../pages/orders/ProductAggregationDetailPage';
import DailyOrderInboundManagementPage from '../pages/inbound/DailyOrderInboundManagementPage';
import DailyOrderInboundInspectionPage from '../pages/inbound/DailyOrderInboundInspectionPage';
import DailyOrderInboundPrintView from '../pages/inbound/DailyOrderInboundPrintView';
import PurchaseLedgerListPage from '../pages/inbound/PurchaseLedgerListPage';
import PrintCenter from '../components/print/PrintCenter';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleBasedRedirect from '../components/RoleBasedRedirect';
import MainLayout from '../components/layout/MainLayout';

// 쇼핑몰 컴포넌트 제거 (v2.0 - jws-shop으로 분리됨)

/**
 * 권한 시스템:
 * - admin: 모든 기능 접근 가능
 * - staff: 입고/출하/원장(조회), 대리쇼핑 접근 가능
 * - customer: 쇼핑몰만 접근 가능
 */

const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 공개 라우트 - 로그인 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 비밀번호 변경 페이지 - 인증은 필요하지만 ProtectedRoute 없이 */}
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* 보호된 라우트들 - MainLayout으로 래핑 (관리자/직원 전용) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 일일주문 확정 */}
      <Route
        path="/orders/management"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyOrderManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/customer-orders"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <CustomerOrderListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/product-aggregation"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <ProductAggregationPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/product-aggregation-detail"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <ProductAggregationDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 일일식품 매입주문 확인 */}
      <Route
        path="/orders/daily-food-purchase-orders"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyFoodPurchaseOrderPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 입고 관리 라우트 */}
      <Route
        path="/orders/inbound"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyOrderInboundManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/inbound/inspect/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyOrderInboundInspectionPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/inbound/print/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyOrderInboundPrintView />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 범용 인쇄 센터 */}
      <Route
        path="/print-center"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff', 'customer']}>
            <PrintCenter />
          </ProtectedRoute>
        }
      />

      {/* 매입 원장 조회 */}
      <Route
        path="/ledgers/purchase"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <PurchaseLedgerListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/outbound"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <div>출하 관리 (개발 예정)</div>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 대리 쇼핑 - admin/staff 전용 */}
      <Route
        path="/proxy-shopping"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <ProxyShoppingPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 고객사 관리 라우트 (admin만) */}
      <Route
        path="/customers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CustomerListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers/new"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CustomerAddPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers/:businessNumber"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CustomerDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers/:businessNumber/edit"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CustomerDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 공급사 관리 라우트 (admin만) */}
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <SupplierListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/new"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <SupplierAddPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/:businessNumber"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <SupplierDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 상품 관리 라우트 (admin만) */}
      <Route
        path="/products"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <ProductListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/new"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <ProductAddPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:productId"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <ProductDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 사용자 관리 라우트 (admin만) */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <UserSettings />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 사용자 비밀번호 변경 라우트 */}
      <Route
        path="/change-my-password"
        element={
          <ProtectedRoute>
            <MainLayout>
              <UserChangePasswordPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 향후 확장 예정 라우트들 */}

      <Route
        path="/categories"
        element={
          <ProtectedRoute>
            <MainLayout>
              <div>카테고리 설정 (개발 예정)</div>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/system"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <SystemManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sms"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <SMSCenterPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 루트 경로 역할별 리다이렉트 */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* 404 처리 */}
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  );
};

export default AppRouter;