import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SolapiMessageService } from 'solapi';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Secrets 정의
const solapiApiKey = defineSecret('SOLAPI_API_KEY');
const solapiApiSecret = defineSecret('SOLAPI_API_SECRET');

// 대량 발송용 메시지 인터페이스
interface BulkMessage {
  to: string;
  text: string;
  name?: string;
}

// SOLAPI 클라이언트 초기화
const initSolapi = (apiKey: string, apiSecret: string) => {
  if (!apiKey || !apiSecret) {
    throw new Error('CoolSMS credentials not configured');
  }
  return new SolapiMessageService(apiKey, apiSecret);
};

export const sendBulkSms = onCall(
  {
    secrets: [solapiApiKey, solapiApiSecret],
    region: 'asia-northeast3',
    memory: '512MiB',
    timeoutSeconds: 120,
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

    if (userQuery.empty || !userQuery.docs[0].data()?.roles?.includes('admin')) {
      throw new HttpsError('permission-denied', 'Admin role required');
    }

    try {
      const { messages } = request.data as {
        messages: BulkMessage[];
      };

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new HttpsError('invalid-argument', 'Messages array is required');
      }

      if (messages.length > 10000) {
        throw new HttpsError('invalid-argument', 'Maximum 10,000 messages per request');
      }

      // Secrets에서 API 키 가져오기
      const apiKey = solapiApiKey.value();
      const apiSecret = solapiApiSecret.value();

      const messageService = initSolapi(apiKey, apiSecret);

      console.log('📤 SOLAPI v5.5.2 대량 발송 시작:', {
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      });

      // SOLAPI v5.5.2 Group 방식 사용
      // 1. 그룹 생성
      const group = await messageService.createGroup();

      const groupId = group;
      console.log('✅ 그룹 생성 완료:', groupId);

      // 2. 메시지들을 그룹에 추가
      const solapiMessages = messages.map(msg => {
        const messageType = msg.text.length > 90 ? 'LMS' : 'SMS';
        const messageData: any = {
          to: msg.to,
          from: '01038139885', // 발신번호 (.env에서 설정된 번호)
          text: msg.text,
          type: messageType
        };

        // LMS인 경우 제목 추가
        if (messageType === 'LMS') {
          messageData.subject = msg.text.substring(0, 40) + (msg.text.length > 40 ? '...' : '');
        }

        return messageData;
      });

      const addResult = await messageService.addMessagesToGroup(groupId, solapiMessages);
      console.log('✅ 메시지 그룹 추가 완료:', {
        groupId,
        addResult
      });

      // 3. 그룹 발송
      const sendResult = await messageService.sendGroup(groupId);
      console.log('✅ SOLAPI v5.5.2 대량 발송 완료:', {
        groupId,
        sendResult
      });

      // 4. 발송 이력 저장 (요약)
      await db.collection('smsHistory').add({
        type: 'BULK',
        groupId,
        messageCount: messages.length,
        timestamp: new Date(),
        status: 'sent',
        sendResult,
        createdBy: auth.uid,
        version: 'v5.5.2_bulk'
      });

      return {
        success: true,
        groupId,
        messageCount: messages.length,
        addResult,
        sendResult,
        message: `${messages.length}건의 메시지가 성공적으로 발송되었습니다.`,
        version: 'v2_solapi_5.5.2_bulk'
      };

    } catch (error) {
      console.error('❌ 대량 SMS 발송 실패:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Bulk SMS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);