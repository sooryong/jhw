"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatistics = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
const db = (0, firestore_1.getFirestore)();
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
// SOLAPI 클라이언트 초기화
const initSolapi = (apiKey, apiSecret) => {
    if (!apiKey || !apiSecret) {
        throw new Error('CoolSMS credentials not configured');
    }
    return new solapi_1.SolapiMessageService(apiKey, apiSecret);
};
exports.getStatistics = (0, https_1.onCall)({
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 5
}, async (request) => {
    var _a, _b, _c;
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
        console.log('📊 SOLAPI v5.5.2 통계 조회 시작...');
        // Secrets에서 API 키 가져오기
        const apiKey = solapiApiKey.value();
        const apiSecret = solapiApiSecret.value();
        const messageService = initSolapi(apiKey, apiSecret);
        // SOLAPI v5.5.2 통계 조회
        const statistics = await messageService.getStatistics();
        console.log('✅ SOLAPI v5.5.2 통계 조회 성공:', {
            statistics: statistics
        });
        // 최근 메시지 목록도 함께 조회
        const messages = await messageService.getMessages({
            limit: 50
        });
        return {
            success: true,
            statistics,
            recentMessages: {
                count: ((_c = messages.messageList) === null || _c === void 0 ? void 0 : _c.length) || 0,
                messages: messages.messageList || []
            },
            timestamp: new Date().toISOString(),
            version: 'v2_solapi_5.5.2_statistics'
        };
    }
    catch (error) {
        console.error('❌ SOLAPI v5.5.2 통계 조회 실패:', error);
        // Fallback: 로컬 Firestore 데이터로 대체 통계 제공
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayMessages = await db.collection('smsHistory')
                .where('createdAt', '>=', today)
                .get();
            const fallbackStats = {
                total: {
                    success: todayMessages.docs.filter(doc => doc.data().status === 'sent').length,
                    failed: todayMessages.docs.filter(doc => doc.data().status === 'failed').length,
                    pending: todayMessages.docs.filter(doc => doc.data().status === 'pending').length
                },
                today: todayMessages.size,
                note: 'Fallback statistics from local data'
            };
            console.log('⚠️ Fallback 통계 사용:', fallbackStats);
            return {
                success: true,
                statistics: fallbackStats,
                recentMessages: { count: 0, messages: [] },
                timestamp: new Date().toISOString(),
                version: 'v2_fallback_statistics',
                fallback: true
            };
        }
        catch (fallbackError) {
            console.error('❌ Fallback 통계도 실패:', fallbackError);
            throw new https_1.HttpsError('internal', `Statistics service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
});
//# sourceMappingURL=getStatistics.js.map