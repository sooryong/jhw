/**
 * 파일 경로: /src/services/customerLinkService.ts
 * 작성 날짜: 2025-09-28
 * 업데이트: 2025-10-14 (사용자 기반 시스템으로 전환)
 * 주요 내용: 고객사 사용자와 고객사 연결 관리 서비스
 * 관련 데이터: users 컬렉션 (고객사 사용자)
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { JWSUser } from '../types/user';
import { normalizeNumber, compareNumbers } from '../utils/numberUtils';

// SMS 수신자 연결 정보
export interface SMSRecipientLink {
  businessNumber: string;
  businessName: string;
  recipientRole: 'person1' | 'person2'; // SMS 수신자 역할
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
  /**
   * 휴대폰번호로 사용자 정보 및 연결된 고객사 목록 조회
   * (마이그레이션 후: users 컬렉션에서 조회)
   */
  async findCustomersBySMSRecipient(mobile: string): Promise<SMSRecipientSearchResult | null> {
    try {
      // 휴대폰번호 정규화 (숫자만 추출)
      const normalizedMobile = normalizeNumber(mobile);

      // users 컬렉션에서 해당 휴대폰 번호의 customer 역할 사용자 조회
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'customer'),
        where('mobile', '==', normalizedMobile)
      );

      const usersSnapshot = await getDocs(usersQuery);

      if (usersSnapshot.empty) {
        return null;
      }

      // 첫 번째 사용자 정보 가져오기 (같은 번호는 하나의 사용자만 있어야 함)
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data() as JWSUser;

      if (!userData.smsRecipientInfo || !userData.linkedCustomers) {
        return null;
      }

      // 연결된 고객사 정보 조회
      const linkedCustomers: SMSRecipientLink[] = [];

      // 각 고객사 정보를 customers 컬렉션에서 조회
      for (const businessNumber of userData.linkedCustomers) {
        try {
          const customersCollection = collection(db, 'customers');
          const customersSnapshot = await getDocs(customersCollection);

          customersSnapshot.forEach((doc) => {
            const customer = doc.data();
            if (compareNumbers(customer.businessNumber, businessNumber)) {
              linkedCustomers.push({
                businessNumber: customer.businessNumber,
                businessName: customer.businessName,
                recipientRole: userData.smsRecipientInfo!.recipientRole || 'person1',
                recipientName: userData.name,
                customerType: customer.customerType || '일반고객',
              });
            }
          });
        } catch (error) {
      // Error handled silently
          console.error(`Failed to fetch customer ${businessNumber}:`, error);
        }
      }

      if (linkedCustomers.length === 0) {
        return null;
      }

      return {
        mobile: normalizedMobile,
        name: userData.name,
        linkedCustomers,
        hasMultipleCustomers: linkedCustomers.length > 1,
      };

    } catch (error) {
      // Error handled silently
      console.error('사용자 기반 고객사 검색 실패:', error);
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
   * SMS 수신자의 주 담당 고객사 조회 (person1 역할만)
   */
  async getPrimaryCustomers(mobile: string): Promise<SMSRecipientLink[]> {
    try {
      const result = await this.findCustomersBySMSRecipient(mobile);
      if (!result) return [];

      return result.linkedCustomers.filter(customer => customer.recipientRole === 'person1');
    } catch (error) {
      // Error handled silently
      console.error('주 담당 고객사 조회 실패:', error);
      return [];
    }
  }


  /**
   * SMS 수신자 역할별 권한 확인
   */
  getRecipientPermissions(role: 'person1' | 'person2') {
    return {
      canOrder: true, // 둘 다 주문 가능
      canViewHistory: true, // 둘 다 이력 조회 가능
      canManageFavorites: role === 'person1', // person1만 즐겨찾기 관리 가능
      isPrimary: role === 'person1', // person1이 주 담당자
    };
  }
}

// 싱글톤 인스턴스
export const customerLinkService = new CustomerLinkService();
export default customerLinkService;