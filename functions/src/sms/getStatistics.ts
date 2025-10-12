import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

// SOLAPI 클라이언트 초기화
const initSolapi = (apiKey: string, apiSecret: string) => {
  if (!apiKey || !apiSecret) {
    throw new Error('CoolSMS credentials not configured');
  }
  return new SolapiMessageService(apiKey, apiSecret);
};

export const getStatistics = onCall(
  {
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 5
  },
  async (request) => {
    const { auth } = request;

    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // 사용자 권한 확인 (authUid 필드로 쿼리)
    const userQuery = await db.collection('users')
      .where('authUid', '==', auth.uid)
      .limit(1)
      .get();

    if (userQuery.empty || userQuery.docs[0].data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin role required');
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
          count: messages.messageList?.length || 0,
          messages: messages.messageList || []
        },
        timestamp: new Date().toISOString(),
        version: 'v2_solapi_5.5.2_statistics'
      };

    } catch (error) {
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

      } catch (fallbackError) {
        console.error('❌ Fallback 통계도 실패:', fallbackError);
        throw new HttpsError('internal', `Statistics service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
);