/**
 * 파일 경로: /src/services/customerUserService.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 사용자 관리 서비스
 * 관련 데이터: Firebase users 컬렉션, customers 컬렉션
 */

import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import type { JWSUser } from '../types/user';
import type { CustomerUserNotificationPreferences, CustomerUserRole } from '../types/user';
import type { Customer } from '../types/company';
import { normalizeNumber, normalizeBusinessNumber } from '../utils/numberUtils';

/**
 * 고객사 사용자 생성 데이터
 */
export interface CreateCustomerUserData {
  name: string;
  mobile: string;
  customerId: string; // 사업자번호
  customerRole: CustomerUserRole;
  notificationPreferences?: Partial<CustomerUserNotificationPreferences>;
  password?: string; // 선택사항, 없으면 휴대폰 뒷 4자리
}

/**
 * 고객사 사용자 목록 항목
 */
export interface CustomerUserListItem {
  uid: string;
  name: string;
  mobile: string;
  customerRole: CustomerUserRole;
  isActive: boolean;
  lastLogin: Date | null;
  requiresPasswordChange: boolean;
  notificationPreferences: CustomerUserNotificationPreferences;
}

/**
 * 기본 비밀번호 생성 (휴대폰 번호 뒷 4자리)
 */
function generateDefaultPassword(mobile: string): string {
  const numbers = mobile.replace(/[^0-9]/g, '');
  return numbers.slice(-4);
}

/**
 * 고객사의 모든 사용자 조회
 */
export async function getCustomerUsers(customerId: string): Promise<CustomerUserListItem[]> {
  try {
    const normalizedId = normalizeBusinessNumber(customerId);

    const usersQuery = query(
      collection(db, 'users'),
      where('roles', 'array-contains', 'customer'),
      where('linkedCustomers', 'array-contains', normalizedId)
    );

    const snapshot = await getDocs(usersQuery);

    const users: CustomerUserListItem[] = [];

    for (const doc of snapshot.docs) {
      const userData = doc.data() as JWSUser;

      users.push({
        uid: userData.uid,
        name: userData.name,
        mobile: userData.mobile,
        customerRole: userData.smsRecipientInfo?.customerRole || 'member',
        isActive: userData.isActive,
        lastLogin: userData.lastLogin || null,
        requiresPasswordChange: userData.requiresPasswordChange,
        notificationPreferences: userData.smsRecipientInfo?.notificationPreferences || {
          receiveOrderNotifications: true,
          receivePaymentNotifications: true,
          receivePromotionNotifications: true
        }
      });
    }

    // customerRole 순서로 정렬 (primary -> secondary -> member)
    users.sort((a, b) => {
      const roleOrder = { primary: 0, secondary: 1, member: 2 };
      return roleOrder[a.customerRole] - roleOrder[b.customerRole];
    });

    return users;
  } catch (error) {
      // Error handled silently
    console.error('Error getting customer users:', error);
    throw error;
  }
}

/**
 * 고객사 사용자 상세 정보 조회
 */
export async function getCustomerUserDetail(userId: string): Promise<JWSUser | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as JWSUser;
  } catch (error) {
      // Error handled silently
    console.error('Error getting customer user detail:', error);
    throw error;
  }
}

/**
 * 새 고객사 사용자 생성 (Cloud Function 호출)
 */
