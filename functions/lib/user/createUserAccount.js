"use strict";
/**
 * 파일 경로: /functions/src/user/createUserAccount.ts
 * 작성 날짜: 2025-10-12
 * 주요 내용: 사용자 계정 생성 Cloud Function (캐시 우회용 새 함수)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserAccount = void 0;
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
 * 사용자 계정 생성 Cloud Function (NEW!)
 * - Firebase Authentication 계정 생성
 * - Firestore users 컬렉션에 사용자 문서 생성
 * - linkedCustomers 필드 무조건 포함
 */
exports.createUserAccount = (0, https_1.onRequest)({
    region: 'asia-northeast3',
    cors: true,
    maxInstances: 10,
}, async (request, response) => {
    var _a, _b, _c, _d, _e;
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
            response.set('Access-Control-Allow-Origin', '*');
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
        catch (_f) {
            response.set('Access-Control-Allow-Origin', '*');
            response.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
            return;
        }
        // admin 권한 확인 (authUid 필드로 조회)
        const db = (0, firestore_1.getFirestore)();
        const callerQuery = await db.collection('users')
            .where('authUid', '==', decodedToken.uid)
            .limit(1)
            .get();
        if (callerQuery.empty || !((_b = (_a = callerQuery.docs[0].data()) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.includes('admin'))) {
            response.set('Access-Control-Allow-Origin', '*');
            response.status(403).json({
                success: false,
                error: 'Admin permission required'
            });
            return;
        }
        // 요청 데이터 검증
        const userData = request.body;
        if (!userData.name || !userData.mobile || !userData.roles || userData.roles.length === 0) {
            response.set('Access-Control-Allow-Origin', '*');
            response.status(400).json({
                success: false,
                error: 'Missing required fields: name, mobile, roles'
            });
            return;
        }
        // 휴대폰번호 중복 확인
        const existingUsers = await db.collection('users')
            .where('mobile', '==', userData.mobile)
            .limit(1)
            .get();
        if (!existingUsers.empty) {
            response.set('Access-Control-Allow-Origin', '*');
            response.status(400).json({
                success: false,
                error: 'Mobile number already exists'
            });
            return;
        }
        // 기본 비밀번호 생성
        const defaultPassword = generateDefaultPassword(userData.mobile);
        // Firebase Authentication 계정 생성
        const email = `${userData.mobile}@jhw.local`;
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email,
                password: defaultPassword,
                displayName: userData.name,
                disabled: !((_c = userData.isActive) !== null && _c !== void 0 ? _c : true)
            });
        }
        catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                response.set('Access-Control-Allow-Origin', '*');
                response.status(400).json({
                    success: false,
                    error: 'Firebase Auth에 이미 등록된 휴대폰번호입니다. Firestore에서 먼저 삭제해주세요.'
                });
                return;
            }
            throw authError;
        }
        // Firestore users 컬렉션에 사용자 문서 생성
        const userDocData = {
            authUid: userRecord.uid, // Firebase Auth UID 저장
            name: userData.name,
            mobile: userData.mobile,
            roles: userData.roles, // 다중 역할 배열 저장
            isActive: (_d = userData.isActive) !== null && _d !== void 0 ? _d : true,
            requiresPasswordChange: (_e = userData.requiresPasswordChange) !== null && _e !== void 0 ? _e : true,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            lastLogin: null,
            passwordChangedAt: null
        };
        // customer 역할이 포함된 경우 linkedCustomers 추가
        if (userData.roles.includes('customer')) {
            userDocData.linkedCustomers = userData.linkedCustomers || [];
        }
        // supplier 역할이 포함된 경우 linkedSuppliers 추가
        if (userData.roles.includes('supplier')) {
            userDocData.linkedSuppliers = userData.linkedSuppliers || [];
        }
        // 휴대폰번호를 문서 ID로 사용
        await db.collection('users').doc(userData.mobile).set(userDocData);
        // 성공 응답 (uid로 mobile 반환 - Firestore 문서 ID와 일치)
        response.set('Access-Control-Allow-Origin', '*');
        response.status(200).json({
            success: true,
            uid: userData.mobile, // Firestore 문서 ID (휴대폰번호)
            defaultPassword
        });
    }
    catch (error) {
        console.error('❌ createUserAccount error:', error);
        response.set('Access-Control-Allow-Origin', '*');
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=createUserAccount.js.map