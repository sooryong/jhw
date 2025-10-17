/**
 * 파일 경로: /src/contexts/CustomerContext.tsx
 * 작성 날짜: 2025-10-02
 * 주요 내용: 쇼핑몰 고객사 컨텍스트 - 중복 조회 방지
 * 관련 데이터: 현재 선택된 고객사 정보
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Customer, FavoriteProduct } from '../types/company';
import { getCustomer } from '../services/customerService';
import { useAuth } from './AuthContext';

interface CustomerContextType {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
  updateFavorites: (favorites: FavoriteProduct[]) => void;
  refreshCustomer: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

interface CustomerProviderProps {
  children: ReactNode;
}

export const CustomerProvider: React.FC<CustomerProviderProps> = ({ children }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user: _user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedBusinessNumber, setLastLoadedBusinessNumber] = useState<string | null>(null);

  const loadCustomer = async () => {
    // URL 파라미터에서 고객사 읽기 (유일한 진실의 원천)
    const urlParams = new URLSearchParams(window.location.search);
    const targetBusinessNumber = urlParams.get('customer');

    if (!targetBusinessNumber) {
      setCustomer(null);
      setLoading(false);
      setLastLoadedBusinessNumber(null);
      return;
    }

    // 이미 로드된 고객사면 건너뛰기 (중복 실행 방지)
    if (lastLoadedBusinessNumber === targetBusinessNumber) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. SessionStorage 캐시 확인 (대리쇼핑에서 전달된 데이터)
      const cacheKey = `customer_${targetBusinessNumber}`;
      const cached = sessionStorage.getItem(cacheKey);
      const cacheTime = sessionStorage.getItem('customer_cache_time');

      // 캐시가 30분 이내면 사용 (Firestore 조회 생략)
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < 30 * 60 * 1000) { // 30분
          const cachedData = JSON.parse(cached);
          setCustomer(cachedData);
          setLastLoadedBusinessNumber(targetBusinessNumber);
          setLoading(false);
          return;
        }
      }

      // 2. 캐시 없으면 Firestore 조회
      const customerData = await getCustomer(targetBusinessNumber);

      setCustomer(customerData);
      setLastLoadedBusinessNumber(targetBusinessNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : '고객사 정보를 불러올 수 없습니다.');
      setCustomer(null);
      setLastLoadedBusinessNumber(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.search]);

  const refreshCustomer = async () => {
    await loadCustomer();
  };

  const updateFavorites = (favorites: FavoriteProduct[]) => {
    if (!customer) return;

    // 1. Context 상태 업데이트
    const updatedCustomer = { ...customer, favoriteProducts: favorites };
    setCustomer(updatedCustomer);

    // 2. SessionStorage 캐시도 업데이트 (탭 간 동기화)
    const cacheKey = `customer_${customer.businessNumber}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(updatedCustomer));
      sessionStorage.setItem('customer_cache_time', Date.now().toString());
    } catch (error) {
      // Error handled silently
    }
  };

  return (
    <CustomerContext.Provider value={{ customer, loading, error, updateFavorites, refreshCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within CustomerProvider');
  }
  return context;
};
