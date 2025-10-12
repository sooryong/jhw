import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

// RCS 버튼 인터페이스
interface RcsButton {
  buttonType: 'WL' | 'AL' | 'AC' | 'CC' | 'CP' | 'CV' | 'BK';
  buttonName: string;
  link?: string;
  schemeIos?: string;
  schemeAndroid?: string;
  phoneNumber?: string;
}

// RCS 대체 발송 메시지 인터페이스
interface RcsReplacement {
  to: string;
  from: string;
  text: string;
}

// RCS 메시지 인터페이스
interface RcsMessage {
  to: string;
  from: string;
  text: string;
  brandId: string;
  buttons?: RcsButton[];
  replacements?: RcsReplacement[];
  scheduledDate?: string;
}

export const sendRcs = onCall(
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
      const {
        to,
        text,
        brandId,
        buttons = [],
        replacements = [],
        scheduledDate
      } = request.data as RcsMessage;

      if (!to || !text || !brandId) {
        throw new HttpsError('invalid-argument', 'to, text, and brandId are required');
      }

      // SOLAPI 메시지 서비스 초기화
      const messageService = new SolapiMessageService(
        solapiApiKey.value(),
        solapiApiSecret.value()
      );

      console.log('📤 RCS 메시지 발송 시작:', {
        to: to.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3'),
        textLength: text.length,
        brandId,
        hasButtons: buttons.length > 0,
        hasReplacements: replacements.length > 0,
        isScheduled: !!scheduledDate
      });

      const messageData: any = {
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

    } catch (error) {
      console.error('❌ RCS 메시지 발송 실패:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `RCS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);