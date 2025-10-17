/**
 * 파일 경로: /src/utils/rbac.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 역할 기반 접근 제어(RBAC) 유틸리티
 * 관련 데이터: 사용자 권한, 메뉴 접근 권한
 */

import type { UserRole } from '../types/user';

// 권한 정의
export type Permission =
  // 시스템 설정
  | 'settings.users.view'
  | 'settings.users.create'
  | 'settings.users.edit'
  | 'settings.users.delete'
  | 'settings.sms.view'
  | 'settings.sms.send'
  // 기준정보
  | 'reference.customers.view'
  | 'reference.customers.create'
  | 'reference.customers.edit'
  | 'reference.customers.delete'
  | 'reference.suppliers.view'
  | 'reference.suppliers.create'
  | 'reference.suppliers.edit'
  | 'reference.suppliers.delete'
  | 'reference.products.view'
  | 'reference.products.create'
  | 'reference.products.edit'
  | 'reference.products.delete'
  // 입고관리
  | 'inbound.view'
  | 'inbound.create'
  | 'inbound.edit'
  | 'inbound.delete'
  // 출하관리
  | 'outbound.view'
  | 'outbound.create'
  | 'outbound.edit'
  | 'outbound.delete'
  // 원장관리
  | 'ledger.view'
  | 'ledger.export'
  // 수금관리
  | 'payment.view'
  | 'payment.create'
  | 'payment.cancel'
  | 'statement.generate'
  // 지급관리
  | 'supplier_payment.view'
  | 'supplier_payment.create'
  | 'supplier_payment.cancel'
  | 'supplier_statement.generate'
  // 쇼핑몰
  | 'shop.access'
  | 'shop.order';

// 역할별 권한 매핑
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // 모든 권한
    'settings.users.view',
    'settings.users.create',
    'settings.users.edit',
    'settings.users.delete',
    'settings.sms.view',
    'settings.sms.send',
    'reference.customers.view',
    'reference.customers.create',
    'reference.customers.edit',
    'reference.customers.delete',
    'reference.suppliers.view',
    'reference.suppliers.create',
    'reference.suppliers.edit',
    'reference.suppliers.delete',
    'reference.products.view',
    'reference.products.create',
    'reference.products.edit',
    'reference.products.delete',
    'inbound.view',
    'inbound.create',
    'inbound.edit',
    'inbound.delete',
    'outbound.view',
    'outbound.create',
    'outbound.edit',
    'outbound.delete',
    'ledger.view',
    'ledger.export',
    'payment.view',
    'payment.create',
    'payment.cancel',
    'statement.generate',
    'supplier_payment.view',
    'supplier_payment.create',
    'supplier_payment.cancel',
    'supplier_statement.generate',
    'shop.access',
    'shop.order',
  ],
  staff: [
    // SMS 센터
    'settings.sms.view',
    'settings.sms.send',
    // 입고관리
    'inbound.view',
    'inbound.create',
    'inbound.edit',
    'inbound.delete',
    // 출하관리
    'outbound.view',
    'outbound.create',
    'outbound.edit',
    'outbound.delete',
    // 원장관리 (조회만)
    'ledger.view',
    // 수금관리
    'payment.view',
    'payment.create',
    'statement.generate',
    // 지급관리
    'supplier_payment.view',
    'supplier_payment.create',
    'supplier_statement.generate',
  ],
  customer: [
    // 쇼핑몰만
    'shop.access',
    'shop.order',
    // 거래명세서 조회
    'statement.generate',
  ],
  supplier: [
    // 공급사는 현재 시스템 접근 권한 없음 (SMS 수신자 역할만)
  ],
};

/**
 * 특정 역할이 특정 권한을 가지고 있는지 확인
 */
export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

/**
 * 특정 역할이 여러 권한 중 하나라도 가지고 있는지 확인
 */
export const hasAnyPermission = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * 특정 역할이 모든 권한을 가지고 있는지 확인
 */
export const hasAllPermissions = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * 특정 역할의 모든 권한 가져오기
 */
export const getRolePermissions = (role: UserRole): Permission[] => {
  return rolePermissions[role] ?? [];
};

// 메뉴 접근 권한 정의
export interface MenuAccess {
  path: string;
  requiredPermissions: Permission[]; // 하나라도 있으면 접근 가능
}

export const menuAccessRules: MenuAccess[] = [
  // 시스템 설정
  { path: '/settings/users', requiredPermissions: ['settings.users.view'] },
  { path: '/settings/sms', requiredPermissions: ['settings.sms.view'] },

  // 기준정보
  { path: '/customers', requiredPermissions: ['reference.customers.view'] },
  { path: '/suppliers', requiredPermissions: ['reference.suppliers.view'] },
  { path: '/products', requiredPermissions: ['reference.products.view'] },

  // 입고관리
  { path: '/inbound', requiredPermissions: ['inbound.view'] },

  // 출하관리
  { path: '/outbound', requiredPermissions: ['outbound.view'] },

  // 원장관리
  { path: '/ledger', requiredPermissions: ['ledger.view'] },

  // 수금관리
  { path: '/payments', requiredPermissions: ['payment.view'] },
  { path: '/customers/accounts', requiredPermissions: ['payment.view'] },
  { path: '/customers/statement', requiredPermissions: ['statement.generate'] },

  // 지급관리
  { path: '/supplier-payments', requiredPermissions: ['supplier_payment.view'] },
  { path: '/suppliers/accounts', requiredPermissions: ['supplier_payment.view'] },
  { path: '/suppliers/statement', requiredPermissions: ['supplier_statement.generate'] },

  // 쇼핑몰
  { path: '/shop', requiredPermissions: ['shop.access'] },
];

/**
 * 특정 경로에 접근할 수 있는지 확인
 */
export const canAccessPath = (role: UserRole, path: string): boolean => {
  const menuRule = menuAccessRules.find(rule => path.startsWith(rule.path));
  if (!menuRule) {
    return true; // 규칙이 없으면 기본적으로 허용
  }
  return hasAnyPermission(role, menuRule.requiredPermissions);
};