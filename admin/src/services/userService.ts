/**
 * 파일 경로: /src/services/userService.ts
 * 업데이트: 2025-09-29
 * 주요 내용: Firebase users 컬렉션 관련 서비스 함수 (번호 정규화 규칙 적용)
 */

import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../config/firebase';
import type { JWSUser, JWSUserDisplay } from '../types/user';
import {
  normalizeNumber,
  formatMobile,
  formatBusinessNumber,
  isValidMobile
} from '../utils/numberUtils';
import type {
  NormalizedMobile,
  NormalizedBusinessNumber,
  FormattedMobile,
  FormattedBusinessNumber
} from '../types/phoneNumber';


// Firestore에서 가져온 사용자 문서 타입 (저장된 형태 - 정규화된 번호)
interface FirestoreUser {
  authUid?: string; // Firebase Auth UID (문서 ID와 별도)
  mobile?: string; // 정규화된 휴대폰번호 (11자리 숫자, 문서 ID와 동일)
  name?: string;
  role?: 'admin' | 'staff' | 'customer';
  linkedCustomers?: string[]; // 연결된 고객사 사업자번호 배열 (정규화)
  isActive?: boolean;
  createdAt?: Timestamp; // Firestore timestamp
  lastLogin?: Timestamp;
  requiresPasswordChange?: boolean;
  passwordChangedAt?: Timestamp;
}

/**
 * Firestore 사용자 데이터를 JWSUser 타입으로 변환
 * @param uid 사용자 ID
 * @param userData Firestore 사용자 데이터
 * @returns JWSUser 객체
 */
const convertFirestoreToJWSUser = (uid: string, userData: FirestoreUser): JWSUser => {
  return {
    uid,
    name: userData.name || '사용자',
    mobile: userData.mobile as NormalizedMobile || '' as NormalizedMobile,
    role: userData.role || 'staff',
    linkedCustomers: userData.linkedCustomers as NormalizedBusinessNumber[] || [],
    isActive: userData.isActive ?? true,
    createdAt: userData.createdAt?.toDate() || new Date(),
    lastLogin: userData.lastLogin?.toDate() || null,
    requiresPasswordChange: userData.requiresPasswordChange ?? false,
    passwordChangedAt: userData.passwordChangedAt?.toDate()
  };
};

/**
 * JWSUser를 표시용 타입으로 변환
 * @param user JWSUser 객체
 * @returns JWSUserDisplay 객체
 */
export const convertUserToDisplay = (user: JWSUser): JWSUserDisplay => {
  return {
    ...user,
    mobile: formatMobile(user.mobile) as FormattedMobile,
    linkedCustomers: user.linkedCustomers?.map(
      num => formatBusinessNumber(num) as FormattedBusinessNumber
    ),
    smsRecipientInfo: user.smsRecipientInfo ? {
      mobile: formatMobile(user.smsRecipientInfo.mobile) as FormattedMobile,
      name: user.smsRecipientInfo.name,
      linkedCustomerNumbers: user.smsRecipientInfo.linkedCustomerNumbers.map(
        num => formatBusinessNumber(num) as FormattedBusinessNumber
      ),
      recipientRole: user.smsRecipientInfo.recipientRole
    } : undefined
  };
};

/**
 * 휴대폰번호로 사용자 찾기
 * @param mobile 휴대폰번호 (하이픈 포함/미포함 모두 지원)
 * @returns 사용자 객체 또는 null
 */
