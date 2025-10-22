/**
 * 파일 경로: /src/services/cutoffService.ts
 * 작성 날짜: 2025-10-19
 * 주요 내용: 일일식품(Daily Food) 마감 상태 조회 서비스 (Shop App)
 *
 * Shop 앱에서는 마감 상태를 조회만 하고, 마감 관리는 Admin 앱에서 수행합니다.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Cutoff,
  CutoffInfo
} from '../types/cutoff';

// 고정 문서 ID
const CUTOFF_DOC_ID = 'current';
const COLLECTION_NAME = 'cutoff';

class CutoffService {
  /**
   * 현재 마감 상태 조회
   * @returns 마감 상태 결과
   */
  async getInfo(): Promise<CutoffInfo> {
    try {
      const docRef = doc(db, COLLECTION_NAME, CUTOFF_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Cutoff;
        return {
          status: data.status,
          openedAt: data.openedAt?.toDate() || null,
          closedAt: data.closedAt?.toDate() || null,
          closedByUserId: data.closedByUserId,
          closedByUserName: data.closedByUserName
        };
      }

      // 문서가 없으면 초기 상태 반환 (마감됨, 오늘 00:00부터 시작)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        status: 'closed' as const,
        openedAt: today,
        closedAt: null,
      };
    } catch (error) {
      console.error('Error getting cutoff status:', error);
      // 오류 시 안전한 기본값 (마감됨, 오늘 00:00부터 시작)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        status: 'closed' as const,
        openedAt: today,
        closedAt: null,
      };
    }
  }

  /**
   * 접수 시간 내 여부 확인
   * @returns true: 접수 중, false: 마감됨
   */
  async isWithinCutoff(): Promise<boolean> {
    const cutoffInfo = await this.getInfo();
    return cutoffInfo.status === 'open';
  }
}

// 싱글톤 인스턴스 (Updated: 2025-10-19)
export const cutoffService = new CutoffService();
export default cutoffService;
