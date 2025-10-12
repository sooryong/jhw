/**
 * 파일 경로: /src/services/customerLinkService.ts
 * 작성 날짜: 2025-09-28
 * 주요 내용: SMS 수신자와 고객사 연결 관리 서비스
 * 관련 데이터: customers.smsRecipient 연결 관리
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Customer } from '../types/company'; // Updated: 2025-09-28
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
  private collectionName = 'customers';

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

      snapshot.forEach((doc) => {
        const customer = doc.data() as Customer;

        // person1 확인 (번호 비교 시 정규화)
        if (customer.smsRecipient?.person1?.mobile &&
            compareNumbers(customer.smsRecipient.person1.mobile, normalizedMobile)) {
          linkedCustomers.push({
            businessNumber: customer.businessNumber,
            businessName: customer.businessName,
            recipientRole: 'person1',
            recipientName: customer.smsRecipient.person1.name,
            customerType: customer.customerType,
          });

          if (!recipientName) {
            recipientName = customer.smsRecipient.person1.name;
          }
        }

        // person2 확인 (있는 경우, 번호 비교 시 정규화)
        if (customer.smsRecipient?.person2?.mobile &&
            compareNumbers(customer.smsRecipient.person2.mobile, normalizedMobile)) {
          linkedCustomers.push({
            businessNumber: customer.businessNumber,
            businessName: customer.businessName,
            recipientRole: 'person2',
            recipientName: customer.smsRecipient.person2.name,
            customerType: customer.customerType,
          });

          if (!recipientName) {
            recipientName = customer.smsRecipient.person2.name;
          }
        }
      });

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