export async function createCustomerUser(
  data: CreateCustomerUserData
): Promise<{ uid: string }> {
  try {
    const normalizedMobile = normalizeNumber(data.mobile);
    const normalizedCustomerId = normalizeBusinessNumber(data.customerId);
    const password = data.password || generateDefaultPassword(data.mobile);

    // Cloud Function 호출
    const { createUserAccountFunction } = await import('../config/firebase');

    const result = await createUserAccountFunction({
      name: data.name,
      mobile: normalizedMobile,
      password,
      roles: ['customer'],
      linkedCustomers: [normalizedCustomerId],
      isActive: true,
      smsRecipientInfo: {
        mobile: normalizedMobile,
        name: data.name,
        linkedCustomerNumbers: [normalizedCustomerId],
        recipientRole: data.customerRole === 'primary' ? 'person1' : 'person2',
        customerRole: data.customerRole,
        notificationPreferences: {
          receiveOrderNotifications: data.notificationPreferences?.receiveOrderNotifications ?? true,
          receivePaymentNotifications: data.notificationPreferences?.receivePaymentNotifications ?? true,
          receivePromotionNotifications: data.notificationPreferences?.receivePromotionNotifications ?? true
        }
      }
    });

    // 고객사 문서의 authorizedUsers에 추가
    await addUserToCustomer(normalizedCustomerId, result.uid, data.customerRole);

    return { uid: result.uid };
  } catch (error) {
      // Error handled silently
    console.error('Error creating customer user:', error);
    throw error;
  }
}

/**
 * 기존 사용자를 고객사에 연결
 */
export async function linkUserToCustomer(
  userId: string,
  customerId: string,
  customerRole: CustomerUserRole
): Promise<void> {
  try {
    const normalizedCustomerId = normalizeBusinessNumber(customerId);

    await runTransaction(db, async (transaction) => {
      // 1. 사용자 문서 업데이트
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as JWSUser;

      if (!userData.roles.includes('customer')) {
        throw new Error('User is not a customer role');
      }

      const linkedCustomers = userData.linkedCustomers || [];
      if (!linkedCustomers.includes(normalizedCustomerId)) {
        linkedCustomers.push(normalizedCustomerId);
      }

      transaction.update(userRef, {
        linkedCustomers,
        'smsRecipientInfo.linkedCustomerNumbers': linkedCustomers,
        'smsRecipientInfo.customerRole': customerRole,
        updatedAt: Timestamp.now()
      });

      // 2. 고객사 문서 업데이트
      const customerRef = doc(db, 'customers', normalizedCustomerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error('Customer not found');
      }

      const customerData = customerDoc.data() as Customer;
      const authorizedUsers = customerData.authorizedUsers || [];

      if (!authorizedUsers.includes(userId)) {
        authorizedUsers.push(userId);
      }

      const updateData: Record<string, unknown> = {
        authorizedUsers,
        updatedAt: Timestamp.now()
      };

      // customerRole에 따라 primary/secondary 담당자 설정
      if (customerRole === 'primary') {
        updateData.primaryContactUserId = userId;
      } else if (customerRole === 'secondary') {
        updateData.secondaryContactUserId = userId;
      }

      transaction.update(customerRef, updateData);
    });
  } catch (error) {
      // Error handled silently
    console.error('Error linking user to customer:', error);
    throw error;
  }
}

/**
 * 고객사에서 사용자 제거
 */
export async function removeUserFromCustomer(
  userId: string,
  customerId: string
): Promise<void> {
  try {
    const normalizedCustomerId = normalizeBusinessNumber(customerId);

    await runTransaction(db, async (transaction) => {
      // 1. 사용자 문서 업데이트
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as JWSUser;
      const linkedCustomers = (userData.linkedCustomers || []).filter(
        id => id !== normalizedCustomerId
      );

      transaction.update(userRef, {
        linkedCustomers,
        'smsRecipientInfo.linkedCustomerNumbers': linkedCustomers,
        updatedAt: Timestamp.now()
      });

      // 2. 고객사 문서 업데이트
      const customerRef = doc(db, 'customers', normalizedCustomerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error('Customer not found');
      }

      const customerData = customerDoc.data() as Customer;
      const authorizedUsers = (customerData.authorizedUsers || []).filter(
        uid => uid !== userId
      );

      const updateData: Record<string, unknown> = {
        authorizedUsers,
        updatedAt: Timestamp.now()
      };

      // primary/secondary 담당자인 경우 해제
      if (customerData.primaryContactUserId === userId) {
        updateData.primaryContactUserId = null;
      }
      if (customerData.secondaryContactUserId === userId) {
        updateData.secondaryContactUserId = null;
      }

      transaction.update(customerRef, updateData);
    });
  } catch (error) {
      // Error handled silently
    console.error('Error removing user from customer:', error);
    throw error;
  }
}

