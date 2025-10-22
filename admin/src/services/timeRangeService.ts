/**
 * 파일 경로: /src/services/timeRangeService.ts
 * 작성 날짜: 2025-10-18
 * 주요 내용: 전역 시간 범위 관리 서비스
 * - 일일식품 openedAt을 기준 시간으로 사용
 * - 일일식품이 열리지 않았으면 오늘 00:00 사용
 */

import cutoffService from './cutoffService';

class TimeRangeService {
  /**
   * 현재 조회 기준 시작 시간
   * @returns openedAt 또는 오늘 00:00
   */
  async getCurrentRangeStart(): Promise<Date> {
    try {
      const cutoffInfo = await cutoffService.getInfo();

      if (cutoffInfo.openedAt) {
        return cutoffInfo.openedAt;
      }

      // cutoff가 없으면 오늘 00:00 반환
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    } catch (error) {
      console.error('Error getting current range start:', error);
      // 오류 시 오늘 00:00 반환
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  }
}

export const timeRangeService = new TimeRangeService();
export default timeRangeService;
