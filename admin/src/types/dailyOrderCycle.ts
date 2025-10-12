/**
 * 파일 경로: /src/types/dailyOrderCycle.ts
 * 작성 날짜: 2025-10-11
 * 주요 내용: 일일 주문 사이클 TypeScript 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 일일 주문 사이클
 * 시간 기반 orderPhase(정규/추가) 구분을 위한 사이클 관리
 */
export interface DailyOrderCycle {
  // 사이클 시간 관리
  resetAt: Timestamp;                 // 마지막 리셋 시간 (정규 주문 시작점)
  lastConfirmedAt?: Timestamp;        // 마지막 마감 시간 (정규 주문 종료점)
  autoResetScheduledAt?: Timestamp;   // 자동 리셋 예정 시간 (lastConfirmedAt + 17시간)

  // 마감 상태
  isConfirmed: boolean;               // 현재 마감 상태 (true: 추가주문기간, false: 정규주문기간)

  // 메타데이터
  confirmedBy?: string;               // 마감 처리자 UID
  confirmedByName?: string;           // 마감 처리자 이름
}

/**
 * 주문 사이클 조회 결과
 */
export interface OrderCycleResult {
  isConfirmed: boolean;
  resetAt: Date | null;
  lastConfirmedAt: Date | null;
  autoResetScheduledAt: Date | null;
  confirmedBy?: string;
  confirmedByName?: string;
}
