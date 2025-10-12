/**
 * 파일 경로: /src/services/recipientService.ts
 * 주요 내용: SMS 수신자 목록 관리 서비스 - Firestore 기반
 * 관련 데이터: smsRecipients 컬렉션
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  normalizeNumber,
  formatMobile,
  isValidMobile
} from '../utils/numberUtils';
import type {
  NormalizedMobile,
  FormattedMobile
} from '../types/phoneNumber';

// 수신자 인터페이스 (저장용 - 정규화된 번호)
interface SMSRecipientData {
  name: string;
  phone: NormalizedMobile; // 정규화된 휴대폰번호로 저장
  group?: string;
  memo?: string;
  lastUsed?: Date | ReturnType<typeof serverTimestamp>;
  usageCount?: number;
  createdAt: Date | ReturnType<typeof serverTimestamp>;
  updatedAt: Date | ReturnType<typeof serverTimestamp>;
}

// 수신자 인터페이스 (표시용 - 포맷된 번호)
export interface SMSRecipient {
  id: string;
  name: string;
  phone: FormattedMobile; // 표시용 포맷된 번호
  group?: string;
  memo?: string;
  lastUsed?: Date;
  usageCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// 수신자 입력 인터페이스 (입력용 - 문자열)
export interface SMSRecipientInput {
  name: string;
  phone: string; // 입력 시에는 문자열
  group?: string;
  memo?: string;
}

/**
 * 수신자 목록 조회
 */
export const getRecipients = async (): Promise<SMSRecipient[]> => {
  try {
    const q = query(collection(db, 'smsCenterRecipients'));

    const snapshot = await getDocs(q);
    const recipients = snapshot.docs.map(doc => {
      const data = doc.data() as SMSRecipientData;
      return {
        id: doc.id,
        name: data.name,
        phone: formatMobile(data.phone), // 표시용 포맷팅
        group: data.group,
        memo: data.memo,
        lastUsed: data.lastUsed instanceof Timestamp ? data.lastUsed.toDate() : undefined,
        usageCount: data.usageCount || 0,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined
      } as SMSRecipient;
    });

    // 클라이언트에서 정렬: lastUsed 우선, 그 다음 createdAt
    recipients.sort((a, b) => {
      // lastUsed가 있는 항목을 우선
      if (a.lastUsed && !b.lastUsed) return -1;
      if (!a.lastUsed && b.lastUsed) return 1;

      // 둘 다 lastUsed가 있으면 최신 순
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed.getTime() - a.lastUsed.getTime();
      }

      // 둘 다 lastUsed가 없으면 생성일 최신 순
      const aCreated = a.createdAt ? a.createdAt.getTime() : 0;
      const bCreated = b.createdAt ? b.createdAt.getTime() : 0;
      return bCreated - aCreated;
    });

    return recipients;
  } catch (error) {
    console.error('수신자 목록 조회 실패:', error);
    return [];
  }
};

/**
 * 수신자 추가
 */
export const addRecipient = async (recipientInput: SMSRecipientInput): Promise<SMSRecipient> => {
  try {
    // 번호 정규화 및 검증
    const normalizedPhone = normalizeNumber(recipientInput.phone) as NormalizedMobile;
    if (!isValidMobile(normalizedPhone)) {
      throw new Error(`올바르지 않은 휴대폰번호입니다: ${recipientInput.phone}`);
    }

    // 중복 체크
    const existingQuery = query(
      collection(db, 'smsCenterRecipients'),
      where('phone', '==', normalizedPhone)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error(`이미 등록된 번호입니다: ${recipientInput.phone}`);
    }

    const recipientData: SMSRecipientData = {
      name: recipientInput.name.trim(),
      phone: normalizedPhone,
      group: recipientInput.group?.trim() || '',
      memo: recipientInput.memo?.trim() || '',
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'smsCenterRecipients'), recipientData);

    return {
      id: docRef.id,
      name: recipientData.name,
      phone: formatMobile(normalizedPhone),
      group: recipientData.group,
      memo: recipientData.memo,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '수신자 추가 실패');
  }
};

/**
 * 수신자 사용 기록 업데이트
 */
export const updateRecipientUsage = async (recipientId: string): Promise<void> => {
  try {
    const recipientRef = doc(db, 'smsCenterRecipients', recipientId);
    await updateDoc(recipientRef, {
      lastUsed: serverTimestamp(),
      usageCount: (await getDocs(query(collection(db, 'smsCenterRecipients'), where('__name__', '==', recipientId)))).docs[0]?.data()?.usageCount + 1 || 1,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('수신자 사용 기록 업데이트 실패:', error);
  }
};

/**
 * 수신자 삭제
 */
export const deleteRecipient = async (recipientId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'smsCenterRecipients', recipientId));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '수신자 삭제 실패');
  }
};

/**
 * 수신자 정보 수정
 */
export const updateRecipient = async (recipientId: string, updates: Partial<SMSRecipientInput>): Promise<void> => {
  try {
    const updateData: Partial<SMSRecipientData> = {
      updatedAt: serverTimestamp()
    };

    if (updates.name) updateData.name = updates.name.trim();
    if (updates.group !== undefined) updateData.group = updates.group.trim();
    if (updates.memo !== undefined) updateData.memo = updates.memo.trim();

    if (updates.phone) {
      const normalizedPhone = normalizeNumber(updates.phone) as NormalizedMobile;
      if (!isValidMobile(normalizedPhone)) {
        throw new Error(`올바르지 않은 휴대폰번호입니다: ${updates.phone}`);
      }
      updateData.phone = normalizedPhone;
    }

    await updateDoc(doc(db, 'smsCenterRecipients', recipientId), updateData);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '수신자 정보 수정 실패');
  }
};

/**
 * 그룹별 수신자 조회
 */
export const getRecipientsByGroup = async (group: string): Promise<SMSRecipient[]> => {
  try {
    const q = query(
      collection(db, 'smsCenterRecipients'),
      where('group', '==', group)
    );

    const snapshot = await getDocs(q);
    const recipients = snapshot.docs.map(doc => {
      const data = doc.data() as SMSRecipientData;
      return {
        id: doc.id,
        name: data.name,
        phone: formatMobile(data.phone),
        group: data.group,
        memo: data.memo,
        lastUsed: data.lastUsed instanceof Timestamp ? data.lastUsed.toDate() : undefined,
        usageCount: data.usageCount || 0,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined
      } as SMSRecipient;
    });

    // 클라이언트에서 이름순 정렬
    recipients.sort((a, b) => a.name.localeCompare(b.name));

    return recipients;
  } catch (error) {
    console.error('그룹별 수신자 조회 실패:', error);
    return [];
  }
};


// 기본 export
export default {
  getRecipients,
  addRecipient,
  updateRecipientUsage,
  deleteRecipient,
  updateRecipient,
  getRecipientsByGroup
};