/**
 * 파일 경로: /src/services/supplierService.ts
 * 작성 날짜: 2025-09-26
 * 주요 내용: 공급사 관리 서비스 - suppliers 컬렉션
 * 관련 데이터: Firebase suppliers 컬렉션 (문서 ID = 사업자등록번호)
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
  orderBy,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Supplier,
  SupplierFormData,
  SupplierFilter,
  CustomerSMSRecipients
} from '../types/company';
import {
  CompanyServiceError,
  businessNumberUtils
} from '../types/company';
import type {
  NormalizedBusinessNumber,
  NormalizedMobile,
  NormalizedPhone
} from '../types/phoneNumber';
import { normalizeNumber } from '../utils/numberUtils';

export class SupplierService {
  private collectionName = 'suppliers';

  // 공급사 생성
  async createSupplier(formData: SupplierFormData): Promise<string> {
    try {
      // 사업자등록번호 유효성 검사
      if (!businessNumberUtils.validate(formData.businessNumber)) {
        throw new CompanyServiceError('유효하지 않은 사업자등록번호입니다.', 'INVALID_BUSINESS_NUMBER');
      }

      const businessNumberId = businessNumberUtils.normalize(formData.businessNumber);

      // 중복 검사
      await this.checkDuplicateBusinessNumber(businessNumberId);

      const now = Timestamp.now();

      // SMS 수신자 정규화
      const normalizedSmsRecipient: CustomerSMSRecipients = {
        person1: {
          name: formData.smsRecipient.person1.name,
          mobile: normalizeNumber(formData.smsRecipient.person1.mobile) as NormalizedMobile
        },
        ...(formData.smsRecipient.person2 && {
          person2: {
            name: formData.smsRecipient.person2.name,
            mobile: normalizeNumber(formData.smsRecipient.person2.mobile) as NormalizedMobile
          }
        })
      };

      const supplierData: any = {
        businessNumber: businessNumberId as NormalizedBusinessNumber, // 문서 ID와 동일하게 정규화된 형식 사용
        businessName: formData.businessName,
        president: formData.president,
        businessAddress: formData.businessAddress,
        businessType: formData.businessType,
        businessItem: formData.businessItem,

        // 회사 연락처 (개별 필드) - 정규화
        businessEmail: formData.businessEmail || '',

        // SMS 수신자 (정규화된 값)
        smsRecipient: normalizedSmsRecipient,

        isActive: formData.isActive,

        createdAt: now,
        updatedAt: now,
      };

      // 선택 필드는 값이 있을 때만 추가
      if (formData.presidentMobile) {
        supplierData.presidentMobile = normalizeNumber(formData.presidentMobile) as NormalizedMobile;
      }
      if (formData.businessPhone) {
        supplierData.businessPhone = normalizeNumber(formData.businessPhone) as NormalizedPhone;
      }

      // 사업자등록번호를 문서 ID로 사용
      const supplierRef = doc(db, this.collectionName, businessNumberId);
      await setDoc(supplierRef, supplierData);

      return businessNumberId;
    } catch {
      throw new CompanyServiceError('공급사 생성 중 오류가 발생했습니다.', 'CREATE_FAILED');
    }
  }

  // 공급사 목록 조회
  async getSuppliers(filter: SupplierFilter = {}): Promise<Supplier[]> {
    try {
      const constraints: QueryConstraint[] = [];

      // 활성/비활성 필터
      if (filter.isActive !== undefined) {
        constraints.push(where('isActive', '==', filter.isActive));
      }

      // 기본 정렬 (최신 등록순)
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(collection(db, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);

      let suppliers = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        // 문서 ID가 정규화된 사업자등록번호이므로 그대로 사용
        businessNumber: doc.id as NormalizedBusinessNumber
      } as Supplier));

      // 클라이언트 검색 필터링
      if (filter.searchText) {
        const searchText = filter.searchText.toLowerCase().trim();
        suppliers = suppliers.filter(supplier =>
          supplier.businessName.toLowerCase().includes(searchText) ||
          supplier.businessNumber.includes(searchText) ||
          supplier.president.toLowerCase().includes(searchText) ||
          (supplier.presidentMobile && supplier.presidentMobile.includes(searchText)) ||
          (supplier.businessPhone && supplier.businessPhone.includes(searchText))
        );
      }

      return suppliers;
    } catch {
      throw new CompanyServiceError('공급사 목록을 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 공급사 개수 조회
  async getSupplierCount(filter: SupplierFilter = {}): Promise<number> {
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

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch {
      // 오류 처리: 공급사 개수 조회 실패
      throw new CompanyServiceError('공급사 개수를 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 단일 공급사 조회
  async getSupplierById(businessNumber: string): Promise<Supplier | null> {
    try {
      const businessNumberId = businessNumberUtils.normalize(businessNumber);
      const supplierRef = doc(db, this.collectionName, businessNumberId);
      const supplierDoc = await getDoc(supplierRef);

      if (supplierDoc.exists()) {
        return {
          ...supplierDoc.data(),
          // 문서 ID가 정규화된 사업자등록번호이므로 그대로 사용
          businessNumber: supplierDoc.id as NormalizedBusinessNumber
        } as Supplier;
      }
      return null;
    } catch {
      throw new CompanyServiceError('공급사 정보를 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 공급사 정보 수정
  async updateSupplier(businessNumber: string, updateData: Partial<SupplierFormData>): Promise<void> {
    try {
      const businessNumberId = businessNumberUtils.normalize(businessNumber);

      // 사업자번호는 문서 ID이므로 변경 불가 (updateData에서 제거)
      const { businessNumber: _removed, ...validUpdateData } = updateData;

      const supplierRef = doc(db, this.collectionName, businessNumberId);

      // undefined 값 제거 및 빈 문자열로 변환
      const updatePayload: Record<string, unknown> = {
        updatedAt: Timestamp.now()
      };

      // validUpdateData에서 undefined가 아닌 값만 추가 (전화번호 정규화)
      Object.entries(validUpdateData).forEach(([key, value]) => {
        if (value !== undefined) {
          // 전화번호 필드 정규화
          if (key === 'presidentMobile' && typeof value === 'string' && value !== '') {
            updatePayload[key] = normalizeNumber(value) as NormalizedMobile;
          } else if (key === 'businessPhone' && typeof value === 'string' && value !== '') {
            updatePayload[key] = normalizeNumber(value) as NormalizedPhone;
          } else if (key === 'smsRecipient' && typeof value === 'object' && value !== null) {
            // SMS 수신자 정규화
            const smsData = value as SupplierFormData['smsRecipient'];
            const normalizedSmsRecipient: CustomerSMSRecipients = {
              person1: {
                name: smsData.person1.name,
                mobile: normalizeNumber(smsData.person1.mobile) as NormalizedMobile
              },
              ...(smsData.person2 && {
                person2: {
                  name: smsData.person2.name,
                  mobile: normalizeNumber(smsData.person2.mobile) as NormalizedMobile
                }
              })
            };
            updatePayload[key] = normalizedSmsRecipient;
          } else {
            updatePayload[key] = value === '' ? '' : value; // 빈 문자열은 그대로 유지
          }
        }
      });

      await updateDoc(supplierRef, updatePayload as Record<string, any>);
    } catch {
      throw new CompanyServiceError('공급사 정보 수정 중 오류가 발생했습니다.', 'UPDATE_FAILED');
    }
  }

  // 공급사 상태 업데이트
  async updateSupplierStatus(businessNumber: string, isActive: boolean): Promise<void> {
    try {
      const businessNumberId = businessNumberUtils.normalize(businessNumber);
      const supplierRef = doc(db, this.collectionName, businessNumberId);

      await updateDoc(supplierRef, {
        isActive,
        updatedAt: Timestamp.now()
      });
    } catch {
      throw new CompanyServiceError('공급사 상태 업데이트 중 오류가 발생했습니다.', 'UPDATE_FAILED');
    }
  }

  // 공급사 삭제
  async deleteSupplier(businessNumber: string): Promise<void> {
    try {
      const businessNumberId = businessNumberUtils.normalize(businessNumber);
      const supplierRef = doc(db, this.collectionName, businessNumberId);
      await deleteDoc(supplierRef);
    } catch {
      throw new CompanyServiceError('공급사 삭제 중 오류가 발생했습니다.', 'DELETE_FAILED');
    }
  }

  // 사업자등록번호 중복 체크
  private async checkDuplicateBusinessNumber(businessNumberId: string): Promise<void> {
    const supplierRef = doc(db, this.collectionName, businessNumberId);
    const supplierDoc = await getDoc(supplierRef);

    if (supplierDoc.exists()) {
      throw new CompanyServiceError('이미 등록된 사업자등록번호입니다.', 'DUPLICATE_BUSINESS_NUMBER');
    }
  }

  // 활성 공급사만 조회
  async getActiveSuppliers(): Promise<Supplier[]> {
    return this.getSuppliers({ isActive: true });
  }
}

// 싱글톤 인스턴스
export const supplierService = new SupplierService();
export default supplierService;