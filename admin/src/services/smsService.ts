/**
 * 파일 경로: /src/services/smsService.ts
 * 업데이트: 2025-09-29 (번호 정규화 규칙 적용)
 * 주요 내용: SMS 발송 서비스 - CoolSMS 기반 메시징 (TypeScript 버전)
 * 관련 데이터: smsHistory 컬렉션
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type {
  SMSType
} from '../types/sms';
import {
  normalizeNumber,
  formatMobile,
  isValidMobile
} from '../utils/numberUtils';
import type {
  NormalizedMobile,
  FormattedMobile
} from '../types/phoneNumber';

// 임시로 여기서 SMSBalance 타입 정의
interface SMSBalance {
  balance: number;
  currency: string;
  lastUpdated: Date;
  point?: number;
  cash?: number;
}

// SMS 발송 이력 타입 (저장용 - 정규화된 번호)
interface SMSHistoryData {
  to: NormalizedMobile; // 정규화된 휴대폰번호로 저장
  text: string;
  type: string;
  bytes: number;
  units: number;
  cost: number;
  status: 'sent' | 'failed' | 'pending';
  messageId?: string;
  timestamp: Date | ReturnType<typeof serverTimestamp>;
  error?: string;
  recipientName?: string;
  totalPages?: number;
  messageIds?: string[];
  failureReason?: string | null;
  messageType?: string;
}

// SMS 설정 상수
const SMS_CONFIG = {
  MAX_SMS_LENGTH: 90,           // SMS 최대 길이 (바이트)
  MAX_LMS_LENGTH: 2000,         // LMS 최대 길이 (바이트)
  SEND_INTERVAL: 500,           // 순차 발송 간격 (ms)
  RETRY_COUNT: 3,               // 재시도 횟수
};

// Cloud Functions 연결 - SOLAPI v5.5.2 Enhanced
const sendSmsFunction = httpsCallable(functions, 'sendSms');
const getBalanceFunction = httpsCallable(functions, 'getBalance');
const sendBulkSmsFunction = httpsCallable(functions, 'sendBulkSms');
const getStatisticsFunction = httpsCallable(functions, 'getStatistics');
// const checkSmsHealthFunction = httpsCallable(functions, 'checkSmsHealth'); // TODO: 구현 필요

// 메시지 바이트 길이 계산
const getByteLength = (text: string): number => {
  return new Blob([text]).size;
};

// 메시지 타입 자동 판단
const getMessageType = (text: string): SMSType => {
  const bytes = getByteLength(text);
  if (bytes <= SMS_CONFIG.MAX_SMS_LENGTH) return 'SMS';
  if (bytes <= SMS_CONFIG.MAX_LMS_LENGTH) return 'LMS';
  return 'MMS';
};

// 완전히 안전한 LMS 페이지 분할 함수 (temporal dead zone 회피)
const splitMessageIntoPages = (inputText: string): string[] => {
  // 모든 변수를 함수 시작 시점에 즉시 초기화
  const safeText = String(inputText || '');
  const maxByteLength = SMS_CONFIG.MAX_LMS_LENGTH;
  const resultPages: string[] = [];
  const maxSafeIterations = 50;

  try {
    // 입력 검증
    if (!safeText || safeText.length === 0) {
      return [''];
    }

    // 단일 페이지로 충분한 경우
    if (getByteLength(safeText) <= maxByteLength) {
      return [safeText];
    }

    // 페이지 분할 로직
    let textToProcess = safeText;
    let iterationCount = 0;

    while (textToProcess.length > 0 && iterationCount < maxSafeIterations) {
      iterationCount++;

      // 현재 남은 텍스트가 한 페이지에 맞는 경우
      if (getByteLength(textToProcess) <= maxByteLength) {
        resultPages.push(textToProcess);
        break;
      }

      // 분할점 찾기
      let cutPosition = Math.min(textToProcess.length, Math.floor(maxByteLength * 0.8));

      // 바이트 크기 조정
      while (cutPosition > 0 && getByteLength(textToProcess.substring(0, cutPosition)) > maxByteLength) {
        cutPosition--;
      }

      // 최소 1글자는 진행
      if (cutPosition === 0) {
        cutPosition = 1;
      }

      // 문장 끝에서 분할 시도
      const searchBackRange = Math.max(0, cutPosition - 30);
      for (let pos = cutPosition; pos >= searchBackRange; pos--) {
        const character = textToProcess[pos];
        if (character === '.' || character === '!' || character === '?' || character === '\n') {
          cutPosition = pos + 1;
          break;
        }
      }

      // 현재 페이지 추출
      const extractedPageContent = textToProcess.substring(0, cutPosition).trim();
      if (extractedPageContent.length > 0) {
        resultPages.push(extractedPageContent);
      }

      // 다음 페이지를 위한 텍스트 준비
      textToProcess = textToProcess.substring(cutPosition).trim();
    }

    return resultPages.length > 0 ? resultPages : [safeText];

  } catch (error) {
      // Error handled silently
    return [safeText];
  }
};

// 완전히 안전한 메시지 정보 조회 함수
export const getMessageInfo = (inputText: string) => {
  // 모든 변수를 즉시 초기화하여 temporal dead zone 회피
  const fallbackResult = {
    bytes: 0,
    type: 'SMS' as SMSType,
    pages: 1,
    pageContent: [''],
    cost: 1
  };

  try {
    // 입력 검증
    if (!inputText || typeof inputText !== 'string' || inputText.length === 0) {
      return fallbackResult;
    }

    // 안전한 변수 선언
    const messageText = String(inputText); // 확실히 문자열로 변환
    const messageBytes = getByteLength(messageText);
    const messageType = getMessageType(messageText);

    // 결과 객체 생성
    const result = {
      bytes: messageBytes,
      type: messageType,
      pages: 1,
      pageContent: [messageText],
      cost: 1
    };

    // 타입별 비용 계산
    if (messageType === 'SMS') {
      result.cost = 1;
    } else if (messageType === 'LMS') {
      // Re-enable safe page splitting with proper initialization
      const splitPages = splitMessageIntoPages(messageText);
      result.pageContent = splitPages;
      result.pages = splitPages.length;
      result.cost = splitPages.length * 4;
    } else {
      // Re-enable page splitting for MMS too
      const splitPages = splitMessageIntoPages(messageText);
      result.pageContent = splitPages;
      result.pages = splitPages.length;
      result.cost = splitPages.length * 4;
    }

    return result;

  } catch (error) {
      // Error handled silently
    return fallbackResult;
  }
};

// 수신자 정보 (입력용 - 문자열 허용)
interface RecipientInput {
  phone: string; // 입력 시에는 문자열로 받아서 정규화
  name?: string;
}

// 수신자 정보 (처리용 - 정규화된 번호)
interface RecipientProcessed {
  phone: NormalizedMobile; // 정규화된 휴대폰번호
  name?: string;
}

// 대량 발송용 메시지 인터페이스
interface BulkMessage {
  to: string;
  text: string;
  name?: string;
}

// 통계 데이터 타입
interface SMSStatistics {
  success: boolean;
  statistics: Record<string, unknown>;
  recentMessages?: {
    count: number;
    messages: Record<string, unknown>[];
  };
  timestamp: string;
  version: string;
  fallback?: boolean;
}

interface SendMessageOptions {
  messageType?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * 핵심 메시지 발송 함수
 * @param messageContent - 발송할 메시지
 * @param recipients - 수신자 배열 [{phone, name}]
 * @param options - 추가 옵션
 * @returns 발송 결과
 */
