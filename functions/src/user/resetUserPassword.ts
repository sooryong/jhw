/**
 * 파일 경로: /functions/src/user/resetUserPassword.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 사용자 비밀번호 초기화 Cloud Function
 */

import { onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface ResetPasswordRequest {
  uid: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 휴대폰번호 뒷자리 4자리를 2번 반복한 기본 비밀번호 생성
 * 예: 01012345678 → 56785678
 */
const generateDefaultPassword = (mobile: string): string => {
  const last4 = mobile.slice(-4);
  return last4 + last4; // 8자리
};

/**
 * 사용자 비밀번호 초기화 Cloud Function
 * - 휴대폰번호 뒷자리 4자리 2회 반복으로 초기화
 * - requiresPasswordChange 플래그 설정
 */
export const resetUserPassword = onCall(
  {
    region: 'asia-northeast3',
    maxInstances: 10,
  },
  async (request) => {
    try {
      // 인증 확인
      if (!request.auth) {
        throw new Error('Unauthorized');
      }

      const data = request.data as ResetPasswordRequest;

      if (!data.uid) {
        throw new Error('Missing required field: uid');
      }

      // admin 권한 확인 (authUid 필드로 쿼리)
      const db = getFirestore();
      const callerQuery = await db.collection('users')
        .where('authUid', '==', request.auth.uid)
        .limit(1)
        .get();

      if (callerQuery.empty || callerQuery.docs[0].data()?.role !== 'admin') {
        throw new Error('Admin permission required');
      }

      // 대상 사용자 정보 가져오기 (uid는 휴대폰번호 = 문서 ID)
      const targetUserDoc = await db.collection('users').doc(data.uid).get();

      if (!targetUserDoc.exists) {
        throw new Error('User not found');
      }

      const targetUserData = targetUserDoc.data();
      if (!targetUserData?.mobile) {
        throw new Error('User mobile number not found');
      }

      // 기본 비밀번호 생성
      const defaultPassword = generateDefaultPassword(targetUserData.mobile);

      // Firebase Auth 비밀번호 업데이트 (authUid 사용)
      const auth = getAuth();
      if (!targetUserData.authUid) {
        throw new Error('User authUid not found');
      }
      await auth.updateUser(targetUserData.authUid, {
        password: defaultPassword
      });

      // Firestore 사용자 문서 업데이트 (문서 ID는 휴대폰번호)
      await db.collection('users').doc(data.uid).update({
        requiresPasswordChange: true,
        passwordChangedAt: null,
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      } as ResetPasswordResponse;

    } catch (error) {
      console.error('❌ resetUserPassword error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as ResetPasswordResponse;
    }
  }
);