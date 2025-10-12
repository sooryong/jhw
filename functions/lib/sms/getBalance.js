"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = void 0;
const https_1 = require("firebase-functions/v2/https");
const solapi_1 = require("solapi");
const params_1 = require("firebase-functions/params");
// Secrets 정의
const solapiApiKey = (0, params_1.defineSecret)('SOLAPI_API_KEY');
const solapiApiSecret = (0, params_1.defineSecret)('SOLAPI_API_SECRET');
// 실제 CoolSMS 잔액 조회 함수 - 최신 SolapiSDK 사용
const getRealSolapiBalance = async (apiKey, apiSecret) => {
    console.log('🔑 Using CoolSMS API credentials from secrets...');
    console.log('📋 API Key length:', apiKey ? apiKey.length : 0);
    console.log('📋 API Secret length:', apiSecret ? apiSecret.length : 0);
    if (!apiKey || !apiSecret) {
        throw new Error('CoolSMS API credentials not configured');
    }
    try {
        console.log('🚀 Using SolapiSDK v5.5.2 for balance check...');
        const messageService = new solapi_1.SolapiMessageService(apiKey, apiSecret);
        // 최신 SDK 방식: getBalance() 메서드 사용
        const response = await messageService.getBalance();
        console.log('✅ SolapiSDK v5.5.2 balance response:', JSON.stringify(response, null, 2));
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
exports.getBalance = (0, https_1.onCall)({
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 5
}, async () => {
    try {
        console.log('🔍 Balance check started - SOLAPI SDK');
        let balanceData;
        let isRealData = false;
        try {
            console.log('🌐 Attempting to fetch real SOLAPI balance...');
            // Secrets에서 API 키 가져오기
            const apiKey = solapiApiKey.value();
            const apiSecret = solapiApiSecret.value();
            balanceData = await getRealSolapiBalance(apiKey, apiSecret);
            isRealData = true;
            console.log('✅ Real SOLAPI balance retrieved successfully:', JSON.stringify(balanceData, null, 2));
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
            source: isRealData ? 'solapi_api' : 'fallback_dummy',
            version: 'v2_solapi_sendone'
        };
    }
    catch (error) {
        console.error('❌ Balance check failed:', error);
        throw new https_1.HttpsError('internal', `Balance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=getBalance.js.map