/**
 * 사용자 알림 설정 업데이트
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<CustomerUserNotificationPreferences>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as JWSUser;
    const currentPreferences = userData.smsRecipientInfo?.notificationPreferences || {
      receiveOrderNotifications: true,
      receivePaymentNotifications: true,
      receivePromotionNotifications: true
    };

    const updatedPreferences = {
      ...currentPreferences,
      ...preferences
    };

    await updateDoc(userRef, {
      'smsRecipientInfo.notificationPreferences': updatedPreferences,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
      // Error handled silently
    console.error('Error updating notification preferences:', error);
    throw error;
  }
}

/**
 * 고객사의 담당자 변경 (primary 또는 secondary)
 */
export async function updateContactRole(
  customerId: string,
  userId: string,
  newRole: 'primary' | 'secondary'
): Promise<void> {
  try {
    const normalizedCustomerId = normalizeBusinessNumber(customerId);

    await runTransaction(db, async (transaction) => {
      // 1. 고객사 문서 업데이트
      const customerRef = doc(db, 'customers', normalizedCustomerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error('Customer not found');
      }

      const updateData: Record<string, unknown> = {
        updatedAt: Timestamp.now()
      };

      if (newRole === 'primary') {
        updateData.primaryContactUserId = userId;
      } else {
        updateData.secondaryContactUserId = userId;
      }

      transaction.update(customerRef, updateData);

      // 2. 사용자 문서 업데이트
      const userRef = doc(db, 'users', userId);
      transaction.update(userRef, {
        'smsRecipientInfo.customerRole': newRole,
        'smsRecipientInfo.recipientRole': newRole === 'primary' ? 'person1' : 'person2',
        updatedAt: Timestamp.now()
      });
    });
  } catch (error) {
      // Error handled silently
    console.error('Error updating contact role:', error);
    throw error;
  }
}

/**
 * 사용자를 고객사에 추가 (내부 헬퍼 함수)
 */
async function addUserToCustomer(
  customerId: string,
  userId: string,
  customerRole: CustomerUserRole
): Promise<void> {
  const customerRef = doc(db, 'customers', customerId);
  const customerDoc = await getDoc(customerRef);

  if (!customerDoc.exists()) {
    throw new Error('Customer not found');
  }

  const customerData = customerDoc.data() as Customer;
  const authorizedUsers = customerData.authorizedUsers || [];

  if (!authorizedUsers.includes(userId)) {
    authorizedUsers.push(userId);
  }

  const updateData: Record<string, unknown> = {
    authorizedUsers,
    updatedAt: Timestamp.now()
  };

  // customerRole에 따라 primary/secondary 담당자 설정
  if (customerRole === 'primary' && !customerData.primaryContactUserId) {
    updateData.primaryContactUserId = userId;
  } else if (customerRole === 'secondary' && !customerData.secondaryContactUserId) {
    updateData.secondaryContactUserId = userId;
  }

  await updateDoc(customerRef, updateData);
}

/**
 * 사용자 활성화/비활성화
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
      // Error handled silently
    console.error('Error toggling user active status:', error);
    throw error;
  }
}

/**
 * 고객사의 SMS 수신 대상 사용자 조회 (알림 설정 반영)
 */
export async function getSmsRecipients(
  customerId: string,
  notificationType: 'order' | 'payment' | 'promotion'
): Promise<Array<{ name: string; mobile: string }>> {
  try {
    const users = await getCustomerUsers(customerId);

    const recipients = users.filter(user => {
      if (!user.isActive) return false;

      const prefs = user.notificationPreferences;

      switch (notificationType) {
        case 'order':
          return prefs.receiveOrderNotifications;
        case 'payment':
          return prefs.receivePaymentNotifications;
        case 'promotion':
          return prefs.receivePromotionNotifications;
        default:
          return false;
      }
    });

    return recipients.map(user => ({
      name: user.name,
      mobile: user.mobile
    }));
  } catch (error) {
      // Error handled silently
    console.error('Error getting SMS recipients:', error);
    throw error;
  }
}
