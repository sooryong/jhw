/**
 * 파일 경로: /src/services/userService.ts
 * 업데이트: 2025-09-29
 * 주요 내용: Firebase users 컬렉션 관련 서비스 함수 (번호 정규화 규칙 적용)
 */

import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../config/firebase';
import type { JWSUser, JWSUserDisplay } from '../types/user';
import {
  normalizeNumber,
  normalizeBusinessNumber,
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
import { customerService } from './customerService';
import { supplierService } from './supplierService';


// Firestore에서 가져온 사용자 문서 타입 (저장된 형태 - 정규화된 번호)
interface FirestoreUser {
  authUid?: string; // Firebase Auth UID (문서 ID와 별도)
  mobile?: string; // 정규화된 휴대폰번호 (11자리 숫자, 문서 ID와 동일)
  name?: string;
  roles?: ('admin' | 'staff' | 'customer' | 'supplier')[]; // 다중 역할 지원
  // 하위 호환성을 위한 role 필드 (deprecated)
  role?: 'admin' | 'staff' | 'customer' | 'supplier';
  linkedCustomers?: string[]; // 연결된 고객사 사업자번호 배열 (정규화)
  linkedSuppliers?: string[]; // 연결된 공급사 사업자번호 배열 (정규화)
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
  // 하위 호환성: role 필드가 있으면 roles로 변환
  const roles = userData.roles || (userData.role ? [userData.role] : ['staff']);

  return {
    uid,
    name: userData.name || '사용자',
    mobile: userData.mobile as NormalizedMobile || '' as NormalizedMobile,
    roles,
    linkedCustomers: userData.linkedCustomers as NormalizedBusinessNumber[] || [],
    linkedSuppliers: userData.linkedSuppliers as NormalizedBusinessNumber[] || [],
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
    linkedSuppliers: user.linkedSuppliers?.map(
      num => formatBusinessNumber(num) as FormattedBusinessNumber
    ),
    smsRecipientInfo: user.smsRecipientInfo ? {
      mobile: formatMobile(user.smsRecipientInfo.mobile) as FormattedMobile,
      name: user.smsRecipientInfo.name,
      linkedCustomerNumbers: user.smsRecipientInfo.linkedCustomerNumbers.map(
        num => formatBusinessNumber(num) as FormattedBusinessNumber
      ),
      recipientRole: user.smsRecipientInfo.recipientRole,
      customerRole: user.smsRecipientInfo.customerRole,
      notificationPreferences: user.smsRecipientInfo.notificationPreferences
    } : undefined
  };
};

/**
 * 휴대폰번호로 사용자 찾기 (모든 역할 검색)
 * @param mobile 휴대폰번호 (하이픈 포함/미포함 모두 지원)
 * @returns 사용자 객체 또는 null (여러 명 있으면 첫 번째 반환)
 */
export const findUserByMobile = async (mobile: string): Promise<JWSUser | null> => {
  try {
    // 휴대폰번호 정규화 (숫자만 추출)
    const normalizedMobile = normalizeNumber(mobile) as NormalizedMobile;

    // 휴대폰번호 유효성 검증
    if (!isValidMobile(normalizedMobile)) {
      throw new Error('올바른 휴대폰번호 형식이 아닙니다.');
    }

    // 휴대폰번호로 모든 사용자 조회 (여러 역할 가능)
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('mobile', '==', normalizedMobile));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // 첫 번째 일치하는 사용자 반환
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as FirestoreUser;
    return convertFirestoreToJWSUser(userDoc.id, userData);
  } catch (error) {
      // Error handled silently
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('사용자 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 휴대폰번호와 역할로 사용자 찾기
 * @param mobile 휴대폰번호 (하이픈 포함/미포함 모두 지원)
 * @param role 사용자 역할
 * @returns 사용자 객체 또는 null
 */
export const findUserByMobileAndRole = async (mobile: string, role: string): Promise<JWSUser | null> => {
  try {
    // 휴대폰번호 정규화 (숫자만 추출)
    const normalizedMobile = normalizeNumber(mobile) as NormalizedMobile;

    // 휴대폰번호 유효성 검증
    if (!isValidMobile(normalizedMobile)) {
      throw new Error('올바른 휴대폰번호 형식이 아닙니다.');
    }

    // 휴대폰번호 + 역할로 사용자 조회 (roles 배열에 해당 역할이 포함된 사용자)
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('mobile', '==', normalizedMobile),
      where('roles', 'array-contains', role)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // 첫 번째 일치하는 사용자 반환
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as FirestoreUser;
    return convertFirestoreToJWSUser(userDoc.id, userData);
  } catch (error) {
      // Error handled silently
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
      // Error handled silently
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
      // Error handled silently
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
      // Error handled silently
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
    const mobile = userData.mobile || '';
    const defaultPassword = mobile.slice(-4) + mobile.slice(-4); // 뒷자리 4자리 2번 반복

    // roles가 없으면 기본값
    const roles = userData.roles || ['staff'];

    // supplier 역할만 있는 경우 Firestore에만 저장 (Firebase Auth 사용 안 함)
    const hasOnlySupplierRole = roles.length === 1 && roles[0] === 'supplier';

    if (hasOnlySupplierRole) {
      // 문서 ID는 mobile만 사용 (복합키 제거)
      const docId = mobile;

      // Firestore에 직접 저장 (primaryRole은 저장하지 않음 - 자동 계산)
      const userDocData: Record<string, unknown> = {
        name: userData.name,
        mobile: mobile,
        roles: roles,
        isActive: userData.isActive ?? true,
        requiresPasswordChange: false, // supplier만 있으면 로그인 안 함
        createdAt: serverTimestamp(),
        lastLogin: null,
        passwordChangedAt: null,
        linkedSuppliers: userData.linkedSuppliers || [],
        linkedCustomers: userData.linkedCustomers || []
      };

      await setDoc(doc(db, 'users', docId), userDocData);

      return {
        uid: docId,
        defaultPassword: defaultPassword
      };
    }

    // customer, admin, staff 역할이 포함된 경우 Cloud Function 사용
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required');
    }

    const idToken = await user.getIdToken();

    // Cloud Function이 기대하는 필드 추출 (primaryRole은 제외 - 자동 계산)
    const requestData: {
      name: string;
      mobile: string;
      roles: ('admin' | 'staff' | 'customer' | 'supplier')[];
      linkedCustomers?: string[];
      linkedSuppliers?: string[];
      isActive?: boolean;
      requiresPasswordChange?: boolean;
    } = {
      name: userData.name || '',
      mobile: mobile,
      roles: roles,
      linkedCustomers: userData.linkedCustomers,
      linkedSuppliers: userData.linkedSuppliers,
      isActive: userData.isActive,
      requiresPasswordChange: userData.requiresPasswordChange
    };

    // Make direct HTTP request to the Cloud Function
    const response = await fetch('https://asia-northeast3-jinhyun-wholesale.cloudfunctions.net/createUserAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('createUser 실패:', {
        status: response.status,
        statusText: response.statusText,
        data,
        requestData
      });
      throw new Error(data.error || '사용자 생성에 실패했습니다.');
    }

    return { uid: data.uid || '', defaultPassword: data.defaultPassword || '' };
  } catch (error) {
      // Error handled silently
    console.error('createUser 에러:', error);
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

    // Date 타입이 아닌 필드들만 복사 (primaryRole은 제외 - 자동 계산)
    const allowedFields = ['name', 'mobile', 'roles', 'email', 'isActive',
                          'linkedCustomers', 'linkedSuppliers', 'requiresPasswordChange', 'smsRecipientInfo'];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        firestoreData[key] = value;
      }
    }

    // updatedAt은 serverTimestamp로 설정
    firestoreData.updatedAt = serverTimestamp();

    await updateDoc(userRef, firestoreData as Record<string, unknown>);
  } catch (error) {
      // Error handled silently
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
      // Error handled silently
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
      // Error handled silently
    throw new Error(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
  }
};


