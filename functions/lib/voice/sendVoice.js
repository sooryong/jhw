"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVoice = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
const db = (0, firestore_1.getFirestore)();
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
exports.sendVoice = (0, https_1.onCall)({
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
        const { to, text, voiceType, headerMessage, tailMessage, replyRange, counselorNumber, scheduledDate } = request.data;
        if (!to || !text || !voiceType) {
            throw new https_1.HttpsError('invalid-argument', 'to, text, and voiceType are required');
        }
        if (!['MALE', 'FEMALE'].includes(voiceType)) {
            throw new https_1.HttpsError('invalid-argument', 'voiceType must be MALE or FEMALE');
        }
        if (replyRange && counselorNumber) {
            throw new https_1.HttpsError('invalid-argument', 'replyRange and counselorNumber cannot be used together');
        }
        if (replyRange && (replyRange < 1 || replyRange > 9)) {
            throw new https_1.HttpsError('invalid-argument', 'replyRange must be between 1 and 9');
        }
        if (headerMessage && headerMessage.length > 135) {
            throw new https_1.HttpsError('invalid-argument', 'headerMessage must be 135 characters or less');
        }
        // SOLAPI 메시지 서비스 초기화
        const messageService = new solapi_1.SolapiMessageService(solapiApiKey.value(), solapiApiSecret.value());
        console.log('📤 음성 메시지 발송 시작:', {
            to: to.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3'),
            textLength: text.length,
            voiceType,
            hasHeaderMessage: !!headerMessage,
            hasTailMessage: !!tailMessage,
            replyRange,
            hasCounselorNumber: !!counselorNumber,
            isScheduled: !!scheduledDate
        });
        const messageData = {
            to,
            from: '01038139885', // 발신번호
            text,
            voiceOptions: {
                voiceType
            }
        };
        // 선택적 옵션들 추가
        if (headerMessage) {
            messageData.voiceOptions.headerMessage = headerMessage;
        }
        if (tailMessage && headerMessage) {
            messageData.voiceOptions.tailMessage = tailMessage;
        }
        if (replyRange) {
            messageData.voiceOptions.replyRange = replyRange;
        }
        if (counselorNumber) {
            messageData.voiceOptions.counselorNumber = counselorNumber;
        }
        // 즉시 발송
        const result = await messageService.send(messageData);
        console.log('✅ 음성 메시지 발송 성공:', result);
        // 발송 이력 저장
        await db.collection('voiceHistory').add({
            type: 'VOICE',
            to,
            text,
            voiceType,
            headerMessage,
            tailMessage,
            replyRange,
            counselorNumber,
            status: 'sent',
            result,
            scheduledDate,
            timestamp: new Date(),
            createdBy: auth.uid
        });
        return {
            success: true,
            result,
            message: '음성 메시지가 성공적으로 발송되었습니다.',
            version: 'v2_solapi_voice'
        };
    }
    catch (error) {
        console.error('❌ 음성 메시지 발송 실패:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Voice service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=sendVoice.js.map