export const sendMessage = async (
  messageContent: string,
  recipients: RecipientInput[],
  options: SendMessageOptions = {}
) => {
  try {
    if (!messageContent?.trim()) {
      throw new Error('메시지가 비어있습니다');
    }

    if (!recipients || recipients.length === 0) {
      throw new Error('수신자가 없습니다');
    }

    // 수신자 번호 정규화 및 검증
    const processedRecipients: RecipientProcessed[] = [];
    for (const recipient of recipients) {
      const normalizedPhone = normalizeNumber(recipient.phone) as NormalizedMobile;
      if (!isValidMobile(normalizedPhone)) {
        throw new Error(`올바르지 않은 휴대폰번호입니다: ${recipient.phone}`);
      }
      processedRecipients.push({
        phone: normalizedPhone,
        name: recipient.name
      });
    }

    const messageInfo = getMessageInfo(messageContent);
    const results = [];

    // 각 수신자에게 발송
    for (let i = 0; i < processedRecipients.length; i++) {
      const recipient = processedRecipients[i];

      try {
        let totalSuccess = 0;
        let totalFailed = 0;
        const allMessageIds: string[] = [];
        const pageResults: Array<{ success: boolean; messageId?: string; error?: string }> = [];

        // 안전한 페이지 발송 처리 (모든 변수 즉시 초기화)
        const messagePagesToSend = messageInfo.pageContent || [messageContent];
        const totalPagesToSend = messagePagesToSend.length;

        // 각 페이지를 순차적으로 발송
        for (let pageIdx = 0; pageIdx < totalPagesToSend; pageIdx++) {
          try {
            // 페이지별 변수를 블록 스코프에서 즉시 초기화
            const pageTextContent = String(messagePagesToSend[pageIdx] || '');
            const currentPageNum = pageIdx + 1;
            const totalPageCount = totalPagesToSend;

            // 페이지 헤더 생성
            const headerText = totalPageCount > 1 ? `[${currentPageNum}/${totalPageCount}] ` : '';
            const finalMessageText = headerText + pageTextContent;

            // 페이지 간 발송 간격
            if (pageIdx > 0) {
              await new Promise(resolve => setTimeout(resolve, SMS_CONFIG.SEND_INTERVAL));
            }

            // SOLAPI v5.5.2 Enhanced SMS 발송 실행
            const smsResult = await sendSmsFunction({
              to: recipient.phone,
              text: finalMessageText, // 'message' → 'text'로 변경 (SOLAPI v5.5.2 규격)
              from: options.from || undefined
            });

            // 결과 처리
            const smsData = smsResult.data as { success: boolean; messageId?: string };
            if (smsData.success) {
              totalSuccess++;
              if (smsData.messageId) {
                allMessageIds.push(smsData.messageId);
              }
            } else {
              totalFailed++;
            }

          } catch (error) {
      // Error handled silently
            totalFailed++;
          }
        }

        const overallSuccess = totalSuccess > 0 && totalFailed === 0;

        results.push({
          recipient,
          success: overallSuccess,
          totalPages: totalPagesToSend,
          pagesSuccess: totalSuccess,
          pagesFailed: totalFailed,
          messageIds: allMessageIds,
          pageResults,
          cost: messageInfo.cost
        });

        // 발송 이력 저장 (전체 메시지로) - 정규화된 번호로 저장
        await saveSmsHistory({
          to: recipient.phone, // 이미 정규화된 번호
          text: messageContent,
          type: messageInfo.type,
          bytes: messageInfo.bytes,
          units: messageInfo.pages,
          cost: messageInfo.cost,
          recipientName: recipient.name || '고객',
          status: overallSuccess ? 'sent' : 'failed',
          messageIds: allMessageIds,
          totalPages: totalPagesToSend,
          failureReason: overallSuccess ? null : `${totalFailed}/${totalPagesToSend} 페이지 실패`,
          messageType: options.messageType || 'manual',
          timestamp: serverTimestamp()
        });

      } catch (err) {

        results.push({
          recipient,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });

        // 실패 이력 저장 - 정규화된 번호로 저장
        await saveSmsHistory({
          to: recipient.phone, // 이미 정규화된 번호
          text: messageContent,
          type: messageInfo.type,
          bytes: messageInfo.bytes,
          units: messageInfo.pages,
          cost: messageInfo.cost,
          recipientName: recipient.name || '고객',
          status: 'failed',
          failureReason: err instanceof Error ? err.message : 'Unknown error',
          messageType: options.messageType || 'manual',
          timestamp: serverTimestamp()
        });
      }

      // 순차 발송 간격 (마지막 수신자 제외)
      if (i < processedRecipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, SMS_CONFIG.SEND_INTERVAL));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalPages = results.reduce((sum, r) => sum + (r.totalPages || 1), 0);
    const totalPagesSent = results.reduce((sum, r) => sum + (r.pagesSuccess || (r.success ? 1 : 0)), 0);

    let message = `메시지 발송 완료 (성공: ${successCount}명, 실패: ${processedRecipients.length - successCount}명)`;
    if (messageInfo.pages > 1) {
      message += ` - 총 ${totalPagesSent}/${totalPages} 페이지 발송`;
    }

    return {
      success: successCount > 0,
      message,
      totalRecipients: processedRecipients.length,
      successCount,
      failureCount: processedRecipients.length - successCount,
      totalPages,
      totalPagesSent,
      results,
      messageInfo
    };

  } catch (err) {
    throw new Error(err instanceof Error ? err.message : '메시지 발송 중 오류가 발생했습니다');
  }
};