/**
 * 사용자에게 고객사 추가 (색인 관리)
 * @param uid 사용자 ID
 * @param businessNumber 추가할 고객사 사업자등록번호 (하이픈 포함/미포함 모두 지원)
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

    // 정규화된 사업자번호 (하이픈 포함 형태)
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;

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
  } catch (error) {
      // Error handled silently
    console.error('addCustomerToUser 에러:', error);
    if (error instanceof Error) {
      throw new Error(`고객사를 사용자에 연결하는 중 오류: ${error.message}`);
    }
    throw new Error('고객사를 사용자에 연결하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자에게서 고객사 제거
 * @param uid 사용자 ID
 * @param businessNumber 제거할 고객사 사업자등록번호 (하이픈 포함/미포함 모두 지원)
 */
export const removeCustomerFromUser = async (uid: string, businessNumber: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return;
    }

    const userData = userDoc.data() as JWSUser;
    const currentBusinessNumbers = userData.linkedCustomers || [];

    // 정규화된 사업자번호 (하이픈 포함 형태)
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;

    // 고객사가 없으면 종료
    if (!currentBusinessNumbers.includes(normalizedBusinessNumber)) {
      return;
    }

    // 고객사 제거
    const updatedBusinessNumbers = currentBusinessNumbers.filter(bn => bn !== normalizedBusinessNumber);

    await updateDoc(userRef, {
      linkedCustomers: updatedBusinessNumbers,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
      // Error handled silently
    console.error('removeCustomerFromUser 에러:', error);
    if (error instanceof Error) {
      throw new Error(`고객사를 사용자에서 제거하는 중 오류: ${error.message}`);
    }
    throw new Error('고객사를 사용자에서 제거하는 중 오류가 발생했습니다.');
  }
};

