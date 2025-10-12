/**
 * 파일 경로: /src/services/customerService.ts
 * 작성 날짜: 2025-09-24
 * 업데이트: 2025-09-29 (번호 정규화 규칙 적용)
 * 주요 내용: 고객사 관리 서비스 - customers 컬렉션
 * 관련 데이터: Firebase customers 컬렉션 (문서 ID = 사업자등록번호)
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  QueryConstraint,
  deleteField
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Customer,
  CustomerDisplay,
  CustomerFormData,
  CustomerFilter,
  CustomerSMSRecipients
} from '../types/company';
import {
  CompanyServiceError
} from '../types/company';
import {
  normalizeNumber,
  normalizeBusinessNumber,
  formatMobile,
  formatBusinessNumber,
  formatPhone,
  isValidBusinessNumber,
  isValidMobile,
  isValidPhone
} from '../utils/numberUtils';
import type {
  NormalizedMobile,
  NormalizedBusinessNumber,
  NormalizedPhone,
  FormattedMobile,
  FormattedBusinessNumber,
  FormattedPhone
} from '../types/phoneNumber';
import { findUserByMobile, addCustomerToUser, createCustomerUser } from './userService';

export class CustomerService {
  private collectionName = 'customers';

  /**
   * CustomerFormData를 Customer 저장용 타입으로 변환
   * @param formData 폼 데이터
   * @returns 정규화된 Customer 객체
   */
  private convertFormDataToCustomer(formData: CustomerFormData): Omit<Customer, 'createdAt' | 'updatedAt'> {
    // 사업자등록번호 정규화 및 검증 (하이픈 포함 형식)
    const normalizedBusinessNumber = normalizeBusinessNumber(formData.businessNumber) as NormalizedBusinessNumber;
    if (!isValidBusinessNumber(normalizedBusinessNumber)) {
      throw new CompanyServiceError('유효하지 않은 사업자등록번호입니다.', 'INVALID_BUSINESS_NUMBER');
    }

    // 휴대폰번호들 정규화 및 검증
    const normalizedSmsRecipient: CustomerSMSRecipients = {
      person1: {
        name: formData.smsRecipient.person1.name,
        mobile: normalizeNumber(formData.smsRecipient.person1.mobile) as NormalizedMobile
      }
    };

    if (!isValidMobile(normalizedSmsRecipient.person1.mobile)) {
      throw new CompanyServiceError('SMS 수신자1 휴대폰번호가 올바르지 않습니다.', 'INVALID_MOBILE');
    }

    if (formData.smsRecipient.person2) {
      const normalizedPerson2Mobile = normalizeNumber(formData.smsRecipient.person2.mobile) as NormalizedMobile;
      if (!isValidMobile(normalizedPerson2Mobile)) {
        throw new CompanyServiceError('SMS 수신자2 휴대폰번호가 올바르지 않습니다.', 'INVALID_MOBILE');
      }
      normalizedSmsRecipient.person2 = {
        name: formData.smsRecipient.person2.name,
        mobile: normalizedPerson2Mobile
      };
    }

    // 회사 연락처 정규화 (선택 필드)
    let presidentMobile: NormalizedMobile | undefined;
    let businessPhone: NormalizedPhone | undefined;

    if (formData.presidentMobile) {
      presidentMobile = normalizeNumber(formData.presidentMobile) as NormalizedMobile;
      if (!isValidMobile(presidentMobile)) {
        throw new CompanyServiceError('회사 휴대폰번호가 올바르지 않습니다.', 'INVALID_BUSINESS_MOBILE');
      }
    }

    if (formData.businessPhone) {
      businessPhone = normalizeNumber(formData.businessPhone) as NormalizedPhone;
      if (!isValidPhone(businessPhone)) {
        throw new CompanyServiceError('회사 전화번호가 올바르지 않습니다.', 'INVALID_BUSINESS_PHONE');
      }
    }

    const result: any = {
      businessNumber: normalizedBusinessNumber,
      businessName: formData.businessName,
      president: formData.president,
      businessAddress: formData.businessAddress,
      businessType: formData.businessType,
      businessItem: formData.businessItem,
      businessEmail: formData.businessEmail || '',
      smsRecipient: normalizedSmsRecipient,
      isActive: formData.isActive,
      customerType: formData.customerType,
      discountRate: formData.discountRate,
      currentBalance: formData.currentBalance,
      specialPrices: formData.specialPrices || [],
      favoriteProducts: formData.favoriteProducts || []
    };

    // 선택 필드는 값이 있을 때만 추가
    if (presidentMobile) {
      result.presidentMobile = presidentMobile;
    }
    if (businessPhone) {
      result.businessPhone = businessPhone;
    }

    return result;
  }

  /**
   * Customer를 표시용 타입으로 변환
   * @param customer 저장된 Customer 객체
   * @returns 포맷된 CustomerDisplay 객체
   */
  private convertCustomerToDisplay(customer: Customer): CustomerDisplay {
    return {
      ...customer,
      businessNumber: formatBusinessNumber(customer.businessNumber) as FormattedBusinessNumber,
      presidentMobile: customer.presidentMobile
        ? formatMobile(customer.presidentMobile) as FormattedMobile
        : undefined,
      businessPhone: customer.businessPhone
        ? formatPhone(customer.businessPhone) as FormattedPhone
        : undefined,
      smsRecipient: {
        person1: {
          name: customer.smsRecipient.person1.name,
          mobile: formatMobile(customer.smsRecipient.person1.mobile) as FormattedMobile
        },
        person2: customer.smsRecipient.person2 ? {
          name: customer.smsRecipient.person2.name,
          mobile: formatMobile(customer.smsRecipient.person2.mobile) as FormattedMobile
        } : undefined
      }
    };
  }

  // 고객사 생성
  async createCustomer(formData: CustomerFormData): Promise<string> {
    try {
      // 폼 데이터를 정규화된 Customer 객체로 변환
      const normalizedCustomer = this.convertFormDataToCustomer(formData);
      const businessNumberId = normalizedCustomer.businessNumber;

      // 중복 검사
      await this.checkDuplicateBusinessNumber(businessNumberId);

      const now = Timestamp.now();
      const customerData: Customer = {
        ...normalizedCustomer,
        createdAt: now,
        updatedAt: now,
      };

      // 사업자등록번호를 문서 ID로 사용
      const customerRef = doc(db, this.collectionName, businessNumberId);
      await setDoc(customerRef, customerData);

      // SMS 수신자 자동 사용자 처리
      try {
        await this.processSMSRecipients(businessNumberId, normalizedCustomer.smsRecipient);
        console.log(`고객사 ${formData.businessName} (${businessNumberId}) 생성 및 SMS 수신자 처리 완료`);
      } catch (error) {
        console.error(`고객사 ${formData.businessName} SMS 수신자 자동 처리 실패:`, {
          businessNumber: businessNumberId,
          businessName: formData.businessName,
          smsRecipient: normalizedCustomer.smsRecipient,
          error: error instanceof Error ? error.message : error
        });
        // 고객사 등록은 성공으로 처리하고, SMS 수신자 처리 실패는 로그만 남김
      }

      return businessNumberId;
    } catch (error) {
      console.error('고객사 생성 오류 상세:', error);
      if (error instanceof CompanyServiceError) {
        throw error;
      }
      throw new CompanyServiceError('고객사 생성 중 오류가 발생했습니다.', 'CREATE_FAILED');
    }
  }

  // 고객사 목록 조회
  async getCustomers(filter: CustomerFilter = {}): Promise<Customer[]> {
    try {
      const constraints: QueryConstraint[] = [];

      // 활성 상태 필터
      if (filter.isActive !== undefined) {
        constraints.push(where('isActive', '==', filter.isActive));
      }

      // 고객사 타입 필터
      if (filter.customerType) {
        constraints.push(where('customerType', '==', filter.customerType));
      }

      // Firestore 쿼리 실행 (정렬은 클라이언트 사이드에서 처리)
      const q = query(collection(db, this.collectionName), ...constraints);
      const snapshot = await getDocs(q);

      let customers = snapshot.docs.map(doc => ({
        ...doc.data(),
        // 문서 ID가 정규화된 사업자등록번호이므로 그대로 사용
        businessNumber: doc.id as NormalizedBusinessNumber
      }) as Customer);

      // 텍스트 검색 (클라이언트 사이드 필터링)
      if (filter.searchText) {
        const searchText = filter.searchText.toLowerCase();
        customers = customers.filter(customer => {
          // 검색을 위해 포맷된 번호로 변환하여 비교
          const formattedBusinessNumber = formatBusinessNumber(customer.businessNumber);
          const formattedBusinessMobile = customer.presidentMobile ? formatMobile(customer.presidentMobile) : '';
          const formattedBusinessPhone = customer.businessPhone ? formatPhone(customer.businessPhone) : '';
          const formattedSmsRecipient1 = formatMobile(customer.smsRecipient.person1.mobile);
          const formattedSmsRecipient2 = customer.smsRecipient.person2 ? formatMobile(customer.smsRecipient.person2.mobile) : '';

          return customer.businessName.toLowerCase().includes(searchText) ||
                 customer.president.toLowerCase().includes(searchText) ||
                 formattedBusinessNumber.includes(searchText) ||
                 formattedBusinessMobile.includes(searchText) ||
                 formattedBusinessPhone.includes(searchText) ||
                 formattedSmsRecipient1.includes(searchText) ||
                 formattedSmsRecipient2.includes(searchText);
        });
      }

      // 정렬: 유형, 회사명 순
      customers.sort((a, b) => {
        // 1차: 유형 비교
        if (a.customerType !== b.customerType) {
          return a.customerType.localeCompare(b.customerType, 'ko-KR');
        }
        // 2차: 회사명 비교
        return a.businessName.localeCompare(b.businessName, 'ko-KR');
      });

      return customers;
    } catch {
      // 오류 처리: 고객사 목록 조회 실패
      throw new CompanyServiceError('고객사 목록을 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 고객사 개수 조회
  async getCustomerCount(filter: CustomerFilter = {}): Promise<number> {
    try {
      let q = query(collection(db, this.collectionName));

      // 필터 적용
      if (filter.searchText) {
        // 검색어가 있는 경우 모든 데이터를 가져와서 필터링
        const allDocs = await getDocs(q);
        const searchText = filter.searchText.toLowerCase();

        return allDocs.docs.filter(doc => {
          const data = doc.data();
          return (
            data.businessName?.toLowerCase().includes(searchText) ||
            data.businessNumber?.toLowerCase().includes(searchText) ||
            data.contactPerson?.toLowerCase().includes(searchText) ||
            data.phone?.toLowerCase().includes(searchText)
          );
        }).length;
      }

      if (filter.isActive !== undefined) {
        q = query(q, where('isActive', '==', filter.isActive));
      }

      if (filter.customerType) {
        q = query(q, where('customerType', '==', filter.customerType));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch {
      // 오류 처리: 고객사 개수 조회 실패
      throw new CompanyServiceError('고객사 개수를 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 고객사 상세 조회
  async getCustomer(businessNumber: string): Promise<Customer | null> {
    try {
      const businessNumberId = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;
      const docRef = doc(db, this.collectionName, businessNumberId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          ...docSnap.data(),
          // 문서 ID가 정규화된 사업자등록번호 (하이픈 포함)
          businessNumber: docSnap.id as NormalizedBusinessNumber
        } as Customer;
      }

      return null;
    } catch {
      throw new CompanyServiceError('고객사 정보를 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 고객사 수정
  async updateCustomer(businessNumber: string, formData: Partial<CustomerFormData>): Promise<void> {
    try {
      const businessNumberId = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;
      const docRef = doc(db, this.collectionName, businessNumberId);

      // 기존 문서 존재 확인
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new CompanyServiceError('존재하지 않는 고객사입니다.', 'NOT_FOUND');
      }

      const updateData: Partial<Customer> = {
        updatedAt: Timestamp.now()
      };

      // 기본 정보 업데이트
      if (formData.businessName) updateData.businessName = formData.businessName;
      if (formData.president) updateData.president = formData.president;
      if (formData.businessAddress) updateData.businessAddress = formData.businessAddress;
      if (formData.businessType) updateData.businessType = formData.businessType;
      if (formData.businessItem) updateData.businessItem = formData.businessItem;

      // 연락처 업데이트 (정규화 적용, 빈 값은 필드 삭제)
      if (formData.presidentMobile !== undefined) {
        if (formData.presidentMobile) {
          updateData.presidentMobile = normalizeNumber(formData.presidentMobile) as NormalizedMobile;
        } else {
          updateData.presidentMobile = deleteField() as any; // Firestore에서 필드 삭제
        }
      }
      if (formData.businessPhone !== undefined) {
        if (formData.businessPhone) {
          updateData.businessPhone = normalizeNumber(formData.businessPhone) as NormalizedPhone;
        } else {
          updateData.businessPhone = deleteField() as any; // Firestore에서 필드 삭제
        }
      }
      if (formData.businessEmail !== undefined) {
        updateData.businessEmail = formData.businessEmail || ''; // 빈 문자열 저장 (이메일은 필드 유지)
      }

      // SMS 수신자 업데이트 (정규화 적용)
      if (formData.smsRecipient) {
        const normalizedSmsRecipient: CustomerSMSRecipients = {
          person1: {
            name: formData.smsRecipient.person1.name,
            mobile: normalizeNumber(formData.smsRecipient.person1.mobile) as NormalizedMobile
          }
        };
        if (formData.smsRecipient.person2) {
          normalizedSmsRecipient.person2 = {
            name: formData.smsRecipient.person2.name,
            mobile: normalizeNumber(formData.smsRecipient.person2.mobile) as NormalizedMobile
          };
        }
        updateData.smsRecipient = normalizedSmsRecipient;
      }

      // 상태 업데이트
      if (formData.isActive !== undefined) updateData.isActive = formData.isActive;

      // 고객사 전용 필드 업데이트
      if (formData.customerType) updateData.customerType = formData.customerType;
      if (formData.discountRate !== undefined) updateData.discountRate = formData.discountRate;
      if (formData.currentBalance !== undefined) updateData.currentBalance = formData.currentBalance;

      // 새로운 필드들 업데이트
      if (formData.specialPrices) updateData.specialPrices = formData.specialPrices;
      if (formData.favoriteProducts) updateData.favoriteProducts = formData.favoriteProducts;

      await updateDoc(docRef, updateData);
    } catch (error) {
      if (error instanceof CompanyServiceError) {
        throw error;
      }
      console.error('고객사 업데이트 오류:', error);
      throw new CompanyServiceError('고객사 정보 수정 중 오류가 발생했습니다.', 'UPDATE_FAILED');
    }
  }

  // 고객사 삭제
  async deleteCustomer(businessNumber: string): Promise<void> {
    try {
      const businessNumberId = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;
      const docRef = doc(db, this.collectionName, businessNumberId);

      // 존재 확인
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new CompanyServiceError('존재하지 않는 고객사입니다.', 'NOT_FOUND');
      }

      await deleteDoc(docRef);
    } catch (error) {
      if (error instanceof CompanyServiceError) {
        throw error;
      }
      throw new CompanyServiceError('고객사 삭제 중 오류가 발생했습니다.', 'DELETE_FAILED');
    }
  }

  // 사업자등록번호 중복 검사
  private async checkDuplicateBusinessNumber(businessNumberId: NormalizedBusinessNumber): Promise<void> {
    // customers 컬렉션에서 확인
    const customerDocRef = doc(db, 'customers', businessNumberId);
    const customerDoc = await getDoc(customerDocRef);

    if (customerDoc.exists()) {
      throw new CompanyServiceError('이미 고객사로 등록된 사업자등록번호입니다.', 'DUPLICATE_BUSINESS_NUMBER');
    }

    // suppliers 컬렉션에서도 확인
    const supplierDocRef = doc(db, 'suppliers', businessNumberId);
    const supplierDoc = await getDoc(supplierDocRef);

    if (supplierDoc.exists()) {
      throw new CompanyServiceError('이미 공급사로 등록된 사업자등록번호입니다.', 'DUPLICATE_BUSINESS_NUMBER');
    }
  }

  // 고객사 통계
  async getCustomerStats(): Promise<{
    total: number;
    active: number;
    totalOutstanding: number;
    byType: Record<string, number>;
  }> {
    try {
      const customers = await this.getCustomers();

      const stats = {
        total: customers.length,
        active: customers.filter(c => c.isActive).length,
        totalOutstanding: customers.reduce((sum, c) => sum + c.currentBalance, 0),
        byType: {} as Record<string, number>
      };

      // 타입별 통계
      customers.forEach(customer => {
        stats.byType[customer.customerType] = (stats.byType[customer.customerType] || 0) + 1;
      });

      return stats;
    } catch {
      throw new CompanyServiceError('고객사 통계를 불러올 수 없습니다.', 'STATS_FAILED');
    }
  }

  /**
   * SMS 수신자 자동 사용자 처리
   * @param businessNumber 고객사 사업자등록번호 (하이픈 제거된 형태)
   * @param smsRecipient SMS 수신자 정보
   */
  private async processSMSRecipients(businessNumber: string, smsRecipient: CustomerSMSRecipients): Promise<void> {
    console.log(`고객사 ${businessNumber} SMS 수신자 자동 처리 시작`);

    if (!smsRecipient) {
      console.warn(`고객사 ${businessNumber}: SMS 수신자 정보가 없습니다.`);
      return;
    }

    // person1 (필수) 처리
    if (smsRecipient.person1?.mobile && smsRecipient.person1?.name) {
      if (this.isValidMobile(smsRecipient.person1.mobile)) {
        await this.processRecipient(businessNumber, smsRecipient.person1, 'person1');
      } else {
        console.warn(`고객사 ${businessNumber}: person1 휴대폰번호 형식이 올바르지 않습니다: ${smsRecipient.person1.mobile}`);
      }
    } else {
      console.warn(`고객사 ${businessNumber}: person1 정보가 불완전합니다.`, smsRecipient.person1);
    }

    // person2 (선택) 처리
    if (smsRecipient.person2?.mobile && smsRecipient.person2?.name) {
      if (this.isValidMobile(smsRecipient.person2.mobile)) {
        await this.processRecipient(businessNumber, smsRecipient.person2, 'person2');
      } else {
        console.warn(`고객사 ${businessNumber}: person2 휴대폰번호 형식이 올바르지 않습니다: ${smsRecipient.person2.mobile}`);
      }
    }

    console.log(`고객사 ${businessNumber} SMS 수신자 자동 처리 완료`);
  }

  /**
   * 휴대폰번호 유효성 검사 (numberUtils 사용)
   * @param mobile 휴대폰번호
   * @returns 유효 여부
   */
  private isValidMobile(mobile: string): boolean {
    if (!mobile) return false;
    const normalized = normalizeNumber(mobile) as NormalizedMobile;
    return isValidMobile(normalized);
  }

  /**
   * 개별 SMS 수신자 처리
   * @param businessNumber 고객사 사업자등록번호 (정규화된)
   * @param recipient SMS 수신자 정보
   * @param role 수신자 역할 (person1/person2)
   */
  private async processRecipient(
    businessNumber: string,
    recipient: { name: string; mobile: NormalizedMobile },
    role: 'person1' | 'person2'
  ): Promise<void> {
    try {
      console.log(`SMS 수신자 처리: ${recipient.name}(${recipient.mobile}) - ${role}`);

      // 기존 사용자 확인 (정규화된 번호로 검색)
      const existingUser = await findUserByMobile(recipient.mobile);

      if (existingUser) {
        // 기존 사용자: 고객사 색인에 추가
        console.log(`기존 사용자 발견: ${existingUser.name}(${existingUser.uid})`);
        await addCustomerToUser(existingUser.uid, businessNumber);
        console.log(`사용자 ${existingUser.uid}에 고객사 ${businessNumber} 추가 완료`);
      } else {
        // 신규 사용자: customer 역할로 생성
        console.log(`신규 사용자 생성: ${recipient.name}(${recipient.mobile})`);
        const newUser = await createCustomerUser(recipient, [businessNumber]);
        console.log(`신규 사용자 생성 완료: ${newUser.uid}, 기본 비밀번호: ${newUser.defaultPassword}`);

        // TODO: SMS 발송 기능 추가 시 여기서 계정 정보 발송
        // await sendAccountCreationSMS(recipient.mobile, newUser.defaultPassword);
      }
    } catch (error) {
      console.error(`SMS 수신자 ${recipient.name}(${recipient.mobile}) 처리 실패:`, error);
      // 개별 수신자 처리 실패는 전체 프로세스를 중단하지 않음
    }
  }
}

// 싱글톤 인스턴스
export const customerService = new CustomerService();

/**
 * 표시용 고객사 목록 조회 (UI에서 사용)
 * @param filter 필터 조건
 * @returns 포맷된 고객사 목록
 */
export const getCustomersForDisplay = async (filter: CustomerFilter = {}): Promise<CustomerDisplay[]> => {
  const customers = await customerService.getCustomers(filter);
  return customers.map(customer => customerService['convertCustomerToDisplay'](customer));
};

/**
 * 표시용 고객사 상세 조회 (UI에서 사용)
 * @param businessNumber 사업자등록번호 (포맷된 또는 정규화된)
 * @returns 포맷된 고객사 정보
 */
export const getCustomerForDisplay = async (businessNumber: string): Promise<CustomerDisplay | null> => {
  const customer = await customerService.getCustomer(businessNumber);
  return customer ? customerService['convertCustomerToDisplay'](customer) : null;
};

// 편의 함수 export (기존 코드 호환성)
export const getCustomer = customerService.getCustomer.bind(customerService);
export const updateCustomer = customerService.updateCustomer.bind(customerService);

export default customerService;