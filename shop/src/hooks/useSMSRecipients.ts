/**
 * 파일 경로: /src/hooks/useSMSRecipients.ts
 * 주요 내용: SMS 수신자 관리를 위한 React Hook
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllRecipients,
  addRecipient,
  updateRecipient,
  deleteRecipient,
  getRecipientsByCompany,
  getRecipientsByType,
  searchRecipients,
  getRecipientsCount,
  type SMSRecipient,
  type AddRecipientRequest,
  type UpdateRecipientRequest
} from '../services/smsRecipientService';

interface UseSMSRecipientsOptions {
  autoLoad?: boolean;
  companyId?: string;
  customerType?: string;
}

interface UseSMSRecipientsReturn {
  recipients: SMSRecipient[];
  loading: boolean;
  error: string | null;
  count: number;

  // CRUD 작업
  addNewRecipient: (recipientData: AddRecipientRequest) => Promise<void>;
  updateExistingRecipient: (updateData: UpdateRecipientRequest) => Promise<void>;
  removeRecipient: (recipientId: string) => Promise<void>;

  // 조회 작업
  loadAllRecipients: () => Promise<void>;
  loadRecipientsByCompany: (companyId: string) => Promise<void>;
  loadRecipientsByType: (customerType: string) => Promise<void>;
  searchRecipientsBy: (searchTerm: string) => Promise<void>;
  refreshCount: () => Promise<void>;

  // 유틸리티
  clearError: () => void;
  refresh: () => Promise<void>;
}

export const useSMSRecipients = (options: UseSMSRecipientsOptions = {}): UseSMSRecipientsReturn => {
  const { autoLoad = true, companyId, customerType } = options;

  const [recipients, setRecipients] = useState<SMSRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  // 에러 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 수신자 수 조회
  const refreshCount = useCallback(async () => {
    try {
      const currentCount = await getRecipientsCount();
      setCount(currentCount);
    } catch {
      // 오류 처리: 수신자 수 조회 실패
    }
  }, []);

  // 전체 수신자 로드
  const loadAllRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllRecipients();
      setRecipients(data);
      await refreshCount();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수신자 목록을 불러올 수 없습니다.';
      setError(errorMessage);
      // 오류 처리: 수신자 로드 실패
    } finally {
      setLoading(false);
    }
  }, [refreshCount]);

  // 회사별 수신자 로드
  const loadRecipientsByCompany = useCallback(async (companyId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRecipientsByCompany(companyId);
      setRecipients(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '회사별 수신자 목록을 불러올 수 없습니다.';
      setError(errorMessage);
      // 오류 처리: 회사별 수신자 로드 실패
    } finally {
      setLoading(false);
    }
  }, []);

  // 고객 유형별 수신자 로드
  const loadRecipientsByType = useCallback(async (customerType: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRecipientsByType(customerType);
      setRecipients(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '고객 유형별 수신자 목록을 불러올 수 없습니다.';
      setError(errorMessage);
      // 오류 처리: 고객 유형별 수신자 로드 실패
    } finally {
      setLoading(false);
    }
  }, []);

  // 수신자 검색
  const searchRecipientsBy = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      await loadAllRecipients();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await searchRecipients(searchTerm);
      setRecipients(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수신자 검색에 실패했습니다.';
      setError(errorMessage);
      // 오류 처리: 수신자 검색 실패
    } finally {
      setLoading(false);
    }
  }, [loadAllRecipients]);

  // 새 수신자 추가
  const addNewRecipient = useCallback(async (recipientData: AddRecipientRequest) => {
    setError(null);

    try {
      await addRecipient(recipientData);
      await loadAllRecipients(); // 목록 새로고침
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수신자 추가에 실패했습니다.';
      setError(errorMessage);
      throw err;
    }
  }, [loadAllRecipients]);

  // 수신자 정보 수정
  const updateExistingRecipient = useCallback(async (updateData: UpdateRecipientRequest) => {
    setError(null);

    try {
      await updateRecipient(updateData);
      await loadAllRecipients(); // 목록 새로고침
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수신자 정보 수정에 실패했습니다.';
      setError(errorMessage);
      throw err;
    }
  }, [loadAllRecipients]);

  // 수신자 삭제
  const removeRecipient = useCallback(async (recipientId: string) => {
    setError(null);

    try {
      await deleteRecipient(recipientId);
      await loadAllRecipients(); // 목록 새로고침
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수신자 삭제에 실패했습니다.';
      setError(errorMessage);
      throw err;
    }
  }, [loadAllRecipients]);

  // 데이터 새로고침
  const refresh = useCallback(async () => {
    if (companyId) {
      await loadRecipientsByCompany(companyId);
    } else if (customerType) {
      await loadRecipientsByType(customerType);
    } else {
      await loadAllRecipients();
    }
  }, [companyId, customerType, loadAllRecipients, loadRecipientsByCompany, loadRecipientsByType]);

  // 초기 데이터 로드
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  return {
    recipients,
    loading,
    error,
    count,

    // CRUD 작업
    addNewRecipient,
    updateExistingRecipient,
    removeRecipient,

    // 조회 작업
    loadAllRecipients,
    loadRecipientsByCompany,
    loadRecipientsByType,
    searchRecipientsBy,
    refreshCount,

    // 유틸리티
    clearError,
    refresh
  };
};

export default useSMSRecipients;