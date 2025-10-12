import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

export const sendSms = onCall(
  {
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10
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
      const { to, text } = request.data;

      if (!to || !text) {
        throw new HttpsError('invalid-argument', 'Both "to" and "text" are required');
      }

      // SOLAPI 메시지 서비스 초기화
      const messageService = new SolapiMessageService(
        solapiApiKey.value(),
        solapiApiSecret.value()
      );

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
        messageId: (result as any)?.messageId || 'unknown',
        message: 'SMS sent successfully',
        version: 'v2_solapi_sendone'
      };

    } catch (error) {
      console.error('❌ SOLAPI 메시지 발송 실패:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `SMS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);