/**
 * 고객사 SMS 수신자용 사용자 생성
 * @param recipient SMS 수신자 정보
 * @param businessNumbers 연결할 고객사 사업자등록번호 목록 (하이픈 포함/미포함 모두 지원)
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
      roles: ['customer'],
      // primaryRole은 자동 계산되므로 설정하지 않음
      linkedCustomers: businessNumbers.map(bn => normalizeBusinessNumber(bn) as NormalizedBusinessNumber),
      isActive: true, // SMS 수신자는 즉시 활성화
      requiresPasswordChange: true // 첫 로그인 시 비밀번호 변경 필수
    };

    const result = await createUser(userData);
    return result;
  } catch (error) {
      // Error handled silently
    console.error('createCustomerUser 에러:', error);
    if (error instanceof Error) {
      throw new Error(`SMS 수신자 사용자 생성 중 오류: ${error.message}`);
    }
    throw new Error('SMS 수신자 사용자 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자에게 공급사 추가
 * @param uid 사용자 ID
 * @param businessNumber 추가할 공급사 사업자등록번호 (하이픈 포함/미포함 모두 지원)
 */
export const addSupplierToUser = async (uid: string, businessNumber: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as JWSUser;
    const currentBusinessNumbers = userData.linkedSuppliers || [];

    // 정규화된 사업자번호 (하이픈 포함 형태)
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;

    // 중복 확인
    if (currentBusinessNumbers.includes(normalizedBusinessNumber)) {
      return;
    }

    // 공급사 추가
    const updatedBusinessNumbers = [...currentBusinessNumbers, normalizedBusinessNumber];

    await updateDoc(userRef, {
      linkedSuppliers: updatedBusinessNumbers,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
      // Error handled silently
    console.error('addSupplierToUser 에러:', error);
    if (error instanceof Error) {
      throw new Error(`공급사를 사용자에 연결하는 중 오류: ${error.message}`);
    }
    throw new Error('공급사를 사용자에 연결하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자에게서 공급사 제거
 * @param uid 사용자 ID
 * @param businessNumber 제거할 공급사 사업자등록번호 (하이픈 포함/미포함 모두 지원)
 */
export const removeSupplierFromUser = async (uid: string, businessNumber: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return;
    }

    const userData = userDoc.data() as JWSUser;
    const currentBusinessNumbers = userData.linkedSuppliers || [];

    // 정규화된 사업자번호 (하이픈 포함 형태)
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber) as NormalizedBusinessNumber;

    // 공급사가 없으면 종료
    if (!currentBusinessNumbers.includes(normalizedBusinessNumber)) {
      return;
    }

    // 공급사 제거
    const updatedBusinessNumbers = currentBusinessNumbers.filter(bn => bn !== normalizedBusinessNumber);

    await updateDoc(userRef, {
      linkedSuppliers: updatedBusinessNumbers,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
      // Error handled silently
    console.error('removeSupplierFromUser 에러:', error);
    if (error instanceof Error) {
      throw new Error(`공급사를 사용자에서 제거하는 중 오류: ${error.message}`);
    }
    throw new Error('공급사를 사용자에서 제거하는 중 오류가 발생했습니다.');
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
      where('roles', 'array-contains', 'customer')
    );

    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => convertFirestoreToJWSUser(doc.id, doc.data() as FirestoreUser));

    return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
      // Error handled silently
    throw new Error('고객사에 연결된 사용자 목록을 조회할 수 없습니다.');
  }
};

/**
 * 특정 공급사에 연결된 사용자 목록 조회
 * @param businessNumber 공급사 사업자등록번호 (하이픈 제거된 형태)
 * @returns 연결된 사용자 목록
 */
export const getUsersBySupplier = async (businessNumber: string): Promise<JWSUser[]> => {
  try {
    const usersCollection = collection(db, 'users');

    // linkedSuppliers 배열에 해당 사업자번호가 포함된 사용자 조회
    const q = query(
      usersCollection,
      where('linkedSuppliers', 'array-contains', businessNumber),
      where('roles', 'array-contains', 'supplier')
    );

    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => convertFirestoreToJWSUser(doc.id, doc.data() as FirestoreUser));

    return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
      // Error handled silently
    throw new Error('공급사에 연결된 사용자 목록을 조회할 수 없습니다.');
  }
};

