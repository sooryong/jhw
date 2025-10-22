import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

// 알림톡 메시지 인터페이스
interface AlimtalkMessage {
  to: string;
  from: string;
  pfId: string;
  templateId: string;
  variables?: Record<string, string>;
  disableSms?: boolean;
  scheduledDate?: string;
}

export const sendAlimtalk = onCall(
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

    if (userQuery.empty || !userQuery.docs[0].data()?.roles?.includes('admin')) {
      throw new HttpsError('permission-denied', 'Admin role required');
    }

    try {
      const {
        to,
        pfId,
        templateId,
        variables = {},
        disableSms = false,
        scheduledDate
      } = request.data as AlimtalkMessage;

      if (!to || !pfId || !templateId) {
        throw new HttpsError('invalid-argument', 'to, pfId, and templateId are required');
      }

      // SOLAPI 메시지 서비스 초기화
      const messageService = new SolapiMessageService(
        solapiApiKey.value(),
        solapiApiSecret.value()
      );

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

    } catch (error) {
      console.error('❌ 카카오톡 알림톡 발송 실패:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Alimtalk service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);