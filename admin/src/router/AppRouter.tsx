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
// 매출주문 및 일일식품 발주 시스템
import SaleOrderStatusPage from '../pages/orders/SaleOrderStatusPage';
import DailyFoodCutoffSettingsPage from '../pages/orders/DailyFoodCutoffSettingsPage';
import DailyFoodPurchaseAggregationPage from '../pages/orders/DailyFoodPurchaseAggregationPage';
import DailyFoodPurchaseOrdersPage from '../pages/orders/DailyFoodPurchaseOrdersPage';

// 공통 페이지 (변경 없음)
import SaleOrderManagementPage from '../pages/orders/SaleOrderManagementPage';
import DailyFoodCustomerOrdersPage from '../pages/orders/DailyFoodCustomerOrdersPage';
import SaleProductAggregationPage from '../pages/orders/SaleProductAggregationPage';
import ProductAggregationDetailPage from '../pages/orders/ProductAggregationDetailPage';
import InboundManagementPage from '../pages/inbound/InboundManagementPage';
import InboundInspectionPage from '../pages/inbound/InboundInspectionPage';
import InboundPrintView from '../pages/inbound/InboundPrintView';
import PurchaseLedgerManagementPage from '../pages/inbound/PurchaseLedgerManagementPage';
import PurchaseLedgerDetailPage from '../pages/inbound/PurchaseLedgerDetailPage';
import OutboundManagementPage from '../pages/outbound/OutboundManagementPage';
import OutboundInspectionPage from '../pages/outbound/OutboundInspectionPage';
import OutboundPrintView from '../pages/outbound/OutboundPrintView';
import SaleLedgerListPage from '../pages/outbound/SaleLedgerListPage';
import SaleLedgerDetailPage from '../pages/outbound/SaleLedgerDetailPage';
import AccountLedgerPage from '../pages/account/AccountLedgerPage';
import PrintCenter from '../components/print/PrintCenter';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleBasedRedirect from '../components/RoleBasedRedirect';
import MainLayout from '../components/layout/MainLayout';
// 수금 관리
import CustomerCollectionListPage from '../pages/customer-collections/CustomerCollectionListPage';
import CustomerCollectionCreatePage from '../pages/customer-collections/CustomerCollectionCreatePage';
import CustomerLedgerPage from '../pages/customers/CustomerLedgerPage';
import CustomerAccountListPage from '../pages/customers/CustomerAccountListPage';
import CustomerStatementPage from '../pages/customers/CustomerStatementPage';
import CustomerUsersPage from '../pages/customers/CustomerUsersPage';
// 지급 관리
import SupplierPayoutListPage from '../pages/supplier-payouts/SupplierPayoutListPage';
import SupplierPayoutCreatePage from '../pages/supplier-payouts/SupplierPayoutCreatePage';
import SupplierAccountListPage from '../pages/suppliers/SupplierAccountListPage';
import SupplierStatementPage from '../pages/suppliers/SupplierStatementPage';
import SupplierLedgerPage from '../pages/suppliers/SupplierLedgerPage';

// 쇼핑몰 컴포넌트 제거 (v2.0 - jws-shop으로 분리됨)

/**
 * 권한 시스템:
 * - admin: 모든 기능 접근 가능
 * - staff: 입고/출하/원장(조회) 접근 가능
 * - customer: 플랫폼 접근 불가 (쇼핑몰만 이용 가능)
 */

const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 공개 라우트 - 로그인 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 비밀번호 변경 페이지 - 인증은 필요하지만 ProtectedRoute 없이 */}
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* 보호된 라우트들 - MainLayout으로 래핑 (관리자/직원 전용) */}
      {/* 매출주문 접수 */}
      <Route
        path="/orders/sale-order-status"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SaleOrderStatusPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 일일식품 발주 */}
      <Route
        path="/orders/daily-food-cutoff-settings"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyFoodCutoffSettingsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/sale-order-management"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SaleOrderManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/daily-food-orders"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyFoodCustomerOrdersPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/sale-aggregation"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SaleProductAggregationPage />
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

      {/* 일일식품 매입 집계 */}
      <Route
        path="/orders/daily-food-purchase-aggregation"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyFoodPurchaseAggregationPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 일일식품 매입 발주 */}
      <Route
        path="/orders/daily-food-purchase-orders"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <DailyFoodPurchaseOrdersPage />
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
              <InboundManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/inbound/inspect/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <InboundInspectionPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/inbound/print/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <InboundPrintView />
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

      {/* 매입원장 관리 */}
      <Route
        path="/ledgers/purchase"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <PurchaseLedgerManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 매입 원장 상세 */}
      <Route
        path="/ledgers/purchase/detail/:ledgerNumber"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <PurchaseLedgerDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 매출 원장 조회 */}
      <Route
        path="/ledgers/sales"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SaleLedgerListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 매출 원장 상세 */}
      <Route
        path="/ledgers/sales/detail/:ledgerNumber"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SaleLedgerDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 거래처원장 조회 */}
      <Route
        path="/account-ledger"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <AccountLedgerPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 출하 관리 라우트 */}
      <Route
        path="/orders/outbound"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <OutboundManagementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/outbound/inspect/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <OutboundInspectionPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/outbound/print/:orderId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <OutboundPrintView />
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

      <Route
        path="/customers/:businessNumber/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CustomerUsersPage />
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

      {/* 고객사 원장 통합 페이지 */}
      <Route
        path="/customers/ledger"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <CustomerLedgerPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 공급사 원장 통합 페이지 */}
      <Route
        path="/suppliers/ledger"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SupplierLedgerPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 수금 관리 라우트 (개별 접근용 유지) */}
      <Route
        path="/customer-collections"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <CustomerCollectionListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer-collections/create"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <CustomerCollectionCreatePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers/accounts"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <CustomerAccountListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers/statement"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff', 'customer']}>
            <MainLayout>
              <CustomerStatementPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 지급 관리 라우트 (개별 접근용 유지) */}
      <Route
        path="/supplier-payouts"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SupplierPayoutListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/supplier-payouts/create"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SupplierPayoutCreatePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/accounts"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SupplierAccountListPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/statement"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <MainLayout>
              <SupplierStatementPage />
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
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
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