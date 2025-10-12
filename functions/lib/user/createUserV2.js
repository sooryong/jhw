"use strict";
/**
 * 파일 경로: /functions/src/user/createUserV2.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 사용자 생성 Cloud Function (Firebase Auth + Firestore)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserV2 = void 0;
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
 * 사용자 생성 Cloud Function
 * - Firebase Authentication 계정 생성
 * - Firestore users 컬렉션에 사용자 문서 생성
 */
exports.createUserV2 = (0, https_1.onRequest)({
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
}, async (request, response) => {
    var _a, _b, _c, _d;
    // CORS 헤더 설정
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Preflight 요청 처리
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
        return;
    }
    // POST 요청만 허용
    if (request.method !== 'POST') {
        response.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
        return;
    }
    try {
        // 인증 확인
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            response.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const auth = (0, auth_1.getAuth)();
        // 토큰 검증
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        }
        catch (_e) {
            response.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
            return;
        }
        // admin 권한 확인 (Firestore에서)
        const db = (0, firestore_1.getFirestore)();
        const callerDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
            response.status(403).json({
                success: false,
                error: 'Admin permission required'
            });
            return;
        }
        // 요청 데이터 검증
        const userData = request.body;
        if (!userData.name || !userData.mobile || !userData.role) {
            response.status(400).json({
                success: false,
                error: 'Missing required fields: name, mobile, role'
            });
            return;
        }
        // 휴대폰번호 중복 확인
        const existingUsers = await db.collection('users')
            .where('mobile', '==', userData.mobile)
            .limit(1)
            .get();
        if (!existingUsers.empty) {
            response.status(400).json({
                success: false,
                error: 'Mobile number already exists'
            });
            return;
        }
        // 기본 비밀번호 생성
        const defaultPassword = generateDefaultPassword(userData.mobile);
        // Firebase Authentication 계정 생성
        const email = `${userData.mobile}@jws.local`;
        const userRecord = await auth.createUser({
            email,
            password: defaultPassword,
            displayName: userData.name,
            disabled: !((_b = userData.isActive) !== null && _b !== void 0 ? _b : true)
        });
        // Firestore users 컬렉션에 사용자 문서 생성
        const userDocData = {
            name: userData.name,
            mobile: userData.mobile,
            role: userData.role,
            isActive: (_c = userData.isActive) !== null && _c !== void 0 ? _c : true,
            requiresPasswordChange: (_d = userData.requiresPasswordChange) !== null && _d !== void 0 ? _d : true,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            lastLogin: null,
            passwordChangedAt: null
        };
        // customer 역할인 경우 customerBusinessNumbers 추가
        if (userData.role === 'customer' && userData.customerBusinessNumbers) {
            userDocData.customerBusinessNumbers = userData.customerBusinessNumbers;
        }
        await db.collection('users').doc(userRecord.uid).set(userDocData);
        // 성공 응답
        response.status(200).json({
            success: true,
            uid: userRecord.uid,
            defaultPassword
        });
    }
    catch (error) {
        console.error('❌ createUserV2 error:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=createUserV2.js.map