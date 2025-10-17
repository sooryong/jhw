"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSms = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
const db = (0, firestore_1.getFirestore)();
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
exports.sendSms = (0, https_1.onCall)({
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10
}, async (request) => {
    var _a;
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인 (authUid 필드로 쿼리)
    const userQuery = await db.collection('users')
        .where('authUid', '==', auth.uid)
        .limit(1)
        .get();
    if (userQuery.empty || ((_a = userQuery.docs[0].data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin role required');
    }
    try {
        const { to, text } = request.data;
        if (!to || !text) {
            throw new https_1.HttpsError('invalid-argument', 'Both "to" and "text" are required');
        }
        // SOLAPI 메시지 서비스 초기화
        const messageService = new solapi_1.SolapiMessageService(solapiApiKey.value(), solapiApiSecret.value());
        console.log('📤 SOLAPI 메시지 발송 시작:', {
            to: to.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3'), // 번호 마스킹
            textLength: text.length
        });
        // sendOne 방식 사용 (더 간단한 API)
        const result = await messageService.sendOne({
            to,
            from: '01038139885', // 발신번호
            text
        });
        console.log('✅ SOLAPI 메시지 발송 성공:', result);
        return {
            success: true,
            result,
            messageId: (result === null || result === void 0 ? void 0 : result.messageId) || 'unknown',
            message: 'SMS sent successfully',
            version: 'v2_solapi_sendone'
        };
    }
    catch (error) {
        console.error('❌ SOLAPI 메시지 발송 실패:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `SMS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=sendSms.js.map