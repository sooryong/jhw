/**
 * 파일 경로: /src/hooks/useSms.ts
 * 주요 내용: SMS 관련 React 훅 - 상태 관리 및 함수 제공 (TypeScript 버전)
 * 관련 데이터: smsService와 연동
 */

import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import smsService from '../services/smsService';
import type { SMSBalance } from '../types/sms';

interface Recipient {
  phone: string;
  name?: string;
}

// SMS 수신자 타입 (원래 SMSRecipient와 동일)
interface SMSRecipient {
  phoneNumber: string;
  name?: string;
  customerType?: string;
}

interface SendMessageOptions {
  messageType?: string;
  [key: string]: string | number | boolean | undefined;
}

export const useSms = () => {
  const { enqueueSnackbar } = useSnackbar();

  // Dialog 관련 상태 (기존 useSMS와 호환)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogProps, setDialogProps] = useState<{
    recipients?: SMSRecipient[];
    message?: string;
    title?: string;
    onSuccess?: (messageId: string) => void;
  }>({});

  // 상태 관리
  const [balance, setBalance] = useState<SMSBalance | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({
    today: { total: 0, success: 0, failed: 0 },
    month: { total: 0, success: 0, failed: 0 },
    total: { all: 0, success: 0, failed: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Dialog 관련 함수 (기존 useSMS와 호환)
  const openSMSDialog = useCallback((props?: {
    recipients?: SMSRecipient[];
    message?: string;
    title?: string;
    onSuccess?: (messageId: string) => void;
  }) => {
    setDialogProps(props || {});
    setIsDialogOpen(true);
  }, []);

  const closeSMSDialog = useCallback(() => {
    setIsDialogOpen(false);
    setDialogProps({});
  }, []);

  /**
   * 발송 이력 조회
   */
  const refreshHistory = useCallback(async (filters: Record<string, unknown> = {}, limit: number = 50) => {
    setHistoryLoading(true);
    try {
      const data = await smsService.getSmsHistory(filters, limit);
      setHistory(data);
      return data;
    } catch (error) {
      // Error handled silently
      enqueueSnackbar('발송 이력을 불러올 수 없습니다', { variant: 'error' });
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [enqueueSnackbar]);

  /**
   * 발송 통계 조회
   */
  const refreshStats = useCallback(async () => {
    try {
      const data = await smsService.getSmsStats();
      setStats(data);
      return data;
    } catch (error) {
      // Error handled silently
      return {
        today: { total: 0, success: 0, failed: 0 },
        month: { total: 0, success: 0, failed: 0 },
        total: { all: 0, success: 0, failed: 0 }
      };
    }
  }, []);

  /**
   * 잔액 조회
   */
  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const result = await smsService.getBalance();
      setBalance(result);
      return result;
    } catch (error) {
      // Error handled silently
      console.error('Failed to load balance:', error);
      enqueueSnackbar('잔액 정보를 불러올 수 없습니다', { variant: 'error' });
      return null;
    } finally {
      setBalanceLoading(false);
    }
  }, [enqueueSnackbar]);



  /**
   * 메시지 발송
   */
  const sendMessage = useCallback(async (
    message: string,
    recipients: Recipient[],
    options: SendMessageOptions = {}
  ) => {
    if (!message?.trim()) {
      enqueueSnackbar('메시지를 입력해주세요', { variant: 'warning' });
      return { success: false, message: '메시지가 비어있습니다' };
    }

    if (!recipients || recipients.length === 0) {
      enqueueSnackbar('수신자를 선택해주세요', { variant: 'warning' });
      return { success: false, message: '수신자가 없습니다' };
    }

    setLoading(true);
    try {
      const result = await smsService.sendMessage(message, recipients, options);

      if (result.success) {
        enqueueSnackbar(result.message, { variant: 'success' });
      } else {
        enqueueSnackbar(result.message || '발송에 실패했습니다', { variant: 'error' });
      }

      // 발송 성공/실패와 관계없이 발송 시도 후 잔액, 이력, 통계 새로고침
      await Promise.all([
        refreshBalance(),
        refreshHistory(),
        refreshStats()
      ]);

      return result;
    } catch (error) {
      // Error handled silently
      const errorMessage = error instanceof Error ? error.message : '메시지 발송 중 오류가 발생했습니다';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, refreshBalance, refreshHistory, refreshStats]);

  /**
   * 메시지 정보 조회
   */
  const getMessageInfo = (text: string) => {
    return smsService.getMessageInfo(text);
  };

  /**
   * 빠른 발송 (단일 수신자)
   */
  const sendQuickMessage = useCallback(async (
    phone: string,
    message: string,
    recipientName: string = '고객'
  ) => {
    const recipients = [{ phone, name: recipientName }];
    return await sendMessage(message, recipients, {
      messageType: 'quick_send'
    });
  }, [sendMessage]);

  /**
   * 테스트 발송
   */
  const sendTestMessage = useCallback(async (
    phone: string,
    message: string = '테스트 메시지입니다.'
  ) => {
    const recipients = [{ phone, name: '테스트' }];
    return await sendMessage(message, recipients, {
      messageType: 'test'
    });
  }, [sendMessage]);

  // 기존 useSMS와 호환성을 위한 함수들
  const sendQuickSMS = useCallback(async (
    phoneNumber: string | string[],
    message: string,
    onSuccess?: (messageId: string) => void
  ) => {
    const phones = Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber];
    const recipients = phones.map(phone => ({ phone, name: '고객' }));

    const result = await sendMessage(message, recipients, { messageType: 'quick_send' });

    if (result.success && onSuccess) {
      onSuccess('success'); // messageId 대신 success 전달
    }

    return {
      success: result.success,
      messageId: result.success ? 'success' : undefined,
      error: result.success ? undefined : result.message
    };
  }, [sendMessage]);

  const sendOrderConfirmationSMS = useCallback(async (
    phoneNumber: string,
    customerName: string,
    orderNumber: string,
    onSuccess?: (messageId: string) => void
  ) => {
    const message = `[JWS] ${customerName}님, 주문이 확인되었습니다. 주문번호: ${orderNumber}. 빠른 처리를 위해 노력하겠습니다.`;
    return await sendQuickSMS(phoneNumber, message, onSuccess);
  }, [sendQuickSMS]);

  const sendShippingNotificationSMS = useCallback(async (
    phoneNumber: string,
    customerName: string,
    trackingNumber: string,
    onSuccess?: (messageId: string) => void
  ) => {
    const message = `[JWS] ${customerName}님, 상품이 출하되었습니다. 운송장번호: ${trackingNumber}. 배송조회는 택배사 홈페이지에서 확인하세요.`;
    return await sendQuickSMS(phoneNumber, message, onSuccess);
  }, [sendQuickSMS]);

  const sendPaymentConfirmationSMS = useCallback(async (
    phoneNumber: string,
    customerName: string,
    amount: number,
    onSuccess?: (messageId: string) => void
  ) => {
    const message = `[JWS] ${customerName}님, 결제가 완료되었습니다. 결제금액: ${amount.toLocaleString()}원. 이용해 주셔서 감사합니다.`;
    return await sendQuickSMS(phoneNumber, message, onSuccess);
  }, [sendQuickSMS]);

  /**
   * 초기 데이터 로드 - 개발 환경에서는 인증 없이도 실행
   */
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        refreshBalance(),
        refreshHistory(),
        refreshStats()
      ]);
    };

    loadInitialData();
  }, [refreshBalance, refreshHistory, refreshStats]); // user 의존성 제거


  /**
   * 이력 필터링 헬퍼
   */
  const getFilteredHistory = useCallback((filterType: string) => {
    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();

    switch (filterType) {
      case 'today':
        return history.filter(h =>
          h.createdAt && new Date(h.createdAt as string | number | Date).toDateString() === today
        );
      case 'month':
        return history.filter(h =>
          h.createdAt && new Date(h.createdAt as string | number | Date).getMonth() === thisMonth
        );
      case 'success':
        return history.filter(h => h.status === 'sent');
      case 'failed':
        return history.filter(h => h.status === 'failed');
      default:
        return history;
    }
  }, [history]);

  /**
   * 잔액 부족 체크 (포인트 + 현금 + 메인 잔액 고려)
   */
  const checkBalance = useCallback((messageInfo: { cost: number }, recipientCount: number = 1) => {
    if (!balance) {
      return { sufficient: true, warning: true, message: '잔액 정보를 확인할 수 없습니다' };
    }

    const requiredPoints = messageInfo.cost * recipientCount;
    const totalBalance = balance.balance || 0;

    // 잔액이 충분한 경우
    if (totalBalance >= requiredPoints) {
      return { sufficient: true };
    }

    // 모든 잔액이 부족한 경우
    return {
      sufficient: false,
      message: `잔액이 부족합니다 (필요: ${requiredPoints}P, 보유 잔액: ${totalBalance}원)`
    };
  }, [balance]);

  return {
    // Dialog 관련 (기존 useSMS 호환)
    isDialogOpen,
    openSMSDialog,
    closeSMSDialog,
    dialogProps,

    // SMS 발송 관련 (기존 useSMS 호환)
    sendQuickSMS,
    sendOrderConfirmationSMS,
    sendShippingNotificationSMS,
    sendPaymentConfirmationSMS,

    // 상태
    balance,
    history,
    stats,
    loading,
    balanceLoading,
    historyLoading,

    // 주요 함수
    sendMessage,
    sendQuickMessage,
    sendTestMessage,

    // 조회 함수
    refreshBalance,
    refreshHistory,
    refreshStats,

    // 유틸리티 함수
    getMessageInfo,
    getFilteredHistory,
    checkBalance,

    // 상수
    SMS_CONFIG: smsService.SMS_CONFIG
  };
};

export default useSms;