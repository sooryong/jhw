/**
 * 파일 경로: /src/services/contactService.ts
 * 작성 날짜: 2025-10-14 (업데이트: 2025-10-15)
 * 주요 내용: 담당자 처리 공통 유틸리티
 * 관련 데이터: ContactInfo 구조 (고객사/공급사 공통)
 *
 * 변경 내역 (2025-10-15):
 * - 고객사도 사용자 자동 생성하지 않음
 * - 기존 사용자만 연결하도록 변경 (linkContactToCustomer)
 * - 공급사는 processSupplierContact 사용
 */

import { normalizeNumber } from '../utils/numberUtils';
import type { NormalizedMobile } from '../types/phoneNumber';
import type { ContactInfo } from '../types/company';
import { getUserById, addCustomerToUser, removeCustomerFromUser, addSupplierToUser, removeSupplierFromUser } from './userService';

/**
 * 기존 사용자를 고객사에 연결
 * @param userId 연결할 사용자 ID (users 컬렉션)
 * @param businessNumber 회사 사업자등록번호 (정규화된)
 * @returns ContactInfo 객체
 * @throws 사용자를 찾을 수 없는 경우 에러
 */
export async function linkContactToCustomer(
  userId: string,
  businessNumber: string
): Promise<ContactInfo> {
  // 사용자 존재 여부 확인
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  // 고객사를 사용자의 companies 배열에 추가
  await addCustomerToUser(userId, businessNumber);

  // ContactInfo 객체 생성 (email이 있을 때만 포함)
  const contactInfo: ContactInfo = {
    userId: user.uid,
    name: user.name,
    mobile: user.mobile
  };

  // email이 있으면 추가
  if (user.email) {
    contactInfo.email = user.email;
  }

  return contactInfo;
}

/**
 * 고객사에서 사용자 연결 해제
 * @param userId 해제할 사용자 ID
 * @param businessNumber 회사 사업자등록번호 (정규화된)
 */
export async function unlinkContactFromCustomer(
  userId: string,
  businessNumber: string
): Promise<void> {
  await removeCustomerFromUser(userId, businessNumber);
}

/**
 * 기존 사용자를 공급사에 연결
 * @param userId 연결할 사용자 ID (users 컬렉션)
 * @param businessNumber 회사 사업자등록번호 (정규화된)
 * @returns ContactInfo 객체
 * @throws 사용자를 찾을 수 없는 경우 에러
 */
export async function linkContactToSupplier(
  userId: string,
  businessNumber: string
): Promise<ContactInfo> {
  // 사용자 존재 여부 확인
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  // 공급사를 사용자의 linkedSuppliers 배열에 추가
  await addSupplierToUser(userId, businessNumber);

  // ContactInfo 객체 생성 (email이 있을 때만 포함)
  const contactInfo: ContactInfo = {
    userId: user.uid,
    name: user.name,
    mobile: user.mobile
  };

  // email이 있으면 추가
  if (user.email) {
    contactInfo.email = user.email;
  }

  return contactInfo;
}

/**
 * 공급사에서 사용자 연결 해제
 * @param userId 해제할 사용자 ID
 * @param businessNumber 회사 사업자등록번호 (정규화된)
 */
export async function unlinkContactFromSupplier(
  userId: string,
  businessNumber: string
): Promise<void> {
  await removeSupplierFromUser(userId, businessNumber);
}

/**
 * 공급사 담당자 처리 (Deprecated - linkContactToSupplier 사용 권장)
 * @deprecated 이제 공급사도 users 기반으로 관리합니다. linkContactToSupplier를 사용하세요.
 * @param contactData 담당자 입력 정보 { name, mobile }
 * @returns ContactInfo 객체 (userId 없음)
 */
export async function processSupplierContact(
  contactData: { name: string; mobile: string; email?: string }
): Promise<ContactInfo> {
  const normalizedMobile = normalizeNumber(contactData.mobile) as NormalizedMobile;

  const contactInfo: ContactInfo = {
    name: contactData.name,
    mobile: normalizedMobile
    // userId 없음
  };

  // email이 있으면 추가
  if (contactData.email) {
    contactInfo.email = contactData.email;
  }

  return contactInfo;
}

/**
 * 담당자 이름 조회 (userId 유무에 따라 처리)
 * @param contact ContactInfo 객체
 * @returns 담당자 이름
 */
export async function getContactName(contact: ContactInfo): Promise<string> {
  if (contact.userId) {
    // userId 있음 → users에서 최신 이름 조회
    const { getUserById } = await import('./userService');
    const user = await getUserById(contact.userId);
    return user?.name || contact.name;  // fallback
  }

  // userId 없음 → contact에 저장된 이름 사용
  return contact.name;
}

/**
 * SMS 발송 대상 휴대폰번호 조회
 * @param contact ContactInfo 객체
 * @returns 휴대폰번호
 */
export function getContactMobile(contact: ContactInfo): NormalizedMobile {
  // userId 유무와 관계없이 mobile 필드 사용
  return contact.mobile;
}
