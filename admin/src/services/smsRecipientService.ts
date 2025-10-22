/**
 * 파일 경로: /src/services/smsRecipientService.ts
 * 주요 내용: SMS 수신자 관리 서비스 - Firebase 기반 수신자 데이터 관리
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  limit,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface SMSRecipient {
  id?: string;
  phone: string;
  name: string;
  customerType?: string;
  companyId?: string;
  companyName?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface AddRecipientRequest {
  phone: string;
  name: string;
  customerType?: string;
  companyId?: string;
  companyName?: string;
  notes?: string;
}

export interface UpdateRecipientRequest {
  id: string;
  phone?: string;
  name?: string;
  customerType?: string;
  companyId?: string;
  companyName?: string;
  notes?: string;
  isActive?: boolean;
}

const COLLECTION_NAME = 'smsRecipients';
const MAX_RECIPIENTS = 100;

/**
 * 새 수신자 추가
 */
export const addRecipient = async (recipientData: AddRecipientRequest): Promise<string> => {
  // 전화번호 중복 체크
  const existingRecipient = await getRecipientByPhone(recipientData.phone);
  if (existingRecipient) {
    throw new Error('이미 등록된 전화번호입니다.');
  }

  // 최대 수신자 수 체크
  const currentCount = await getRecipientsCount();
  if (currentCount >= MAX_RECIPIENTS) {
    throw new Error(`최대 ${MAX_RECIPIENTS}명까지만 등록할 수 있습니다.`);
  }

  const cleanPhone = recipientData.phone.replace(/-/g, '');

  const newRecipient: Omit<SMSRecipient, 'id'> = {
    phone: cleanPhone,
    name: recipientData.name,
    customerType: recipientData.customerType || '일반',
    companyId: recipientData.companyId,
    companyName: recipientData.companyName,
    notes: recipientData.notes,
    isActive: true,
    createdAt: serverTimestamp() as unknown,
    updatedAt: serverTimestamp() as unknown
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), newRecipient);
  return docRef.id;
};

/**
 * 수신자 정보 수정
 */
export const updateRecipient = async (updateData: UpdateRecipientRequest): Promise<void> => {
  const recipientRef = doc(db, COLLECTION_NAME, updateData.id);

  const updatePayload: Partial<SMSRecipient> = {
    updatedAt: serverTimestamp() as unknown
  };

  if (updateData.phone) {
    // 전화번호 변경 시 중복 체크
    const existingRecipient = await getRecipientByPhone(updateData.phone);
    if (existingRecipient && existingRecipient.id !== updateData.id) {
      throw new Error('이미 등록된 전화번호입니다.');
    }
      updatePayload.phone = updateData.phone.replace(/-/g, '');
    }

    if (updateData.name !== undefined) updatePayload.name = updateData.name;
    if (updateData.customerType !== undefined) updatePayload.customerType = updateData.customerType;
    if (updateData.companyId !== undefined) updatePayload.companyId = updateData.companyId;
    if (updateData.companyName !== undefined) updatePayload.companyName = updateData.companyName;
    if (updateData.notes !== undefined) updatePayload.notes = updateData.notes;
    if (updateData.isActive !== undefined) updatePayload.isActive = updateData.isActive;

  await updateDoc(recipientRef, updatePayload);
};

/**
 * 수신자 삭제
 */
export const deleteRecipient = async (recipientId: string): Promise<void> => {
  const recipientRef = doc(db, COLLECTION_NAME, recipientId);
  await deleteDoc(recipientRef);
};

/**
 * 전체 수신자 목록 조회
 */
export const getAllRecipients = async (): Promise<SMSRecipient[]> => {
  try {
    // 임시로 orderBy 없이 조회 (인덱스 생성 전까지)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true),
      limit(MAX_RECIPIENTS)
    );

    const snapshot = await getDocs(q);
    const recipients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as SMSRecipient[];

    // 클라이언트에서 정렬
    return recipients.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } catch {
      // Error handled silently
    // 오류 처리: 수신자 목록 조회 실패
    throw new Error('수신자 목록을 불러올 수 없습니다.');
  }
};

/**
 * 전화번호로 수신자 조회
 */
export const getRecipientByPhone = async (phone: string): Promise<SMSRecipient | null> => {
  try {
    const cleanPhone = phone.replace(/-/g, '');
    const q = query(
      collection(db, COLLECTION_NAME),
      where('phone', '==', cleanPhone),
      where('isActive', '==', true),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as SMSRecipient;
  } catch {
      // Error handled silently
    // 오류 처리: 수신자 조회 실패
    return null;
  }
};

/**
 * 회사별 수신자 조회
 */
export const getRecipientsByCompany = async (companyId: string): Promise<SMSRecipient[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const recipients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as SMSRecipient[];

    // 클라이언트에서 정렬
    return recipients.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } catch {
      // Error handled silently
    // 오류 처리: 회사별 수신자 조회 실패
    throw new Error('회사별 수신자 목록을 불러올 수 없습니다.');
  }
};

/**
 * 고객 유형별 수신자 조회
 */
export const getRecipientsByType = async (customerType: string): Promise<SMSRecipient[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('customerType', '==', customerType),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const recipients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as SMSRecipient[];

    // 클라이언트에서 정렬
    return recipients.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } catch {
      // Error handled silently
    // 오류 처리: 고객 유형별 수신자 조회 실패
    throw new Error('고객 유형별 수신자 목록을 불러올 수 없습니다.');
  }
};

/**
 * 수신자 수 조회
 */
export const getRecipientsCount = async (): Promise<number> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch {
      // Error handled silently
    // 오류 처리: 수신자 수 조회 실패
    return 0;
  }
};

/**
 * 수신자 검색
 */
export const searchRecipients = async (searchTerm: string): Promise<SMSRecipient[]> => {
  try {
    // Firebase에서는 부분 문자열 검색이 제한적이므로,
    // 모든 활성 수신자를 가져와서 클라이언트에서 필터링
    const allRecipients = await getAllRecipients();

    const lowerSearchTerm = searchTerm.toLowerCase();
    return allRecipients.filter(recipient =>
      recipient.name.toLowerCase().includes(lowerSearchTerm) ||
      recipient.phone.includes(searchTerm.replace(/-/g, '')) ||
      recipient.companyName?.toLowerCase().includes(lowerSearchTerm) ||
      recipient.customerType?.toLowerCase().includes(lowerSearchTerm)
    );
  } catch {
      // Error handled silently
    // 오류 처리: 수신자 검색 실패
    throw new Error('수신자 검색에 실패했습니다.');
  }
};

/**
 * 전화번호 유효성 검사
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^01[0-9]{8,9}$/;
  const cleanPhone = phone.replace(/-/g, '');
  return phoneRegex.test(cleanPhone);
};

/**
 * 전화번호 포맷팅
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleanPhone = phone.replace(/-/g, '');
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return cleanPhone;
};

export default {
  addRecipient,
  updateRecipient,
  deleteRecipient,
  getAllRecipients,
  getRecipientByPhone,
  getRecipientsByCompany,
  getRecipientsByType,
  getRecipientsCount,
  searchRecipients,
  validatePhoneNumber,
  formatPhoneNumber,
  MAX_RECIPIENTS
};