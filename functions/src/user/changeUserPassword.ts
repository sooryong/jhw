import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * 사용자가 자신의 비밀번호를 변경하는 함수
 * - 현재 로그인한 사용자만 자신의 비밀번호를 변경 가능
 * - requiresPasswordChange 플래그 자동 해제
 */
export const changeUserPassword = onCall({
  cors: true,
  region: 'asia-northeast3'
}, async (request) => {
  const { data, auth } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { currentPassword, newPassword } = data;

  if (!newPassword) {
    throw new HttpsError('invalid-argument', 'New password is required');
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'New password must be at least 6 characters long');
  }

  try {
    const adminAuth = getAuth();
    const db = getFirestore();

    // 사용자 정보 확인
    const user = await adminAuth.getUser(auth.uid);

    if (!user.email) {
      throw new HttpsError('invalid-argument', 'User email not found');
    }

    // Firestore에서 requiresPasswordChange 확인 (authUid 필드로 쿼리)
    const userQuery = await db.collection('users')
      .where('authUid', '==', auth.uid)
      .limit(1)
      .get();

    if (userQuery.empty) {
      throw new HttpsError('not-found', 'User document not found in Firestore');
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    const requiresPasswordChange = userData?.requiresPasswordChange ?? false;

    // 신규 사용자(requiresPasswordChange=true)가 아닌 경우 현재 비밀번호 필수
    if (!requiresPasswordChange && !currentPassword) {
      throw new HttpsError('invalid-argument', 'Current password is required');
    }

    // Firebase Auth에서 비밀번호 변경
    // Note: Admin SDK는 현재 비밀번호 검증 없이 변경 가능
    // 일반 사용자는 클라이언트에서 reauthenticateWithCredential로 검증 후 호출
    await adminAuth.updateUser(auth.uid, {
      password: newPassword
    });

    // Firestore에서 비밀번호 변경 필수 플래그 해제 (문서 ID는 휴대폰번호)
    await db.collection('users').doc(userDoc.id).update({
      requiresPasswordChange: false,
      passwordChangedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    console.error('Change password failed:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', `Password change failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
