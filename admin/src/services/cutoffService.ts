/**
 * 파일 경로: /src/services/cutoffService.ts
 * 작성 날짜: 2025-10-20
 * 주요 내용: 일일식품(Daily Food) 마감 관리 서비스
 *
 * 일일식품 상품의 주문 접수 시작/마감을 관리합니다.
 * - open(): 주문 접수 시작
 * - close(): 주문 접수 마감 (집계 + 매입주문 생성)
 * - getInfo(): 현재 마감 상태 조회
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Cutoff,
  CutoffInfo,
  CutoffCloseResult
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
   * @deprecated Use getInfo() instead
   */
  async getCutoffStatus(): Promise<CutoffInfo> {
    return this.getInfo();
  }

  /**
   * 주문 접수 시작 (마감 열기)
   */
  async open(): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, COLLECTION_NAME, CUTOFF_DOC_ID);

    try {
      // 마감 상태 저장 (undefined 필드 제외)
      const cutoffData: Partial<Cutoff> = {
        status: 'open',
        openedAt: now
      };

      await setDoc(docRef, cutoffData);
    } catch (error) {
      console.error('Error opening cutoff:', error);
      throw new Error('주문 접수 시작 중 오류가 발생했습니다.');
    }
  }

  /**
   * @deprecated Use open() instead
   */
  async openCutoff(): Promise<void> {
    return this.open();
  }

  /**
   * 주문 접수 마감 (상태만 변경, PO 생성 없음)
   * @param userId - 마감 처리자 ID
   * @param userName - 마감 처리자 이름
   */
  async closeOnly(userId: string, userName: string): Promise<void> {
    const now = Timestamp.now();
    const docRef = doc(db, COLLECTION_NAME, CUTOFF_DOC_ID);

    try {
      // 현재 상태 확인
      const cutoffInfo = await this.getInfo();
      if (cutoffInfo.status === 'closed') {
        throw new Error('이미 마감된 상태입니다.');
      }

      // cutoff status만 'closed'로 변경
      await updateDoc(docRef, {
        status: 'closed' as const,
        closedAt: now,
        closedByUserId: userId,
        closedByUserName: userName
      });
    } catch (error) {
      console.error('Error closing cutoff:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('주문 접수 마감 중 오류가 발생했습니다.');
    }
  }

  /**
   * 주문 접수 마감 (집계 + 매입주문 생성)
   * @param userId - 마감 처리자 ID
   * @param userName - 마감 처리자 이름
   * @returns 마감 처리 결과
   */
  async close(userId: string, userName: string): Promise<CutoffCloseResult> {
    const now = Timestamp.now();
    const docRef = doc(db, COLLECTION_NAME, CUTOFF_DOC_ID);

    try {
      // 1. 현재 상태 확인
      const cutoffInfo = await this.getInfo();
      if (cutoffInfo.status === 'closed') {
        throw new Error('이미 마감된 상태입니다.');
      }

      // 2. 일일식품 품목 집계 (시간 기반)
      const { default: saleOrderAggregationService } = await import('./saleOrderAggregationService');
      const suppliers = await saleOrderAggregationService.aggregateDailyFoodOrders();

      if (suppliers.length === 0) {
        // 일일식품 주문이 없는 경우
        await updateDoc(docRef, {
          status: 'closed' as const,
          closedAt: now,
          closedByUserId: userId,
          closedByUserName: userName
        });

        return {
          aggregatedOrderCount: 0,
          purchaseOrderNumbers: [],
          smsResults: []
        };
      }

      // 4. 공급사별 매입주문 생성
      const { default: dailyFoodPurchaseOrderService } = await import('./dailyFoodPurchaseOrderService');
      const purchaseOrderNumbers = await dailyFoodPurchaseOrderService.createBatchFromAggregation(
        suppliers,
        userId
      );

      // 5. SMS 발송
      const smsResults = await dailyFoodPurchaseOrderService.sendBatchSms(purchaseOrderNumbers);

      // 6. SMS 성공한 매입주문은 confirmed로 상태 변경
      const { default: purchaseOrderService } = await import('./purchaseOrderService');
      for (const smsResult of smsResults.results) {
        if (smsResult.success) {
          try {
            await purchaseOrderService.updatePurchaseOrderStatus(
              smsResult.purchaseOrderNumber,
              'confirmed'
            );
          } catch (error) {
            console.error(`[DailyFood] 매입주문 상태 변경 실패 (${smsResult.purchaseOrderNumber}):`, error);
          }
        }
      }

      // SMS 결과를 SMSResult 타입으로 변환
      const formattedSmsResults = smsResults.results.map((result) => {
        const supplier = suppliers.find((s, i) => i < purchaseOrderNumbers.length &&
          purchaseOrderNumbers[i] === result.purchaseOrderNumber);

        return {
          supplierId: supplier?.supplierId || '',
          supplierName: supplier?.supplierName || '',
          success: result.success,
          error: result.error
        };
      });

      // 7. 집계된 주문 수 계산 (각 공급사의 상품에서 주문 건수 추출)
      const aggregatedOrderCount = suppliers.reduce((total, supplier) => {
        return total + supplier.products.reduce((sum, product) => sum + product.orderCount, 0);
      }, 0);

      // 8. 상태 업데이트
      await updateDoc(docRef, {
        status: 'closed' as const,
        closedAt: now,
        closedByUserId: userId,
        closedByUserName: userName
      });

      return {
        aggregatedOrderCount,
        purchaseOrderNumbers,
        smsResults: formattedSmsResults
      };

    } catch (error) {
      console.error('Error closing cutoff:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('주문 접수 마감 중 오류가 발생했습니다.');
    }
  }

  /**
   * @deprecated Use close() instead
   */
  async closeCutoff(userId: string, userName: string): Promise<CutoffCloseResult> {
    return this.close(userId, userName);
  }

  /**
   * 접수 시간 내 여부 확인
   * @returns true: 접수 중, false: 마감됨
   */
  async isWithinCutoff(): Promise<boolean> {
    const cutoffInfo = await this.getInfo();
    return cutoffInfo.status === 'open';
  }

  /**
   * 초기화 (개발/테스트용)
   * 오늘 00:00부터 시작하는 마감 상태로 초기화
   */
  async initialize(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const openedAt = Timestamp.fromDate(today);

    const docRef = doc(db, COLLECTION_NAME, CUTOFF_DOC_ID);

    const initialData: Cutoff = {
      status: 'closed',
      openedAt,
      closedByUserId: 'system',
      closedByUserName: '시스템 초기화'
    };

    await setDoc(docRef, initialData);
  }
}

// 싱글톤 인스턴스
export const cutoffService = new CutoffService();
export default cutoffService;
