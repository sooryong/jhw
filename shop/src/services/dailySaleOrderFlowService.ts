/**
 * 파일 경로: /src/services/dailySaleOrderFlowService.ts
 * 작성 날짜: 2025-10-07 (v0.98)
 * 주요 내용: 일일 매출주문 플로우 관리 서비스 (마감 처리)
 * 데이터: dailyOrderCycles 컬렉션
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailyOrderCycle, OrderCycleResult } from '../types/dailyOrderCycle';

// 고정 문서 ID
const CONFIRMATION_STATUS_DOC_ID = 'current';

class DailyOrderCycleService {
  /**
   * 현재 확정 상태 조회
   */
  async getStatus(): Promise<OrderCycleResult> {
    try {
      const docRef = doc(db, 'dailyOrderCycles', CONFIRMATION_STATUS_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as DailyOrderCycle;
        return {
          isConfirmed: data.isConfirmed,
          resetAt: data.resetAt?.toDate() || null,
          lastConfirmedAt: data.lastConfirmedAt?.toDate() || null,
          autoResetScheduledAt: data.autoResetScheduledAt?.toDate() || null,
          confirmedBy: data.confirmedBy,
          confirmedByName: data.confirmedByName
        };
      }

      // 문서가 없으면 초기 상태 반환 (미확정, 오늘 00:00부터 시작)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        isConfirmed: false,
        resetAt: today,
        lastConfirmedAt: null,
        autoResetScheduledAt: null
      };
    } catch (error) {
      // Error handled silently
      console.error('Error getting confirmation status:', error);
      // 오류 시 안전한 기본값 (미확정, 오늘 00:00부터 시작)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        isConfirmed: false,
        resetAt: today,
        lastConfirmedAt: null,
        autoResetScheduledAt: null
      };
    }
  }

  /**
   * 일일식품 확정 (resetAt ~ 현재 시간까지 정규 주문으로 확정)
   * @param userId - 확정자 UID
   * @param userName - 확정자 이름
   */
  async confirm(userId: string, userName: string): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, 'dailyOrderCycles', CONFIRMATION_STATUS_DOC_ID);

    try {
      // 기존 상태 조회
      const docSnap = await getDoc(docRef);
      let resetAt: Timestamp;

      if (docSnap.exists()) {
        const data = docSnap.data() as DailyOrderCycle;
        // 기존 resetAt 유지
        resetAt = data.resetAt;
      } else {
        // 첫 확정인 경우 오늘 00:00을 시작점으로 설정
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        resetAt = Timestamp.fromDate(today);
      }

      // 1. 정규 주문(regular, placed) 모두 confirmed로 변경
      const ordersQuery = query(
        collection(db, 'saleOrders'),
        where('status', '==', 'placed'),
        where('placedAt', '>=', resetAt)
      );

      const ordersSnapshot = await getDocs(ordersQuery);

      if (!ordersSnapshot.empty) {
        const batch = writeBatch(db);
        const nowDate = now.toDate();

        ordersSnapshot.docs.forEach(orderDoc => {
          const orderData = orderDoc.data();
          const placedAt = orderData.placedAt?.toDate();
          const confirmationStatus = orderData.confirmationStatus;

          // 시간 범위 체크 (resetAt <= placedAt <= now) && confirmationStatus가 'regular'이거나 없음
          if (placedAt && placedAt <= nowDate &&
              (!confirmationStatus || confirmationStatus === 'regular')) {
            batch.update(orderDoc.ref, { status: 'confirmed' });
          }
        });

        await batch.commit();
      }

      // 2. 일일식품 매입주문 자동 생성
      try {
        // 집계 데이터 조회
        const { default: dailySaleOrderAggregationService } = await import('./dailySaleOrderAggregationService');
        const aggregationData = await dailySaleOrderAggregationService.getActiveOrderAggregationData();

        // 일일식품 카테고리 추출
        const dailyFoodCategory = aggregationData.categories['일일식품'];

        if (dailyFoodCategory && dailyFoodCategory.suppliers.length > 0) {
          // placedQuantity > 0인 공급사만 필터링
          const suppliersWithPlacedOrders = dailyFoodCategory.suppliers.filter(
            supplier => supplier.totalPlacedQuantity > 0
          );

          if (suppliersWithPlacedOrders.length > 0) {
            // 매입주문 생성
            const { default: purchaseOrderService } = await import('./purchaseOrderService');
            await purchaseOrderService.createPurchaseOrdersFromAggregation(
              suppliersWithPlacedOrders,
              '일일식품'
            );
          }
        }
      } catch (error) {
      // Error handled silently
        console.error('매입주문 자동 생성 중 오류:', error);
        // 매입주문 생성 실패해도 확정은 진행 (에러를 throw하지 않음)
      }

      // 3. 자동 리셋 예약 (17시간 후)
      const autoResetScheduledAt = new Timestamp(now.seconds + 17 * 3600, 0);

      // 4. 확정 상태 저장
      const confirmationData: DailyOrderCycle = {
        resetAt,                    // 리셋 시간 유지
        lastConfirmedAt: now,       // 확정 시간 기록
        autoResetScheduledAt,
        isConfirmed: true,
        confirmedBy: userId,
        confirmedByName: userName
      };

      if (docSnap.exists()) {
        await updateDoc(docRef, confirmationData as unknown);
      } else {
        await setDoc(docRef, confirmationData);
      }
    } catch (error) {
      // Error handled silently
      console.error('Error confirming daily food:', error);
      throw error;
    }
  }

  /**
   * 리셋 (확정 상태 해제, resetAt을 현재 시간으로 갱신)
   * 다음 확정까지 resetAt ~ 현재 시간의 모든 주문이 정규 주문이 됨
   */
  async reset(): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, 'dailyOrderCycles', CONFIRMATION_STATUS_DOC_ID);

    try {
      await updateDoc(docRef, {
        resetAt: now,                // 리셋 시간을 현재로 갱신
        lastConfirmedAt: null,       // 확정 시간 초기화
        autoResetScheduledAt: null,  // 자동 리셋 예약 취소
        isConfirmed: false
      });
    } catch (error) {
      // Error handled silently
      console.error('Error resetting confirmation status:', error);
      throw error;
    }
  }

  /**
   * 초기 데이터 생성 (개발/테스트용)
   * 오늘 00:00부터 시작하는 상태로 초기화
   */
  async initialize(): Promise<void> {

    // 오늘 00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetAt = Timestamp.fromDate(today);

    const docRef = doc(db, 'dailyOrderCycles', CONFIRMATION_STATUS_DOC_ID);

    const initialData: DailyOrderCycle = {
      resetAt,
      isConfirmed: false,
      confirmedBy: 'system',
      confirmedByName: '시스템 초기화'
    };

    await setDoc(docRef, initialData);
  }

  /**
   * 주문 생성 시 사용할 데이터 반환 (v0.98)
   * @param orderType - 주문 유형 ('customer' | 'staff_proxy')
   * @returns 주문 상태, 주문 유형, 확정 상태 구분
   */
  async getOrderCreationData(orderType: 'customer' | 'staff_proxy'): Promise<{
    status: 'placed' | 'confirmed';
    orderType: 'customer' | 'staff_proxy';
    confirmationStatus: 'regular' | 'additional';
  }> {
    const confirmationStatus = await this.getStatus();

    // 확정 후에는 additional로 자동 confirmed
    if (confirmationStatus.isConfirmed) {
      return {
        status: 'confirmed',
        orderType,
        confirmationStatus: 'additional'
      };
    }

    // 확정 전에는 regular로 placed
    return {
      status: 'placed',
      orderType,
      confirmationStatus: 'regular'
    };
  }

  /**
   * 호환성을 위한 레거시 메서드
   */
  async getTodayStatus(): Promise<{ isConfirmed: boolean; confirmedAt: Date | null }> {
    const status = await this.getStatus();
    return {
      isConfirmed: status.isConfirmed,
      confirmedAt: status.lastConfirmedAt
    };
  }
}

// 싱글톤 인스턴스
export const dailyConfirmationStatusService = new DailyOrderCycleService();
export default dailyConfirmationStatusService;