/**
 * 사용자가 삭제 가능한지 확인
 * @param userId 사용자 ID
 * @returns 삭제 가능 여부 및 사유
 */
export const canDeleteUser = async (userId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  linkedCompaniesCount?: number;
  linkedCompanies?: string[];
}> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { canDelete: false, reason: '사용자를 찾을 수 없습니다.' };
    }

    // 실제 존재하는 고객사/공급사만 확인
    const existingCustomers: string[] = [];
    const existingSuppliers: string[] = [];

    // 연결된 고객사 중 실제 존재하는 것만 필터링
    if (user.linkedCustomers && user.linkedCustomers.length > 0) {
      for (const businessNumber of user.linkedCustomers) {
        try {
          const customer = await customerService.getCustomer(businessNumber);
          if (customer) {
            existingCustomers.push(customer.businessName);
          }
        } catch {
          // 고객사가 존재하지 않으면 무시
        }
      }
    }

    // 연결된 공급사 중 실제 존재하는 것만 필터링
    if (user.linkedSuppliers && user.linkedSuppliers.length > 0) {
      for (const businessNumber of user.linkedSuppliers) {
        try {
          const supplier = await supplierService.getSupplierById(businessNumber);
          if (supplier) {
            existingSuppliers.push(supplier.businessName);
          }
        } catch {
          // 공급사가 존재하지 않으면 무시
        }
      }
    }

    const totalExistingCount = existingCustomers.length + existingSuppliers.length;

    // 실제 존재하는 회사가 있으면 삭제 불가
    if (totalExistingCount > 0) {
      const reasons = [];
      const allCompanies = [];

      if (existingCustomers.length > 0) {
        reasons.push(`${existingCustomers.length}개의 고객사`);
        allCompanies.push(...existingCustomers);
      }
      if (existingSuppliers.length > 0) {
        reasons.push(`${existingSuppliers.length}개의 공급사`);
        allCompanies.push(...existingSuppliers);
      }

      return {
        canDelete: false,
        reason: `연결된 ${reasons.join(', ')}가 있습니다: ${allCompanies.join(', ')}`,
        linkedCompaniesCount: totalExistingCount,
        linkedCompanies: allCompanies
      };
    }

    return { canDelete: true };
  } catch (error) {
      // Error handled silently
    return {
      canDelete: false,
      reason: error instanceof Error ? error.message : '사용자 확인 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자 삭제 (연결된 고객사가 없는 경우에만 가능)
 * @param userId 사용자 ID
 * @throws 연결된 고객사가 있거나 삭제 실패 시 에러
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // 삭제 가능 여부 확인
    const checkResult = await canDeleteUser(userId);

    if (!checkResult.canDelete) {
      if (checkResult.linkedCompaniesCount && checkResult.linkedCompaniesCount > 0) {
        throw new Error(
          `이 사용자는 ${checkResult.linkedCompaniesCount}개의 고객사에 연결되어 있어 삭제할 수 없습니다. ` +
          '먼저 모든 고객사 연결을 해제해주세요.'
        );
      }
      throw new Error(checkResult.reason || '사용자를 삭제할 수 없습니다.');
    }

    // Firebase Auth 및 Firestore에서 삭제
    await deleteUserAccount(userId);
  } catch (error) {
      // Error handled silently
    console.error('deleteUser 에러:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('사용자 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 전체 사용자 목록 조회 (getUsers의 alias)
 */
export const getAllUsers = getUsers;