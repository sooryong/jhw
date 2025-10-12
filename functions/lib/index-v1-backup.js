"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.resetUserPassword = exports.getCreditBalance = exports.sendSms = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const solapi_1 = require("solapi");
admin.initializeApp();
// CoolSMS 클라이언트 초기화
const initSolapi = () => {
    var _a, _b;
    const config = functions.config();
    const apiKey = (_a = config.coolsms) === null || _a === void 0 ? void 0 : _a.api_key;
    const apiSecret = (_b = config.coolsms) === null || _b === void 0 ? void 0 : _b.api_secret;
    if (!apiKey || !apiSecret) {
        throw new Error('CoolSMS credentials not configured. Use: firebase functions:config:set coolsms.api_key="YOUR_KEY" coolsms.api_secret="YOUR_SECRET"');
    }
    return new solapi_1.SolapiMessageService(apiKey, apiSecret);
};
// 실제 CoolSMS 잔액 조회 함수 - SolapiSDK 사용
const getRealSolapiBalance = async () => {
    var _a, _b;
    console.log('🔑 Retrieving CoolSMS API credentials from functions.config()...');
    const config = functions.config();
    const apiKey = (_a = config.coolsms) === null || _a === void 0 ? void 0 : _a.api_key;
    const apiSecret = (_b = config.coolsms) === null || _b === void 0 ? void 0 : _b.api_secret;
    console.log('📋 API Key length:', apiKey ? apiKey.length : 0);
    console.log('📋 API Secret length:', apiSecret ? apiSecret.length : 0);
    if (!apiKey || !apiSecret) {
        throw new Error('CoolSMS API credentials not configured. Use: firebase functions:config:set coolsms.api_key="YOUR_KEY" coolsms.api_secret="YOUR_SECRET"');
    }
    try {
        console.log('🚀 Using SolapiSDK for balance check...');
        const messageService = new solapi_1.SolapiMessageService(apiKey, apiSecret);
        // SolapiSDK를 사용해서 잔액 조회
        const response = await messageService.getBalance();
        console.log('✅ SolapiSDK balance response:', JSON.stringify(response, null, 2));
        return response;
    }
    catch (error) {
        console.error('❌ SolapiSDK error:', error);
        throw error;
    }
};
// 백업용 더미 데이터 함수 - Enhanced for development
const getDummyBalance = () => {
    console.log('⚠️ Using fallback dummy balance data for development/testing');
    return {
        point: 2500,
        cash: 7500,
        note: 'This is dummy data - CoolSMS API not accessible'
    };
};
// SMS 발송 함수
exports.sendSms = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin role required');
    }
    try {
        const messageService = initSolapi();
        const { to, text } = data;
        if (!to || !text) {
            throw new functions.https.HttpsError('invalid-argument', 'Both "to" and "text" are required');
        }
        const result = await messageService.sendOne({
            to,
            from: '01089822015', // 발신번호
            text,
            type: 'SMS'
        }).then(result => {
            console.log('Solapi SDK sendOne success:', JSON.stringify(result, null, 2));
            return {
                success: true,
                result,
                message: 'SMS sent successfully'
            };
        }).catch(error => {
            console.error('Solapi SDK sendOne error:', error);
            throw new functions.https.HttpsError('internal', `SMS sending failed: ${error.message}`);
        });
        return result;
    }
    catch (error) {
        console.error('SMS sending error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `SMS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// CoolSMS 잔액 조회 함수
exports.getCreditBalance = functions.https.onCall(async () => {
    try {
        console.log('🔍 Credit balance check started - Firebase Functions v1');
        let balanceData;
        let isRealData = false;
        try {
            console.log('🌐 Attempting to fetch real CoolSMS balance...');
            balanceData = await getRealSolapiBalance();
            isRealData = true;
            console.log('✅ Real CoolSMS balance retrieved successfully:', JSON.stringify(balanceData, null, 2));
        }
        catch (error) {
            console.warn('⚠️ Failed to fetch real balance, using fallback dummy data:', error);
            console.warn('Error details:', error instanceof Error ? error.message : 'Unknown error');
            balanceData = getDummyBalance();
            isRealData = false;
        }
        // Enhanced response with metadata
        return {
            success: true,
            balance: balanceData,
            timestamp: new Date().toISOString(),
            source: isRealData ? 'coolsms_api' : 'fallback_dummy',
            version: 'v1'
        };
    }
    catch (error) {
        console.error('❌ Credit balance check failed:', error);
        throw new functions.https.HttpsError('internal', `Balance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// 사용자 비밀번호 초기화
exports.resetUserPassword = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 호출자가 admin 권한인지 확인
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin role required');
    }
    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }
    try {
        // 대상 사용자 정보 가져오기
        const targetUserDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!targetUserDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const targetUserData = targetUserDoc.data();
        if (!(targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.mobile)) {
            throw new functions.https.HttpsError('invalid-argument', 'User mobile number not found');
        }
        // 새 비밀번호 생성 (휴대폰 뒷자리 4자리를 2번 반복)
        const normalizedMobile = targetUserData.mobile.replace(/[^0-9]/g, '');
        const lastFourDigits = normalizedMobile.slice(-4);
        const newPassword = lastFourDigits + lastFourDigits;
        // Firebase Auth에서 비밀번호 변경
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        // Firestore에서 비밀번호 변경 필수 플래그 설정
        await admin.firestore().collection('users').doc(uid).update({
            requiresPasswordChange: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Password reset successfully'
        };
    }
    catch (error) {
        console.error('Password reset failed:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// 사용자 계정 완전 삭제
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 호출자가 admin 권한인지 확인
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin role required');
    }
    const { targetUserId } = data;
    if (!targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Target user ID is required');
    }
    try {
        // Firestore에서 사용자 데이터 삭제
        await admin.firestore().collection('users').doc(targetUserId).delete();
        // Firebase Auth에서 사용자 삭제
        await admin.auth().deleteUser(targetUserId);
        return {
            success: true,
            message: 'User account deleted successfully'
        };
    }
    catch (error) {
        console.error('Delete user account error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `User deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=index-v1-backup.js.map