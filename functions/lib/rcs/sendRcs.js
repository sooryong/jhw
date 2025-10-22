"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRcs = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
const db = (0, firestore_1.getFirestore)();
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
exports.sendRcs = (0, https_1.onCall)({
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
        const { to, text, brandId, buttons = [], replacements = [], scheduledDate } = request.data;
        if (!to || !text || !brandId) {
            throw new https_1.HttpsError('invalid-argument', 'to, text, and brandId are required');
        }
        // SOLAPI 메시지 서비스 초기화
        const messageService = new solapi_1.SolapiMessageService(solapiApiKey.value(), solapiApiSecret.value());
        console.log('📤 RCS 메시지 발송 시작:', {
            to: to.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3'),
            textLength: text.length,
            brandId,
            hasButtons: buttons.length > 0,
            hasReplacements: replacements.length > 0,
            isScheduled: !!scheduledDate
        });
        const messageData = {
            to,
            from: '01038139885', // RCS용 발신번호
            text,
            rcsOptions: {
                brandId
            }
        };
        // 버튼이 있는 경우 추가
        if (buttons.length > 0) {
            messageData.rcsOptions.buttons = buttons;
        }
        // 대체 발송 메시지가 있는 경우 추가
        if (replacements.length > 0) {
            messageData.replacements = replacements;
        }
        // 즉시 발송
        const result = await messageService.sendOne(messageData);
        console.log('✅ RCS 메시지 발송 성공:', result);
        // 발송 이력 저장
        await db.collection('rcsHistory').add({
            type: 'RCS',
            to,
            text,
            brandId,
            buttons,
            replacements,
            status: 'sent',
            result,
            scheduledDate,
            timestamp: new Date(),
            createdBy: auth.uid
        });
        return {
            success: true,
            result,
            message: 'RCS 메시지가 성공적으로 발송되었습니다.',
            version: 'v2_solapi_rcs'
        };
    }
    catch (error) {
        console.error('❌ RCS 메시지 발송 실패:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `RCS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=sendRcs.js.map