"use strict";
/**
 * 파일 경로: /functions/src/user/resetUserPassword.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 사용자 비밀번호 초기화 Cloud Function
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserPassword = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
/**
 * 휴대폰번호 뒷자리 4자리를 2번 반복한 기본 비밀번호 생성
 * 예: 01012345678 → 56785678
 */
const generateDefaultPassword = (mobile) => {
    const last4 = mobile.slice(-4);
    return last4 + last4; // 8자리
};
/**
 * 사용자 비밀번호 초기화 Cloud Function
 * - 휴대폰번호 뒷자리 4자리 2회 반복으로 초기화
 * - requiresPasswordChange 플래그 설정
 */
exports.resetUserPassword = (0, https_1.onCall)({
    region: 'asia-northeast3',
    maxInstances: 10,
}, async (request) => {
    var _a, _b;
    try {
        // 인증 확인
        if (!request.auth) {
            throw new Error('Unauthorized');
        }
        const data = request.data;
        if (!data.uid) {
            throw new Error('Missing required field: uid');
        }
        // admin 권한 확인 (authUid 필드로 쿼리)
        const db = (0, firestore_1.getFirestore)();
        const callerQuery = await db.collection('users')
            .where('authUid', '==', request.auth.uid)
            .limit(1)
            .get();
        if (callerQuery.empty || !((_b = (_a = callerQuery.docs[0].data()) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.includes('admin'))) {
            throw new Error('Admin permission required');
        }
        // 대상 사용자 정보 가져오기 (uid는 휴대폰번호 = 문서 ID)
        const targetUserDoc = await db.collection('users').doc(data.uid).get();
        if (!targetUserDoc.exists) {
            throw new Error('User not found');
        }
        const targetUserData = targetUserDoc.data();
        if (!(targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.mobile)) {
            throw new Error('User mobile number not found');
        }
        // 기본 비밀번호 생성
        const defaultPassword = generateDefaultPassword(targetUserData.mobile);
        // Firebase Auth 비밀번호 업데이트 (authUid 사용)
        const auth = (0, auth_1.getAuth)();
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
            updatedAt: firestore_1.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Password reset successfully'
        };
    }
    catch (error) {
        console.error('❌ resetUserPassword error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        };
    }
});
//# sourceMappingURL=resetUserPassword.js.map