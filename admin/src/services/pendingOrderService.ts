/**
 * 파일 경로: /src/services/pendedOrderService.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: pended 주문 처리 서비스
 * 관련 데이터: saleOrders 컬렉션
 */

import { collection, query, where, getDocs, updateDoc, doc, Timestamp, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SaleOrder, OrderItem } from '../types/saleOrder';

const COLLECTION_NAME = 'saleOrders';

class PendingOrderService {
  /**
   * pended 주문 목록 조회
   */
  async getPendingOrders(): Promise<SaleOrder[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'pended')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as SaleOrder));
    } catch (error) {
      // Error handled silently
      console.error('pended 주문 조회 실패:', error);
      throw new Error('pended 주문 조회에 실패했습니다.');
    }
  }

  /**
   * pended 주문 강제 확정 (Force Confirm)
   */
  async forceConfirmOrder(saleOrderNumber: string, adminId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('saleOrderNumber', '==', saleOrderNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('존재하지 않는 매출주문입니다.');
      }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as SaleOrder;

      // pended 상태인지 확인
      if (orderData.status !== 'pended') {
        throw new Error('pended 상태의 주문만 강제 확정할 수 있습니다.');
      }

      const now = Timestamp.now();

      await updateDoc(doc(db, COLLECTION_NAME, orderDoc.id), {
        status: 'confirmed',
        confirmedAt: now,
        processedBy: adminId,
        pendedAt: now,
        updatedAt: now
      });
    } catch (error) {
      // Error handled silently
      console.error('주문 강제 확정 실패:', error);
      throw error;
    }
  }

  /**
   * pended 주문 수정 (Modify)
   */
  async modifyPendingOrder(
    saleOrderNumber: string,
    orderItems: OrderItem[],
    finalAmount: number,
    itemCount: number,
    adminId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('saleOrderNumber', '==', saleOrderNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('존재하지 않는 매출주문입니다.');
      }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as SaleOrder;

      // pended 상태인지 확인
      if (orderData.status !== 'pended') {
        throw new Error('pended 상태의 주문만 수정할 수 있습니다.');
      }

      const now = Timestamp.now();

      // 수정 후 자동으로 confirmed 상태로 전환
      await updateDoc(doc(db, COLLECTION_NAME, orderDoc.id), {
        orderItems,
        finalAmount,
        itemCount,
        status: 'confirmed',
        confirmedAt: now,
        processedBy: adminId,
        pendedAt: now,
        updatedAt: now,
        // pended 관련 필드는 유지 (이력 추적용)
      });
    } catch (error) {
      // Error handled silently
      console.error('주문 수정 실패:', error);
      throw error;
    }
  }

  /**
   * pended 주문 거부 (Reject)
   */
  async rejectOrder(saleOrderNumber: string, rejectReason: string, adminId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('saleOrderNumber', '==', saleOrderNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('존재하지 않는 매출주문입니다.');
      }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as SaleOrder;

      // pended 상태인지 확인
      if (orderData.status !== 'pended') {
        throw new Error('pended 상태의 주문만 거부할 수 있습니다.');
      }

      const now = Timestamp.now();

      await updateDoc(doc(db, COLLECTION_NAME, orderDoc.id), {
        status: 'rejected',
        rejectedAt: now,
        pendedReason: rejectReason,  // 거부 사유로 업데이트
        processedBy: adminId,
        pendedAt: now,
        updatedAt: now
      });
    } catch (error) {
      // Error handled silently
      console.error('주문 거부 실패:', error);
      throw error;
    }
  }

  /**
   * 주문 상태 변경 (범용)
   */
  async updateOrderStatus(
    saleOrderNumber: string,
    status: 'placed' | 'confirmed' | 'pended' | 'rejected',
    reason: string,
    adminId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('saleOrderNumber', '==', saleOrderNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('존재하지 않는 매출주문입니다.');
      }

      const orderDoc = snapshot.docs[0];
      const now = Timestamp.now();

      const updateData: Record<string, unknown> = {
        status,
        processedBy: adminId,
        pendedAt: now,
        updatedAt: now
      };

      // 상태별 추가 필드 설정
      if (status === 'confirmed') {
        updateData.confirmedAt = now;
      } else if (status === 'rejected') {
        updateData.rejectedAt = now;
        updateData.pendedReason = reason;
      } else if (status === 'pended') {
        updateData.pendedReason = reason;
      } else if (status === 'placed') {
        // placed 상태로 복원 시 사유 저장
        updateData.pendedReason = reason;
      }

      await updateDoc(doc(db, COLLECTION_NAME, orderDoc.id), updateData);
    } catch (error) {
      // Error handled silently
      console.error('주문 상태 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 고객사에 연락 (Contact Customer)
   * SMS 발송 또는 알림 전송
   */
  async contactCustomer(
    saleOrderNumber: string
    // _message: string,
    // _adminId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('saleOrderNumber', '==', saleOrderNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('존재하지 않는 매출주문입니다.');
      }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as SaleOrder;

      // pended 상태인지 확인
      if (orderData.status !== 'pended') {
        throw new Error('pended 상태의 주문만 고객에게 연락할 수 있습니다.');
      }

      // TODO: SMS 발송 또는 알림 전송 로직 구현
      // 현재는 로그만 기록

      // 연락 이력을 주문에 기록할 수도 있음
      const now = Timestamp.now();
      await updateDoc(doc(db, COLLECTION_NAME, orderDoc.id), {
        updatedAt: now,
        // contactHistory 배열에 추가하는 것도 고려 가능
      });
    } catch (error) {
      // Error handled silently
      console.error('고객 연락 실패:', error);
      throw error;
    }
  }

  /**
   * pended 주문 수 조회
   */
  async getPendingOrderCount(): Promise<number> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'pended')
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      // Error handled silently
      console.error('pended 주문 수 조회 실패:', error);
      return 0;
    }
  }

  /**
   * 특정 고객사의 pended 주문 조회
   */
  async getPendingOrdersByCustomer(customerId: string): Promise<SaleOrder[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'pended'),
        where('customerId', '==', customerId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as SaleOrder));
    } catch (error) {
      // Error handled silently
      console.error('고객사별 pended 주문 조회 실패:', error);
      throw new Error('고객사별 pended 주문 조회에 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스
export const pendedOrderService = new PendingOrderService();
export default pendedOrderService;