/**
 * SMS 발송 이력 저장
 */
const saveSmsHistory = async (historyData: SMSHistoryData) => {
  try {
    await addDoc(collection(db, 'smsHistory'), {
      ...historyData,
      createdAt: serverTimestamp()
    });
  } catch (error) {
      // Error handled silently
    // 이력 저장 실패는 메인 기능에 영향을 주지 않으므로 무시
  }
};

/**
 * SMS 발송 이력 조회
 */
export const getSmsHistory = async (filters: Record<string, unknown> = {}, limitCount: number = 50) => {
  try {
    let q = query(
      collection(db, 'smsHistory'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    // 필터 적용
    if (filters.status) {
      q = query(
        collection(db, 'smsHistory'),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    if (filters.messageType) {
      q = query(
        collection(db, 'smsHistory'),
        where('messageType', '==', filters.messageType),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    if (filters.recipientName) {
      q = query(
        collection(db, 'smsHistory'),
        where('recipientName', '==', filters.recipientName),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // 표시용으로 휴대폰번호 포맷팅
        to: data.to ? formatMobile(data.to as NormalizedMobile) : data.to,
        createdAt: data.createdAt?.toDate()
      };
    });

    // 데이터가 없으면 테스트 데이터 반환 (개발 중)
    if (results.length === 0) {
      return generateTestSmsHistory();
    }

    return results;
  } catch (error) {
      // Error handled silently
    // 오류 시 테스트 데이터 반환
    return generateTestSmsHistory();
  }
};

/**
 * 테스트용 SMS 발송 이력 데이터 생성
 */
const generateTestSmsHistory = () => {
  const testData = [];
  const now = new Date();

  for (let i = 0; i < 10; i++) {
    const pastDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // i일 전
    testData.push({
      id: `test-${i}`,
      to: `010-1234-567${i}`, // 테스트 데이터는 이미 포맷된 형태로 표시
      text: `테스트 메시지 ${i + 1}`,
      type: 'SMS',
      bytes: 50 + i,
      units: 1,
      cost: 20,
      status: i % 3 === 0 ? 'failed' : 'sent',
      messageId: `test-msg-${i}`,
      timestamp: pastDate,
      createdAt: pastDate,
      error: i % 3 === 0 ? '발송 실패' : undefined
    });
  }

  return testData;
};

/**
 * CoolSMS 잔액 조회
 */
export const getBalance = async (): Promise<SMSBalance> => {
  try {
    const result = await getBalanceFunction();
    const resultData = result.data as {
      success: boolean;
      balance?: Record<string, unknown>; // SOLAPI API 응답 구조
      timestamp?: string;
      source?: string;
      error?: string;
    };

    if (!resultData.success) {
      throw new Error(resultData.error || '잔액 조회 실패');
    }


    let point = 0;
    let cash = 0;
    let totalBalance = 0;

    if (resultData.balance) {
      // SOLAPI API의 실제 응답 구조 처리
      if (typeof resultData.balance === 'number') {
        // 단순 숫자인 경우 (예: balance: 8383)
        totalBalance = resultData.balance;
        point = resultData.balance; // 전체를 포인트로 간주
        cash = 0;
      } else if (typeof resultData.balance === 'object') {
        // 객체인 경우 다양한 필드 확인
        if ((resultData.balance as unknown).balance !== undefined) {
          totalBalance = (resultData.balance as unknown).balance || 0;
        }
        point = (resultData.balance as unknown).point || 0;
        cash = (resultData.balance as unknown).cash || 0;

        // 총 잔액이 0이고 point나 cash가 있으면 합계로 계산
        if (totalBalance === 0 && (point > 0 || cash > 0)) {
          totalBalance = point + cash;
        }
      }
    }

    const balanceData = {
      balance: totalBalance,
      currency: 'KRW',
      lastUpdated: new Date(),
      point: point,
      cash: cash
    };

    return balanceData;

  } catch (error) {
      // Error handled silently

    // 개발 중일 때는 더미 데이터 반환 (환경변수가 설정되지 않은 경우)
    if (error instanceof Error && error.message.includes('credentials not configured')) {
      return {
        balance: 55000, // point(5000) + cash(50000)
        currency: 'KRW',
        lastUpdated: new Date(),
        point: 5000,
        cash: 50000
      };
    }

    throw new Error('잔액 정보를 불러올 수 없습니다');
  }
};

/**
 * SOLAPI v5.5.2 대량 발송 기능
 */
export const sendBulkSms = async (messages: BulkMessage[]) => {
  try {
    if (!messages || messages.length === 0) {
      throw new Error('발송할 메시지가 없습니다');
    }

    if (messages.length > 10000) {
      throw new Error('최대 10,000건까지 발송 가능합니다');
    }

    // 번호 정규화 및 검증
    const processedMessages = messages.map(msg => {
      const normalizedPhone = normalizeNumber(msg.to) as NormalizedMobile;
      if (!isValidMobile(normalizedPhone)) {
        throw new Error(`올바르지 않은 휴대폰번호입니다: ${msg.to}`);
      }
      return {
        ...msg,
        to: normalizedPhone
      };
    });

    const result = await sendBulkSmsFunction({ messages: processedMessages });
    const resultData = result.data as {
      success: boolean;
      groupId: string;
      messageCount: number;
      message: string;
      error?: string;
    };

    if (!resultData.success) {
      throw new Error(resultData.error || '대량 발송 실패');
    }

    return {
      success: true,
      groupId: resultData.groupId,
      messageCount: resultData.messageCount,
      message: resultData.message
    };

  } catch (error) {
      // Error handled silently
    throw new Error(error instanceof Error ? error.message : '대량 발송 중 오류가 발생했습니다');
  }
};

/**
 * SOLAPI v5.5.2 실시간 통계 조회
 */
export const getSolapiStatistics = async (): Promise<SMSStatistics> => {
  try {
    const result = await getStatisticsFunction();
    const resultData = result.data as SMSStatistics;

    if (!resultData.success) {
      throw new Error('통계 조회 실패');
    }

    return resultData;

  } catch (error) {
      // Error handled silently
    throw new Error(error instanceof Error ? error.message : '통계 조회 중 오류가 발생했습니다');
  }
};

/**
 * 발송 통계 조회 (기존 로컬 데이터 기반)
 */
export const getSmsStats = async () => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 전체 이력 조회 (최근 1000건)
    const history = await getSmsHistory({}, 1000);

    // 오늘 발송
    const todayHistory = (history as unknown[]).filter((h:unknown) =>
      h.createdAt && h.createdAt >= todayStart
    );

    // 이번 달 발송
    const monthHistory = (history as unknown[]).filter((h:unknown) =>
      h.createdAt && h.createdAt >= monthStart
    );

    return {
      today: {
        total: todayHistory.length,
        success: (todayHistory as unknown[]).filter((h:unknown) => h.status === 'sent').length,
        failed: (todayHistory as unknown[]).filter((h:unknown) => h.status === 'failed').length
      },
      month: {
        total: monthHistory.length,
        success: (monthHistory as unknown[]).filter((h:unknown) => h.status === 'sent').length,
        failed: (monthHistory as unknown[]).filter((h:unknown) => h.status === 'failed').length
      },
      total: {
        all: history.length,
        success: (history as unknown[]).filter((h:unknown) => h.status === 'sent').length,
        failed: (history as unknown[]).filter((h:unknown) => h.status === 'failed').length
      }
    };
  } catch (error) {
      // Error handled silently
    return {
      today: { total: 0, success: 0, failed: 0 },
      month: { total: 0, success: 0, failed: 0 },
      total: { all: 0, success: 0, failed: 0 }
    };
  }
};

/**
 * SMS 서비스 상태 확인
 */
export const checkServiceStatus = async (): Promise<boolean> => {
  try {
    // TODO: checkSmsHealth 함수 구현 후 활성화
    // const result = await checkSmsHealthFunction();
    // const resultData = result.data as { success?: boolean };
    // return resultData.success || false;

    // 임시로 true 반환 (기본 Functions가 배포되어 있으므로)
    return true;
  } catch (error) {
      // Error handled silently
    return false;
  }
};



// 유틸리티 함수들
export const determineMessageType = (message: string): SMSType => {
  return getMessageType(message);
};

// 휴대폰번호 정규화 (numberUtils 사용)
export const formatPhoneNumber = (phoneNumber: string): NormalizedMobile => {
  return normalizeNumber(phoneNumber) as NormalizedMobile;
};

// 휴대폰번호 포맷팅 (표시용)
export const formatPhoneNumberForDisplay = (phoneNumber: string): FormattedMobile => {
  const normalized = normalizeNumber(phoneNumber) as NormalizedMobile;
  return formatMobile(normalized);
};

// 휴대폰번호 유효성 검사 (numberUtils 사용)
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const normalized = normalizeNumber(phoneNumber) as NormalizedMobile;
  return isValidMobile(normalized);
};

// 기본 export - SOLAPI v5.5.2 Enhanced
export default {
  sendMessage,
  sendBulkSms,
  getSmsHistory,
  getBalance,
  getSmsStats,
  getSolapiStatistics,
  getMessageInfo,
  getByteLength,
  getMessageType,
  checkServiceStatus,
  determineMessageType,
  formatPhoneNumber,
  formatPhoneNumberForDisplay,
  validatePhoneNumber,
  SMS_CONFIG
};