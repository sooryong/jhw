/**
 * 파일 경로: /src/services/customerLinkService.ts
 * 작성 날짜: 2025-09-28
 * 업데이트: 2025-10-14 - primaryUserId/secondaryUserId 기반으로 변경
 * 주요 내용: 사용자와 고객사 연결 관리 서비스
 * 관련 데이터: customers 컬렉션 (primaryUserId, secondaryUserId)
 */

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Customer } from '../types/company';
import type { JWSUser } from '../types/user';
import { normalizeNumber, compareNumbers } from '../utils/numberUtils';

// SMS 수신자 연결 정보
export interface SMSRecipientLink {
  businessNumber: string;
  businessName: string;
  recipientRole: 'primary' | 'secondary'; // 주 담당자 / 부 담당자
  recipientName: string;
  customerType: string;
}

// SMS 수신자 검색 결과
export interface SMSRecipientSearchResult {
  mobile: string;
  name: string;
  linkedCustomers: SMSRecipientLink[];
  hasMultipleCustomers: boolean;
}

export class CustomerLinkService {
  private collectionName = 'customers';
  private usersCollectionName = 'users';

  /**
   * userId로 사용자 정보 조회
   */
  private async getUserById(userId: string): Promise<JWSUser | null> {
    try {
      const userRef = doc(db, this.usersCollectionName, userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return { ...userSnap.data(), uid: userSnap.id } as JWSUser;
      }
      return null;
    } catch (error) {
      // Error handled silently
      console.error(`사용자 ${userId} 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 휴대폰번호로 연결된 고객사 목록 조회
   */
  async findCustomersBySMSRecipient(mobile: string): Promise<SMSRecipientSearchResult | null> {
    try {
      // 휴대폰번호 정규화 (숫자만 추출)
      const normalizedMobile = normalizeNumber(mobile);

      const customersCollection = collection(db, this.collectionName);
      const snapshot = await getDocs(customersCollection);

      const linkedCustomers: SMSRecipientLink[] = [];
      let recipientName = '';

      // 모든 고객사를 순회하며 primaryUserId와 secondaryUserId 확인
      for (const customerDoc of snapshot.docs) {
        const customer = customerDoc.data() as Customer;

        // primaryUserId 확인
        if (customer.primaryUserId) {
          const primaryUser = await this.getUserById(customer.primaryUserId);
          if (primaryUser && primaryUser.mobile && compareNumbers(primaryUser.mobile, normalizedMobile)) {
            linkedCustomers.push({
              businessNumber: customer.businessNumber,
              businessName: customer.businessName,
              recipientRole: 'primary',
              recipientName: primaryUser.name,
              customerType: customer.customerType,
            });

            if (!recipientName) {
              recipientName = primaryUser.name;
            }
          }
        }

        // secondaryUserId 확인 (있는 경우)
        if (customer.secondaryUserId) {
          const secondaryUser = await this.getUserById(customer.secondaryUserId);
          if (secondaryUser && secondaryUser.mobile && compareNumbers(secondaryUser.mobile, normalizedMobile)) {
            linkedCustomers.push({
              businessNumber: customer.businessNumber,
              businessName: customer.businessName,
              recipientRole: 'secondary',
              recipientName: secondaryUser.name,
              customerType: customer.customerType,
            });

            if (!recipientName) {
              recipientName = secondaryUser.name;
            }
          }
        }
      }

      if (linkedCustomers.length === 0) {
        return null;
      }

      return {
        mobile: normalizedMobile,
        name: recipientName,
        linkedCustomers,
        hasMultipleCustomers: linkedCustomers.length > 1,
      };

    } catch (error) {
      // Error handled silently
      console.error('SMS 수신자 기반 고객사 검색 실패:', error);
      throw new Error('고객사 연결 정보를 조회할 수 없습니다.');
    }
  }

  /**
   * SMS 수신자가 특정 고객사에 접근 권한이 있는지 확인
   */
  async hasCustomerAccess(mobile: string, businessNumber: string): Promise<boolean> {
    try {
      const result = await this.findCustomersBySMSRecipient(mobile);
      if (!result) return false;

      return result.linkedCustomers.some(
        customer => compareNumbers(customer.businessNumber, businessNumber)
      );
    } catch (error) {
      // Error handled silently
      console.error('고객사 접근 권한 확인 실패:', error);
      return false;
    }
  }

  /**
   * SMS 수신자의 주 담당 고객사 조회 (primary 역할만)
   */
  async getPrimaryCustomers(mobile: string): Promise<SMSRecipientLink[]> {
    try {
      const result = await this.findCustomersBySMSRecipient(mobile);
      if (!result) return [];

      return result.linkedCustomers.filter(customer => customer.recipientRole === 'primary');
    } catch (error) {
      // Error handled silently
      console.error('주 담당 고객사 조회 실패:', error);
      return [];
    }
  }

  /**
   * SMS 수신자 역할별 권한 확인
   */
  getRecipientPermissions(role: 'primary' | 'secondary') {
    return {
      canOrder: true, // 둘 다 주문 가능
      canViewHistory: true, // 둘 다 이력 조회 가능
      canManageFavorites: role === 'primary', // primary만 즐겨찾기 관리 가능
      isPrimary: role === 'primary', // primary가 주 담당자
    };
  }
}

// 싱글톤 인스턴스
export const customerLinkService = new CustomerLinkService();
export default customerLinkService;
