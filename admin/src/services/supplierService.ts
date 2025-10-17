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
  QueryConstraint,
  deleteField
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Supplier,
  SupplierFormData,
  SupplierFilter
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
import { linkContactToSupplier, unlinkContactFromSupplier } from './contactService';

export class SupplierService {
  private collectionName = 'suppliers';

  // processOrderContacts 메서드 제거 → contactService.processContact 사용 (createUser=false)

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

      // userId 필수 검증
      if (!formData.primaryContact.userId) {
        throw new CompanyServiceError(
          '담당자1을 선택해주세요. 시스템 설정 > 사용자 관리에서 먼저 사용자를 추가해주세요.',
          'MISSING_USER_ID'
        );
      }

      // 주문 담당자 처리 (기존 사용자만 연결) - linkContactToSupplier 사용
      const primaryContact = await linkContactToSupplier(
        formData.primaryContact.userId,
        businessNumberId
      );

      const secondaryContact = formData.secondaryContact?.userId
        ? await linkContactToSupplier(
            formData.secondaryContact.userId,
            businessNumberId
          )
        : undefined;

      const now = Timestamp.now();

      const supplierData: Record<string, unknown> = {
        businessNumber: businessNumberId as NormalizedBusinessNumber,
        businessName: formData.businessName,
        president: formData.president,
        businessAddress: formData.businessAddress,
        businessType: formData.businessType,
        businessItem: formData.businessItem,
        businessEmail: formData.businessEmail || '',
        primaryContact,      // ContactInfo 객체 (userId 포함)
        isActive: formData.isActive,
        createdAt: now,
        updatedAt: now,
      };

