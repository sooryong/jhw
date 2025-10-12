"use strict";
/**
 * 파일 경로: /functions/src/user/createUser.ts
 * 작성 날짜: 2025-09-30
 * 주요 내용: 사용자 생성 Cloud Function (Firebase Auth + Firestore)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = void 0;
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
 * 사용자 생성 Cloud Function v2.1
 * - Firebase Authentication 계정 생성
 * - Firestore users 컬렉션에 사용자 문서 생성
 * - linkedCustomers 필드 무조건 포함
 */
exports.createUser = (0, https_1.onRequest)({
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
}, async (request, response) => {
    var _a, _b, _c, _d, _e, _f;
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
        catch (_g) {
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
        if (callerQuery.empty || ((_a = callerQuery.docs[0].data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
            response.status(403).json({
                success: false,
                error: 'Admin permission required'
            });
            return;
        }
        // 요청 데이터 검증
        const userData = request.body;
        console.log('🚀🚀🚀 createUser 함수 버전: v2.1 - FORCE DEPLOY 🚀🚀🚀');
        console.log('🔍 받은 요청 데이터:', JSON.stringify(userData, null, 2));
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
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email,
                password: defaultPassword,
                displayName: userData.name,
                disabled: !((_b = userData.isActive) !== null && _b !== void 0 ? _b : true)
            });
        }
        catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
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
            role: userData.role,
            isActive: (_c = userData.isActive) !== null && _c !== void 0 ? _c : true,
            requiresPasswordChange: (_d = userData.requiresPasswordChange) !== null && _d !== void 0 ? _d : true,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            lastLogin: null,
            passwordChangedAt: null
        };
        // customer 역할인 경우 linkedCustomers 추가
        if (userData.role === 'customer') {
            console.log('🔍 customer 역할 확인');
            console.log('  - linkedCustomers 존재:', !!userData.linkedCustomers);
            console.log('  - linkedCustomers 타입:', typeof userData.linkedCustomers);
            console.log('  - linkedCustomers 배열 여부:', Array.isArray(userData.linkedCustomers));
            console.log('  - linkedCustomers 길이:', (_e = userData.linkedCustomers) === null || _e === void 0 ? void 0 : _e.length);
            console.log('  - linkedCustomers 값:', JSON.stringify(userData.linkedCustomers));
            // linkedCustomers 필드는 항상 추가 (배열이면 그대로, 없으면 빈 배열)
            const linkedCustomersValue = userData.linkedCustomers || [];
            userDocData.linkedCustomers = linkedCustomersValue;
            console.log('✅ linkedCustomers를 userDocData에 추가:');
            console.log('   - 값:', JSON.stringify(linkedCustomersValue));
            console.log('   - 길이:', linkedCustomersValue.length);
            console.log('   - 타입:', typeof linkedCustomersValue);
            console.log('   - 배열 여부:', Array.isArray(linkedCustomersValue));
        }
        console.log('💾 Firestore에 저장할 데이터:', JSON.stringify(userDocData, null, 2));
        console.log('💾 linkedCustomers in userDocData:', 'linkedCustomers' in userDocData);
        console.log('💾 userDocData.linkedCustomers:', userDocData.linkedCustomers);
        // 휴대폰번호를 문서 ID로 사용
        await db.collection('users').doc(userData.mobile).set(userDocData);
        console.log('✅ Firestore 저장 완료');
        // 저장 직후 확인
        const savedDoc = await db.collection('users').doc(userData.mobile).get();
        const savedData = savedDoc.data();
        console.log('🔍 저장 직후 확인 - linkedCustomers:', savedData === null || savedData === void 0 ? void 0 : savedData.linkedCustomers);
        console.log('🔍 저장 직후 확인 - 전체 데이터:', JSON.stringify(savedData, null, 2));
        // 성공 응답 (uid로 mobile 반환 - Firestore 문서 ID와 일치)
        response.status(200).json({
            success: true,
            uid: userData.mobile, // Firestore 문서 ID (휴대폰번호)
            defaultPassword,
            _debug: {
                version: 'v2.1',
                linkedCustomersSaved: ((_f = savedData === null || savedData === void 0 ? void 0 : savedData.linkedCustomers) === null || _f === void 0 ? void 0 : _f.length) || 0,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('❌ createUser error:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=createUser.js.map