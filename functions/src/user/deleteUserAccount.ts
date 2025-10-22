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

      if (callerQuery.empty || !callerQuery.docs[0].data()?.roles?.includes('admin')) {
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

      // authUid가 있으면 Firebase Auth에서도 삭제
      if (authUid) {
        const auth = getAuth();
        try {
          await auth.deleteUser(authUid);
          console.log('✅ Firebase Auth user deleted:', authUid);
        } catch (authError) {
          console.warn('⚠️ Firebase Auth user not found, continuing with Firestore deletion:', authError);
        }
      } else {
        // authUid가 없는 경우 (supplier 전용 사용자)
        console.log('ℹ️ No authUid - Firestore-only user (supplier), skipping Firebase Auth deletion');
      }

      // Firestore users 컬렉션 문서 삭제 (모든 경우에 실행)
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