      // 선택 필드는 값이 있을 때만 추가
      if (secondaryContact) {
        supplierData.secondaryContact = secondaryContact;
      }
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
    } catch (error) {
      // Error handled silently
      console.error('공급사 생성 오류:', error);
      if (error instanceof CompanyServiceError) {
        throw error;
      }
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
    } catch (error) {
      // Error handled silently
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
    } catch (error) {
      // Error handled silently
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
    } catch (error) {
      // Error handled silently
      throw new CompanyServiceError('공급사 정보를 불러올 수 없습니다.', 'FETCH_FAILED');
    }
  }

  // 공급사 정보 수정
  async updateSupplier(businessNumber: string, updateData: Partial<SupplierFormData>): Promise<void> {
    try {
      // Normalize business number
      const businessNumberId = businessNumberUtils.normalize(businessNumber);

      // 사업자번호는 문서 ID이므로 변경 불가 (updateData에서 제거)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { businessNumber: _removed, ...validUpdateData } = updateData;

      const supplierRef = doc(db, this.collectionName, businessNumberId);

      // 기존 문서 존재 확인
      const docSnap = await getDoc(supplierRef);
      if (!docSnap.exists()) {
        throw new CompanyServiceError('존재하지 않는 공급사입니다.', 'NOT_FOUND');
      }

      // undefined 값 제거 및 빈 문자열로 변환
      const updatePayload: Record<string, unknown> = {
        updatedAt: Timestamp.now()
      };

      // 주문 담당자 처리 (기존 사용자만 연결)
      if (validUpdateData.primaryContact) {
        // userId 필수 검증
        if (!validUpdateData.primaryContact.userId) {
          throw new CompanyServiceError(
            '담당자1을 선택해주세요. 시스템 설정 > 사용자 관리에서 먼저 사용자를 추가해주세요.',
            'MISSING_USER_ID'
          );
        }

        // 1. 기존 담당자 정보 조회
        const oldSupplierData = docSnap.data() as Supplier;
        const oldPrimaryUserId = oldSupplierData.primaryContact?.userId;
        const oldSecondaryUserId = oldSupplierData.secondaryContact?.userId;

        // 2. 기존 담당자와 다르면 이전 담당자에서 공급사 연결 해제
        if (oldPrimaryUserId && oldPrimaryUserId !== validUpdateData.primaryContact.userId) {
          await unlinkContactFromSupplier(oldPrimaryUserId, businessNumberId);
        }
        if (oldSecondaryUserId && oldSecondaryUserId !== validUpdateData.secondaryContact?.userId) {
          await unlinkContactFromSupplier(oldSecondaryUserId, businessNumberId);
        }

        // 3. 새 담당자 연결 (기존 사용자만)
        const primaryContact = await linkContactToSupplier(
          validUpdateData.primaryContact.userId,
          businessNumberId
        );

        const secondaryContact = validUpdateData.secondaryContact?.userId
          ? await linkContactToSupplier(
              validUpdateData.secondaryContact.userId,
              businessNumberId
            )
          : undefined;

        // 4. 담당자 정보 업데이트
        updatePayload.primaryContact = primaryContact;
        if (secondaryContact) {
          updatePayload.secondaryContact = secondaryContact;
        } else {
          updatePayload.secondaryContact = deleteField() as unknown; // 부 담당자 제거
        }
      }

      // validUpdateData에서 undefined가 아닌 값만 추가 (전화번호 정규화)
      Object.entries(validUpdateData).forEach(([key, value]) => {
        if (value !== undefined && key !== 'primaryContact' && key !== 'secondaryContact') {
          // 전화번호 필드 정규화
          if (key === 'presidentMobile' && typeof value === 'string') {
            if (value !== '') {
              updatePayload[key] = normalizeNumber(value) as NormalizedMobile;
            } else {
              updatePayload[key] = deleteField() as unknown;
            }
          } else if (key === 'businessPhone' && typeof value === 'string') {
            if (value !== '') {
              updatePayload[key] = normalizeNumber(value) as NormalizedPhone;
            } else {
              updatePayload[key] = deleteField() as unknown;
            }
          } else {
            updatePayload[key] = value === '' ? '' : value; // 빈 문자열은 그대로 유지
          }
        }
      });

      await updateDoc(supplierRef, updatePayload as Record<string, unknown>);
    } catch (error) {
      // Error handled silently
      if (error instanceof CompanyServiceError) {
        throw error;
      }
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
    } catch (error) {
      // Error handled silently
      throw new CompanyServiceError('공급사 상태 업데이트 중 오류가 발생했습니다.', 'UPDATE_FAILED');
    }
  }

  // 공급사 삭제
  async deleteSupplier(businessNumber: string): Promise<void> {
    try {
      const businessNumberId = businessNumberUtils.normalize(businessNumber);
      const supplierRef = doc(db, this.collectionName, businessNumberId);
      await deleteDoc(supplierRef);
    } catch (error) {
      // Error handled silently
      throw new CompanyServiceError('공급사 삭제 중 오류가 발생했습니다.', 'DELETE_FAILED');
    }
  }

  // 사업자등록번호 중복 체크 (공급사 컬렉션 내에서만)
  private async checkDuplicateBusinessNumber(businessNumberId: string): Promise<void> {
    const supplierRef = doc(db, this.collectionName, businessNumberId);
    const supplierDoc = await getDoc(supplierRef);

    if (supplierDoc.exists()) {
      throw new CompanyServiceError('이미 공급사로 등록된 사업자등록번호입니다.', 'DUPLICATE_BUSINESS_NUMBER');
    }
  }

  /**
   * 사업자등록번호 유효성 및 중복 검사 (UI에서 실시간 검증용)
   * @param businessNumber 사업자등록번호
   * @returns { valid: boolean, message?: string }
   */
  async validateBusinessNumber(businessNumber: string): Promise<{ valid: boolean; message?: string }> {
    try {
      // 1. 형식 유효성 검사
      if (!businessNumberUtils.validate(businessNumber)) {
        return { valid: false, message: '유효하지 않은 사업자등록번호 형식입니다.' };
      }

      // 2. 중복 검사 (공급사 컬렉션 내에서만)
      const normalized = businessNumberUtils.normalize(businessNumber);
      await this.checkDuplicateBusinessNumber(normalized);

      return { valid: true };
    } catch (error) {
      // Error handled silently
      if (error instanceof CompanyServiceError) {
        return { valid: false, message: error.message };
      }
      return { valid: false, message: '사업자등록번호 검증 중 오류가 발생했습니다.' };
    }
  }

  // 활성 공급사만 조회
  async getActiveSuppliers(): Promise<Supplier[]> {
    return this.getSuppliers({ isActive: true });
  }
}

// 싱글톤 인스턴스
export const supplierService = new SupplierService();

// 편의 함수 export (기존 코드 호환성)
export const getSuppliers = supplierService.getSuppliers.bind(supplierService);
export const getSupplierById = supplierService.getSupplierById.bind(supplierService);
export const createSupplier = supplierService.createSupplier.bind(supplierService);
export const updateSupplier = supplierService.updateSupplier.bind(supplierService);
export const deleteSupplier = supplierService.deleteSupplier.bind(supplierService);
export const getActiveSuppliers = supplierService.getActiveSuppliers.bind(supplierService);

export default supplierService;