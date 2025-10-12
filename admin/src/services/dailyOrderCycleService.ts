/**
 * 파일 경로: /src/services/dailyOrderCycleService.ts
 * 작성 날짜: 2025-10-11 (v0.99)
 * 주요 내용: 일일 주문 사이클 관리 서비스 (시간 기반 orderPhase 구분)
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailyOrderCycle, OrderCycleResult } from '../types/dailyOrderCycle';

// 고정 문서 ID
const ORDER_CYCLE_DOC_ID = 'current';

class DailyOrderCycleService {
  /**
   * 현재 사이클 상태 조회
   */
  async getStatus(): Promise<OrderCycleResult> {
    try {
      const docRef = doc(db, 'dailyOrderCycles', ORDER_CYCLE_DOC_ID);
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

      // 문서가 없으면 초기 상태 반환 (미마감, 오늘 00:00부터 시작)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        isConfirmed: false,
        resetAt: today,
        lastConfirmedAt: null,
        autoResetScheduledAt: null
      };
    } catch (error) {
      console.error('Error getting order cycle status:', error);
      // 오류 시 안전한 기본값 (미마감, 오늘 00:00부터 시작)
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
   * 정규 매출주문 마감 (resetAt ~ 현재 시간까지를 정규 주문으로 고정)
   * 더 이상 status를 변경하지 않고, orderPhase 구분만 고정시킴
   * @param userId - 마감 처리자 UID
   * @param userName - 마감 처리자 이름
   */
  async confirm(userId: string, userName: string): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, 'dailyOrderCycles', ORDER_CYCLE_DOC_ID);

    try {
      // 기존 상태 조회
      const docSnap = await getDoc(docRef);
      let resetAt: Timestamp;

      if (docSnap.exists()) {
        const data = docSnap.data() as DailyOrderCycle;
        // 기존 resetAt 유지
        resetAt = data.resetAt;
      } else {
        // 첫 마감인 경우 오늘 00:00을 시작점으로 설정
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        resetAt = Timestamp.fromDate(today);
      }

      // 주문 상태 변경 로직 제거 (모든 유효한 주문은 이미 confirmed 상태)
      // orderPhase는 주문 생성 시 자동으로 regular/additional로 설정됨

      // 자동 리셋 예약 (17시간 후)
      const autoResetScheduledAt = new Timestamp(now.seconds + 17 * 3600, 0);

      // 마감 상태 저장
      const cycleData: DailyOrderCycle = {
        resetAt,                    // 리셋 시간 유지
        lastConfirmedAt: now,       // 마감 시간 기록
        autoResetScheduledAt,
        isConfirmed: true,
        confirmedBy: userId,
        confirmedByName: userName
      };

      if (docSnap.exists()) {
        await updateDoc(docRef, cycleData as any);
      } else {
        await setDoc(docRef, cycleData);
      }
    } catch (error) {
      console.error('Error confirming daily order:', error);
      throw error;
    }
  }

  /**
   * 리셋 (마감 상태 해제, resetAt을 현재 시간으로 갱신)
   * 다음 마감까지 resetAt ~ 현재 시간의 모든 주문이 정규 주문(regular)으로 분류됨
   */
  async reset(): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, 'dailyOrderCycles', ORDER_CYCLE_DOC_ID);

    try {
      await updateDoc(docRef, {
        resetAt: now,                // 리셋 시간을 현재로 갱신
        lastConfirmedAt: null,       // 마감 시간 초기화
        autoResetScheduledAt: null,  // 자동 리셋 예약 취소
        isConfirmed: false
      });
    } catch (error) {
      console.error('Error resetting order cycle:', error);
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

    const docRef = doc(db, 'dailyOrderCycles', ORDER_CYCLE_DOC_ID);

    const initialData: DailyOrderCycle = {
      resetAt,
      isConfirmed: false,
      confirmedBy: 'system',
      confirmedByName: '시스템 초기화'
    };

    await setDoc(docRef, initialData);
  }

  /**
   * 주문 생성 시 사용할 데이터 반환 (v0.99)
   * @param orderType - 주문 유형 ('customer' | 'staff_proxy')
   * @returns 주문 상태, 주문 유형, 주문 단계 구분
   */
  async getOrderCreationData(orderType: 'customer' | 'staff_proxy'): Promise<{
    status: 'placed' | 'confirmed';
    orderType: 'customer' | 'staff_proxy';
    orderPhase: 'regular' | 'additional';
  }> {
    const cycleStatus = await this.getStatus();

    // 마감 후에는 additional로 구분
    if (cycleStatus.isConfirmed) {
      return {
        status: 'confirmed',  // 사용 안 됨 (saleOrderService에서 무조건 confirmed)
        orderType,
        orderPhase: 'additional'
      };
    }

    // 마감 전에는 regular로 구분
    return {
      status: 'placed',  // 사용 안 됨 (saleOrderService에서 무조건 confirmed)
      orderType,
      orderPhase: 'regular'
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
export const dailyOrderCycleService = new DailyOrderCycleService();
export default dailyOrderCycleService;
