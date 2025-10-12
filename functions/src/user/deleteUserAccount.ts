/**
 * 파일 경로: /functions/src/user/deleteUserAccount.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 사용자 계정 완전 삭제 Cloud Function
 */

import { onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

interface DeleteUserRequest {
  uid: string;
}

interface DeleteUserResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 사용자 계정 완전 삭제 Cloud Function
 * - Firebase Authentication 계정 삭제
 * - Firestore users 컬렉션 문서 삭제
 */
export const deleteUserAccount = onCall(
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

      const data = request.data as DeleteUserRequest;

      if (!data.uid) {
        throw new Error('Missing required field: uid');
      }

      // admin 권한 확인
      const db = getFirestore();

      // 호출자의 authUid로 문서 조회
      const callerQuery = await db.collection('users').where('authUid', '==', request.auth.uid).get();

      if (callerQuery.empty || callerQuery.docs[0].data()?.role !== 'admin') {
        throw new Error('Admin permission required');
      }

      // 본인 삭제 방지 (호출자 문서 ID와 삭제 대상 문서 ID 비교)
      const callerDocId = callerQuery.docs[0].id; // 호출자의 휴대폰번호(문서 ID)
      if (callerDocId === data.uid) {
        throw new Error('Cannot delete your own account');
      }

      // 삭제할 사용자 문서 조회 (uid는 휴대폰번호 = 문서 ID)
      const targetUserDoc = await db.collection('users').doc(data.uid).get();

      if (!targetUserDoc.exists) {
        throw new Error('User document not found');
      }

      const targetUserData = targetUserDoc.data();
      const authUid = targetUserData?.authUid;

      if (!authUid) {
        throw new Error('User authUid not found');
      }

      // Firebase Authentication 계정 삭제
      const auth = getAuth();
      try {
        await auth.deleteUser(authUid);
      } catch (authError) {
        // Auth 계정이 없어도 Firestore 문서는 삭제 진행
        console.warn('⚠️ Firebase Auth user not found, continuing with Firestore deletion:', authError);
      }

      // Firestore users 컬렉션 문서 삭제 (문서 ID = 휴대폰번호)
      await db.collection('users').doc(data.uid).delete();

      return {
        success: true,
        message: 'User account deleted successfully'
      } as DeleteUserResponse;

    } catch (error) {
      console.error('❌ deleteUserAccount error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as DeleteUserResponse;
    }
  }
);