export const findUserByMobile = async (mobile: string): Promise<JWSUser | null> => {
  try {
    // 휴대폰번호 정규화 (숫자만 추출)
    const normalizedMobile = normalizeNumber(mobile) as NormalizedMobile;

    // 휴대폰번호 유효성 검증
    if (!isValidMobile(normalizedMobile)) {
      throw new Error('올바른 휴대폰번호 형식이 아닙니다.');
    }

    // 휴대폰번호를 문서 ID로 직접 조회 (쿼리 불필요)
    const userDoc = await getDoc(doc(db, 'users', normalizedMobile));

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as FirestoreUser;
    return convertFirestoreToJWSUser(userDoc.id, userData);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('사용자 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 ID로 사용자 정보 가져오기
 * @param uid 사용자 ID (휴대폰번호 - 문서 ID)
 * @returns 사용자 객체 또는 null
 */
export const getUserById = async (uid: string): Promise<JWSUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as FirestoreUser;
    return convertFirestoreToJWSUser(userDoc.id, userData);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('사용자 정보 조회 중 오류가 발생했습니다.');
  }
};

/**
 * Firebase Auth UID로 사용자 정보 가져오기
 * @param authUid Firebase Auth UID
 * @returns 사용자 객체 또는 null
 */
export const getUserByAuthUid = async (authUid: string): Promise<JWSUser | null> => {
  try {
    // authUid 필드로 쿼리
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('authUid', '==', authUid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // 첫 번째 일치하는 사용자 반환
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as FirestoreUser;

    return convertFirestoreToJWSUser(userDoc.id, userData);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('사용자 정보 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 전체 사용자 목록 조회
 * @returns 사용자 목록
 */
export const getUsers = async (): Promise<JWSUser[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const users: JWSUser[] = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data() as FirestoreUser;
      users.push(convertFirestoreToJWSUser(doc.id, userData));
    });

    return users;
  } catch {
    throw new Error('사용자 목록 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 새 사용자 생성
 * @param userData 사용자 데이터
 * @returns 생성된 사용자 ID
 */
export const createUser = async (userData: Partial<JWSUser>): Promise<{ uid: string; defaultPassword: string }> => {
  try {
    // Get current user's ID token for authentication
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required');
    }

    const idToken = await user.getIdToken();

    // Make direct HTTP request to the Cloud Function
    const response = await fetch('https://us-central1-jws-platform.cloudfunctions.net/createUserAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || '사용자 생성에 실패했습니다.');
    }

    return { uid: data.uid || '', defaultPassword: data.defaultPassword || '' };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '사용자 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 정보 수정
 * @param uid 사용자 ID
 * @param updateData 수정할 데이터
 */
export const updateUser = async (uid: string, updateData: Partial<JWSUser>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);

    // Firestore에 저장할 수 있는 필드만 추출
    const firestoreData: Record<string, unknown> = {};

    // Date 타입이 아닌 필드들만 복사
    const allowedFields = ['name', 'mobile', 'role', 'email', 'isActive',
                          'linkedCustomers', 'requiresPasswordChange', 'smsRecipientInfo'];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        firestoreData[key] = value;
      }
    }

    // updatedAt은 serverTimestamp로 설정
    firestoreData.updatedAt = serverTimestamp();

    await updateDoc(userRef, firestoreData as Record<string, any>);
  } catch (error) {
    console.error('updateUser error:', error);
    throw new Error('사용자 정보 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 비밀번호 초기화
 * @param uid 사용자 ID
 */
export const resetUserPassword = async (uid: string): Promise<void> => {
  try {
    const resetPasswordFunction = httpsCallable(functions, 'resetUserPassword');
    const result = await resetPasswordFunction({ uid });
    const data = result.data as { success: boolean; message?: string; error?: string };

    if (!data.success) {
      throw new Error(data.error || '비밀번호 초기화에 실패했습니다.');
    }
  } catch {
    throw new Error('비밀번호 초기화 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 계정 완전 삭제 (Firebase Auth + Firestore)
 * @param uid 사용자 ID
 */
export const deleteUserAccount = async (uid: string): Promise<void> => {
  try {
    const deleteUserFunction = httpsCallable(functions, 'deleteUserAccount');
    const result = await deleteUserFunction({ uid });
    const data = result.data as { success: boolean; message?: string; error?: string };

    if (!data.success) {
      throw new Error(data.error || '사용자 삭제에 실패했습니다.');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
  }
};


/**
 * 사용자에게 고객사 추가 (색인 관리)
 * @param uid 사용자 ID
 * @param businessNumber 추가할 고객사 사업자등록번호 (하이픈 제거된 형태)
 */
export const addCustomerToUser = async (uid: string, businessNumber: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as JWSUser;
    const currentBusinessNumbers = userData.linkedCustomers || [];

    // 정규화된 사업자번호
    const normalizedBusinessNumber = normalizeNumber(businessNumber) as NormalizedBusinessNumber;

    // 중복 확인
    if (currentBusinessNumbers.includes(normalizedBusinessNumber)) {
      return;
    }

    // 고객사 추가
    const updatedBusinessNumbers = [...currentBusinessNumbers, normalizedBusinessNumber];

    await updateDoc(userRef, {
      linkedCustomers: updatedBusinessNumbers,
      updatedAt: serverTimestamp()
    });
  } catch {
    throw new Error('고객사를 사용자에 연결하는 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사 SMS 수신자용 사용자 생성
 * @param recipient SMS 수신자 정보
 * @param businessNumbers 연결할 고객사 사업자등록번호 목록
 * @returns 생성된 사용자 정보
 */
export const createCustomerUser = async (
  recipient: { name: string; mobile: string },
  businessNumbers: string[]
): Promise<{ uid: string; defaultPassword: string }> => {
  try {
    const userData: Partial<JWSUser> = {
      name: recipient.name,
      mobile: normalizeNumber(recipient.mobile) as NormalizedMobile,
      role: 'customer',
      linkedCustomers: businessNumbers.map(bn => normalizeNumber(bn) as NormalizedBusinessNumber),
      isActive: true, // SMS 수신자는 즉시 활성화
      requiresPasswordChange: true // 첫 로그인 시 비밀번호 변경 필수
    };

    const result = await createUser(userData);
    return result;
  } catch {
    throw new Error('SMS 수신자 사용자 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 고객사에 연결된 사용자 목록 조회
 * @param businessNumber 고객사 사업자등록번호 (하이픈 제거된 형태)
 * @returns 연결된 사용자 목록
 */
export const getUsersByCustomer = async (businessNumber: string): Promise<JWSUser[]> => {
  try {
    const usersCollection = collection(db, 'users');

    // linkedCustomers 배열에 해당 사업자번호가 포함된 사용자 조회
    const q = query(
      usersCollection,
      where('linkedCustomers', 'array-contains', businessNumber),
      where('role', '==', 'customer')
    );

    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastLogin: doc.data().lastLogin?.toDate() || null
    })) as JWSUser[];

    return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    throw new Error('고객사에 연결된 사용자 목록을 조회할 수 없습니다.');
  }
};