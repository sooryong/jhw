/**
 * 파일 경로: /src/contexts/SaleOrderContext.tsx
 * 작성 날짜: 2025-10-19
 * 주요 내용: 매출주문 전역 상태 관리 Context
 *   - cutoffOpenedAt 이후의 모든 매출주문 관리
 *   - 실시간 Firestore 리스너
 *   - 주문 통계 자동 계산
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, onSnapshot, Timestamp, type QuerySnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import cutoffService from '../services/cutoffService';
import type { SaleOrder, SaleOrderItem } from '../types/saleOrder';
import type { CutoffInfo } from '../types/cutoff';

// Context 타입 정의
interface SaleOrderContextType {
  orders: SaleOrder[];
  orderStats: {
    count: number;
    productTypes: number;
    products: number;
    amount: number;
  };
  cutoffInfo: CutoffInfo;
  loading: boolean;
  refreshData: () => void;
}

// Context 생성
const SaleOrderContext = createContext<SaleOrderContextType | undefined>(undefined);

// Provider Props 타입
interface SaleOrderProviderProps {
  children: ReactNode;
}

// Provider 컴포넌트
export const SaleOrderProvider: React.FC<SaleOrderProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [orderStats, setOrderStats] = useState({ count: 0, productTypes: 0, products: 0, amount: 0 });
  const [cutoffInfo, setCutoffInfo] = useState<CutoffInfo>({
    status: 'closed',
    openedAt: null,
    closedAt: null
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 데이터 로드 및 실시간 리스너
  useEffect(() => {
    // 인증된 사용자가 없으면 데이터를 로드하지 않음
    if (!user) {
      return;
    }

    loadData();

    // Firestore 실시간 리스너 설정
    let unsubscribeSaleOrders: (() => void) | null = null;
    let unsubscribeCutoff: (() => void) | null = null;

    const setupListeners = async () => {
      // cutoffOpenedAt 조회
      const cutoffInfo = await cutoffService.getInfo();
      const cutoffOpenedAt = cutoffInfo.openedAt || new Date(new Date().setHours(0, 0, 0, 0));

      // 마감 상태 리스너
      const cutoffDocRef = collection(db, 'cutoff');
      unsubscribeCutoff = onSnapshot(cutoffDocRef, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadData();
        }
      });

      // 매출주문 리스너 (cutoffOpenedAt 이후의 모든 주문)
      const saleOrdersQuery = query(
        collection(db, 'saleOrders'),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt))
      );

      unsubscribeSaleOrders = onSnapshot(saleOrdersQuery, (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          loadData();
        }
      });
    };

    setupListeners();

    return () => {
      if (unsubscribeSaleOrders) {
        unsubscribeSaleOrders();
      }
      if (unsubscribeCutoff) {
        unsubscribeCutoff();
      }
    };
  }, [user, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. cutoffOpenedAt 조회
      const cutoffInfo = await cutoffService.getInfo();
      const cutoffOpenedAt = cutoffInfo.openedAt || new Date(new Date().setHours(0, 0, 0, 0));

      // 마감 정보 설정
      setCutoffInfo(cutoffInfo);

      // 2. cutoffOpenedAt 이후의 매출주문 조회
      const ordersQuery = query(
        collection(db, 'saleOrders'),
        where('placedAt', '>=', Timestamp.fromDate(cutoffOpenedAt))
      );

      const snapshot = await new Promise<QuerySnapshot>((resolve) => {
        const unsubscribe = onSnapshot(ordersQuery, (snap) => {
          unsubscribe();
          resolve(snap);
        });
      });

      const ordersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as SaleOrder[];

      setOrders(ordersList);

      // 3. 통계 계산 (전체 주문 집계)
      const totalOrders = ordersList.length;

      // 고유 상품 종류 계산
      const uniqueProducts = new Set<string>();
      ordersList.forEach((order: SaleOrder) => {
        order.orderItems?.forEach((item: SaleOrderItem) => {
          if (item.productId) {
            uniqueProducts.add(item.productId);
          }
        });
      });

      const totalProducts = ordersList.reduce((sum: number, order: SaleOrder) => {
        return sum + (order.orderItems?.reduce((itemSum: number, item: SaleOrderItem) => itemSum + item.quantity, 0) || 0);
      }, 0);
      const totalAmount = ordersList.reduce((sum: number, order: SaleOrder) => {
        return sum + (order.finalAmount || 0);
      }, 0);

      setOrderStats({
        count: totalOrders,
        productTypes: uniqueProducts.size,
        products: totalProducts,
        amount: totalAmount
      });

    } catch (error) {
      console.error('Error loading sale orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const value: SaleOrderContextType = {
    orders,
    orderStats,
    cutoffInfo,
    loading,
    refreshData
  };

  return (
    <SaleOrderContext.Provider value={value}>
      {children}
    </SaleOrderContext.Provider>
  );
};

// Custom Hook
export const useSaleOrderContext = (): SaleOrderContextType => {
  const context = useContext(SaleOrderContext);
  if (context === undefined) {
    throw new Error('useSaleOrderContext must be used within a SaleOrderProvider');
  }
  return context;
};
