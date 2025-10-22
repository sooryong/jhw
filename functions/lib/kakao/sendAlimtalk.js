"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlimtalk = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
const db = (0, firestore_1.getFirestore)();
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
exports.sendAlimtalk = (0, https_1.onCall)({
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10
}, async (request) => {
    var _a, _b;
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인 (authUid 필드로 쿼리)
    const userQuery = await db.collection('users')
        .where('authUid', '==', auth.uid)
        .limit(1)
        .get();
    if (userQuery.empty || !((_b = (_a = userQuery.docs[0].data()) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.includes('admin'))) {
        throw new https_1.HttpsError('permission-denied', 'Admin role required');
    }
    try {
        const { to, pfId, templateId, variables = {}, disableSms = false, scheduledDate } = request.data;
        if (!to || !pfId || !templateId) {
            throw new https_1.HttpsError('invalid-argument', 'to, pfId, and templateId are required');
        }
        // SOLAPI 메시지 서비스 초기화
        const messageService = new solapi_1.SolapiMessageService(solapiApiKey.value(), solapiApiSecret.value());
        console.log('📤 카카오톡 알림톡 발송 시작:', {
            to: to.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3'),
            templateId,
            pfId,
            hasVariables: Object.keys(variables).length > 0,
            isScheduled: !!scheduledDate
        });
        const messageData = {
            to,
            from: '01038139885', // 발신번호
            kakaoOptions: {
                pfId,
                templateId,
                variables,
                disableSms
            }
        };
        // 즉시 발송 (예약 발송 기능은 추후 구현)
        const result = await messageService.sendOne(messageData);
        console.log('✅ 카카오톡 알림톡 발송 성공:', result);
        // 발송 이력 저장
        await db.collection('kakaoHistory').add({
            type: 'ALIMTALK',
            to,
            pfId,
            templateId,
            variables,
            status: 'sent',
            result,
            scheduledDate,
            timestamp: new Date(),
            createdBy: auth.uid
        });
        return {
            success: true,
            result,
            message: '카카오톡 알림톡이 성공적으로 발송되었습니다.',
            version: 'v2_solapi_alimtalk'
        };
    }
    catch (error) {
        console.error('❌ 카카오톡 알림톡 발송 실패:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Alimtalk service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=sendAlimtalk.js.map