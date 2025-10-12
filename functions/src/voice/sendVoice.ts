import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

// 음성 메시지 인터페이스
interface VoiceMessage {
  to: string;
  from: string;
  text: string;
  voiceType: 'MALE' | 'FEMALE';
  headerMessage?: string;
  tailMessage?: string;
  replyRange?: number;
  counselorNumber?: string;
  scheduledDate?: string;
}

export const sendVoice = onCall(
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
        voiceType,
        headerMessage,
        tailMessage,
        replyRange,
        counselorNumber,
        scheduledDate
      } = request.data as VoiceMessage;

      if (!to || !text || !voiceType) {
        throw new HttpsError('invalid-argument', 'to, text, and voiceType are required');
      }

      if (!['MALE', 'FEMALE'].includes(voiceType)) {
        throw new HttpsError('invalid-argument', 'voiceType must be MALE or FEMALE');
      }

      if (replyRange && counselorNumber) {
        throw new HttpsError('invalid-argument', 'replyRange and counselorNumber cannot be used together');
      }

      if (replyRange && (replyRange < 1 || replyRange > 9)) {
        throw new HttpsError('invalid-argument', 'replyRange must be between 1 and 9');
      }

      if (headerMessage && headerMessage.length > 135) {
        throw new HttpsError('invalid-argument', 'headerMessage must be 135 characters or less');
      }

      // SOLAPI 메시지 서비스 초기화
      const messageService = new SolapiMessageService(
        solapiApiKey.value(),
        solapiApiSecret.value()
      );

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

      const messageData: any = {
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

    } catch (error) {
      console.error('❌ 음성 메시지 발송 실패:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Voice service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);