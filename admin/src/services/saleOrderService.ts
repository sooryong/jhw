/**
 * 파일 경로: /src/services/saleOrderService.ts
 * 작성 날짜: 2025-09-28
 * 주요 내용: 매출주문 관련 서비스
 * 관련 데이터: saleOrders 컬렉션
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  SaleOrder,
  CreateSaleOrderData,
  OrderHistoryFilter,
  OrderHistoryResult,
  SaleOrderStatus,
  OrderItem,
} from '../types/saleOrder'; // Updated: 2025-10-18
import type { OrderCutoffStatus } from '../types/cutoff';
import orderValidationService from './orderValidationService';
import cutoffService from './cutoffService';
import { getDoc, doc as firestoreDoc } from 'firebase/firestore';

const COLLECTION_NAME = 'saleOrders';

// 매출주문번호 생성 함수
const generateSaleOrderNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // YY
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = today.getDate().toString().padStart(2, '0'); // DD
  const currentDate = `${year}${month}${day}`; // YYMMDD

  const counterRef = doc(db, 'lastCounters', 'saleOrder');

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let lastNumber = 0;
    let storedDate = currentDate;

    if (counterDoc.exists()) {
      const data = counterDoc.data();
      lastNumber = data.lastNumber || 0;
      storedDate = data.currentDate || currentDate;
    }

    // 날짜가 바뀌면 카운터 리셋
    const nextNumber = (storedDate === currentDate) ? lastNumber + 1 : 1;

    // 카운터 업데이트
    transaction.set(counterRef, {
      lastNumber: nextNumber,
      currentDate: currentDate
    }, { merge: true });

    return nextNumber;
  });

  // 3자리 패딩 (overflow 시 4자리 이상 허용)
  const paddedNumber = newNumber.toString().padStart(3, '0');
  return `SO-${currentDate}-${paddedNumber}`;
};

/**
 * 주문 아이템에 일일식품 상품이 포함되어 있는지 확인
 * @param items - 주문 아이템 배열
 * @returns true if any item is daily food product
 */
const hasDailyFoodItems = async (items: OrderItem[]): Promise<boolean> => {
  try {
    for (const item of items) {
      const productRef = firestoreDoc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);

      if (productSnap.exists()) {
        const productData = productSnap.data();
        if (productData.mainCategory === '일일식품') {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking daily food items:', error);
    return false;
  }
};

// 매출주문 생성 (자동 검증 및 확정 상태 판단)
export const createSaleOrder = async (orderData: CreateSaleOrderData): Promise<string> => {
  try {
    const saleOrderNumber = await generateSaleOrderNumber();
    const now = Timestamp.now();

    // 주문 검증 실행
    const validationResult = await orderValidationService.validateOrder(orderData.orderItems);

    // 일일식품 상품 포함 여부 확인
    const containsDailyFood = await hasDailyFoodItems(orderData.orderItems);

    // 기본 주문 데이터
    const baseOrderData = {
      saleOrderNumber,
      customerId: orderData.customerId,
      customerInfo: orderData.customerInfo,
      orderItems: orderData.orderItems,
      finalAmount: orderData.finalAmount,
      itemCount: orderData.itemCount,
      placedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: orderData.createdBy,
    };

    let newSaleOrder: Omit<SaleOrder, 'id'>;

    if (validationResult.isValid) {
      // 검증 통과: 즉시 confirmed 상태로 생성
      newSaleOrder = {
        ...baseOrderData,
        status: 'confirmed',
        confirmedAt: now,
      };

      // 일일식품 상품이 포함된 경우 cutoffStatus 설정
      if (containsDailyFood) {
        const cutoffInfo = await cutoffService.getInfo();
        newSaleOrder.cutoffStatus = cutoffInfo.status === 'open'
          ? 'within-cutoff'
          : 'after-cutoff';
      }
    } else {
      // 검증 실패 → pended 상태로 저장
      const pendedReason = orderValidationService.generatePendedReason(
        validationResult.errors,
        validationResult.warnings
      );

      newSaleOrder = {
        ...baseOrderData,
        status: 'pended',
        pendedReason,
        pendedAt: now,
        validationErrors: [...validationResult.errors, ...validationResult.warnings],
      };

      // pended 상태여도 일일식품 포함 시 cutoffStatus 설정
      if (containsDailyFood) {
        const cutoffInfo = await cutoffService.getInfo();
        newSaleOrder.cutoffStatus = cutoffInfo.status === 'open'
          ? 'within-cutoff'
          : 'after-cutoff';
      }
    }

    await addDoc(collection(db, COLLECTION_NAME), newSaleOrder);

    return saleOrderNumber;
  } catch (error) {
      // Error handled silently
    console.error('매출주문 생성 실패:', error);
    throw new Error('매출주문 생성에 실패했습니다.');
  }
};

// 매출주문 조회 (ID로)
export const getSaleOrder = async (saleOrderNumber: string): Promise<SaleOrder | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('saleOrderNumber', '==', saleOrderNumber),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
    } as unknown as SaleOrder;
  } catch (error) {
      // Error handled silently
    console.error('매출주문 조회 실패:', error);
    throw new Error('매출주문 조회에 실패했습니다.');
  }
};

// 매출주문 조회 (고객사 ID와 주문 ID로)
export const getSaleOrderById = async (customerId: string, saleOrderNumber: string): Promise<SaleOrder> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('saleOrderNumber', '==', saleOrderNumber),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    const orderDoc = snapshot.docs[0];
    const data = orderDoc.data();

    // 고객사 권한 검증
    if (data.customerId !== customerId) {
      throw new Error('접근 권한이 없습니다.');
    }

    return {
      ...data,
      id: orderDoc.id,
    } as unknown as SaleOrder;
  } catch (error) {
      // Error handled silently
    console.error('주문 상세 조회 실패:', error);
    throw error;
  }
};

// 고객사별 매출주문 이력 조회
export const getSaleOrderHistory = async (
  customerId: string,
  filter: OrderHistoryFilter = {}
): Promise<OrderHistoryResult> => {
  try {
    const {
      startDate,
      endDate,
      status,
      page = 1,
      limit: pageLimit = 10,
    } = filter;

    // 기본 쿼리 조건
    let q = query(
      collection(db, COLLECTION_NAME),
      where('customerId', '==', customerId)
    );

    // 날짜 필터 추가
    if (startDate) {
      const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      q = query(q, where('placedAt', '>=', startTimestamp));
    }

    if (endDate) {
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));
      q = query(q, where('placedAt', '<=', endTimestamp));
    }

    // 상태 필터 추가
    if (status && status !== 'all') {
      q = query(q, where('status', '==', status));
    }

    // 정렬 추가
    q = query(q, orderBy('placedAt', 'desc'));

    // 전체 개수 조회 (페이지네이션용)
    const totalSnapshot = await getDocs(q);
    const totalCount = totalSnapshot.size;

    // 페이지네이션 적용
    const offset = (page - 1) * pageLimit;
    let paginatedQuery = query(q, limit(pageLimit));

    if (offset > 0) {
      // startAfter를 위해 offset만큼 건너뛰기
      const offsetSnapshot = await getDocs(query(q, limit(offset)));
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        paginatedQuery = query(q, startAfter(lastDoc), limit(pageLimit));
      }
    }

    const snapshot = await getDocs(paginatedQuery);
    const orders = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as unknown as SaleOrder[];

    return {
      orders,
      totalCount,
      totalPages: Math.ceil(totalCount / pageLimit),
      currentPage: page,
    };
  } catch (error) {
      // Error handled silently
    console.error('매출주문 이력 조회 실패:', error);
    throw new Error('매출주문 이력 조회에 실패했습니다.');
  }
};

// 매출주문 삭제 (pended 상태만 가능)
export const deleteSaleOrder = async (saleOrderNumber: string): Promise<void> => {
  try {
    // 먼저 주문 조회하여 상태 확인
    const saleOrder = await getSaleOrder(saleOrderNumber);

    if (!saleOrder) {
      throw new Error('존재하지 않는 매출주문입니다.');
    }

    if (saleOrder.status !== 'pended') {
      throw new Error('보류 상태의 주문만 삭제할 수 있습니다.');
    }

    // 일일식품 마감 검증: within-cutoff 주문은 마감 후 삭제 불가
    if (saleOrder.cutoffStatus === 'within-cutoff') {
      const cutoffInfo = await cutoffService.getInfo();
      if (cutoffInfo.status === 'closed') {
        throw new Error('마감 시간 내 접수된 일일식품 주문은 마감 후 삭제할 수 없습니다.');
      }
    }

    // 문서 ID로 삭제
    const q = query(
      collection(db, COLLECTION_NAME),
      where('saleOrderNumber', '==', saleOrderNumber),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      await deleteDoc(doc(db, COLLECTION_NAME, snapshot.docs[0].id));
    }
  } catch (error) {
      // Error handled silently
    console.error('매출주문 삭제 실패:', error);
    throw error;
  }
};

// 매출주문 상태 업데이트 (관리자용 - JWS 플랫폼에서 사용)
export const updateSaleOrderStatus = async (
  saleOrderNumber: string,
  status: SaleOrderStatus,
  saleLedgerId?: string
): Promise<void> => {
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

    const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
    const now = Timestamp.now();

    const updateData: {status: string, updatedAt: Timestamp, [key: string]: unknown} = {
      status,
      updatedAt: now,
    };

    // 상태별 타임스탬프 업데이트
    if (status === 'confirmed') {
      updateData.confirmedAt = now;
    } else if (status === 'completed') {
      updateData.completedAt = now;
      if (saleLedgerId) {
        updateData.saleLedgerId = saleLedgerId;
      }
    } else if (status === 'rejected') {
      updateData.rejectedAt = now;
    } else if (status === 'cancelled') {
      updateData.cancelledAt = now;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
      // Error handled silently
    console.error('매출주문 상태 업데이트 실패:', error);
    throw error;
  }
};

// 매출주문 통계 조회 (관리자용)
export const getSaleOrderStats = async (customerId?: string) => {
  try {
    let q = query(collection(db, COLLECTION_NAME));

    if (customerId) {
      q = query(q, where('customerId', '==', customerId));
    }

    const snapshot = await getDocs(q);

    const stats = {
      total: 0,
      confirmed: 0,
      pended: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
      totalAmount: 0,
    };

    snapshot.docs.forEach(doc => {
      const order = doc.data() as SaleOrder;
      stats.total++;

      // 상태별 카운트
      if (order.status === 'confirmed') {
        stats.confirmed++;
      } else if (order.status === 'pended') {
        stats.pended++;
      } else if (order.status === 'rejected') {
        stats.rejected++;
      } else if (order.status === 'completed') {
        stats.completed++;
      } else if (order.status === 'cancelled') {
        stats.cancelled++;
      }

      stats.totalAmount += order.finalAmount;
    });

    return stats;
  } catch (error) {
      // Error handled silently
    console.error('매출주문 통계 조회 실패:', error);
    throw new Error('매출주문 통계 조회에 실패했습니다.');
  }
};

// 고객사별 주문 수량 조회 (resetAt ~ 현재까지, placed/confirmed/pending 상태만)
export const getOrderCountByCustomer = async (customerId: string): Promise<number> => {
  try {
    // cutoff 정보 조회
    const cutoffInfo = await cutoffService.getInfo();
    const resetAt = cutoffInfo.openedAt;

    if (!resetAt) {
      // resetAt이 없으면 오늘 00:00 기준
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resetAtTimestamp = Timestamp.fromDate(today);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('customerId', '==', customerId),
        where('status', 'in', ['placed', 'confirmed', 'pended']),
        where('placedAt', '>=', resetAtTimestamp)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    }

    // resetAt 이후 주문만 카운트
    const resetAtTimestamp = Timestamp.fromDate(resetAt);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('customerId', '==', customerId),
      where('status', 'in', ['placed', 'confirmed', 'pended']),
      where('placedAt', '>=', resetAtTimestamp)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
      // Error handled silently
    console.error('주문 수량 조회 실패:', error);
    return 0;
  }
};

// 여러 고객사의 주문 수량을 일괄 조회
export const getOrderCountsByCustomers = async (customerIds: string[]): Promise<Record<string, number>> => {
  try {
    const orderCounts: Record<string, number> = {};

    // 각 고객사별로 쿼리 실행
    await Promise.all(
      customerIds.map(async (customerId) => {
        const count = await getOrderCountByCustomer(customerId);
        orderCounts[customerId] = count;
      })
    );

    return orderCounts;
  } catch (error) {
      // Error handled silently
    console.error('주문 수량 일괄 조회 실패:', error);
    return {};
  }
};

// 고객사별 주문 통계 조회 (건수, 총 수량, 합계 금액)
export interface OrderStatsByCustomer {
  orderCount: number;      // 주문 건수
  totalQuantity: number;   // 총 수량 (모든 상품의 quantity 합)
  totalAmount: number;     // 합계 금액
}

export const getOrderStatsByCustomer = async (customerId: string): Promise<OrderStatsByCustomer> => {
  try {
    // cutoff 정보 조회
    const cutoffInfo = await cutoffService.getInfo();
    const resetAt = cutoffInfo.openedAt;

    let resetAtTimestamp: Timestamp;
    if (!resetAt) {
      // resetAt이 없으면 오늘 00:00 기준
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      resetAtTimestamp = Timestamp.fromDate(today);
    } else {
      resetAtTimestamp = Timestamp.fromDate(resetAt);
    }

    // resetAt 이후 주문만 조회
    const q = query(
      collection(db, COLLECTION_NAME),
      where('customerId', '==', customerId),
      where('status', 'in', ['placed', 'confirmed', 'pended']),
      where('placedAt', '>=', resetAtTimestamp)
    );

    const snapshot = await getDocs(q);

    let orderCount = 0;
    let totalQuantity = 0;
    let totalAmount = 0;

    snapshot.docs.forEach(doc => {
      const order = doc.data() as SaleOrder;
      orderCount++;
      totalAmount += order.finalAmount;

      // 각 주문의 orderItems에서 수량 합산
      order.orderItems.forEach(item => {
        totalQuantity += item.quantity;
      });
    });

    return {
      orderCount,
      totalQuantity,
      totalAmount,
    };
  } catch (error) {
      // Error handled silently
    console.error('주문 통계 조회 실패:', error);
    return {
      orderCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
    };
  }
};

// 여러 고객사의 주문 통계를 일괄 조회
export const getOrderStatsByCustomers = async (
  customerIds: string[]
): Promise<Record<string, OrderStatsByCustomer>> => {
  try {
    const orderStats: Record<string, OrderStatsByCustomer> = {};

    // 각 고객사별로 쿼리 실행
    await Promise.all(
      customerIds.map(async (customerId) => {
        const stats = await getOrderStatsByCustomer(customerId);
        orderStats[customerId] = stats;
      })
    );

    return orderStats;
  } catch (error) {
      // Error handled silently
    console.error('주문 통계 일괄 조회 실패:', error);
    return {};
  }
};

// 매출주문 취소 (confirmed, pending 상태만 가능)
export const cancelSaleOrder = async (saleOrderNumber: string, customerId: string): Promise<void> => {
  try {
    // 먼저 주문 조회하여 상태 및 권한 확인
    const saleOrder = await getSaleOrder(saleOrderNumber);

    if (!saleOrder) {
      throw new Error('존재하지 않는 매출주문입니다.');
    }

    // 고객사 권한 검증
    if (saleOrder.customerId !== customerId) {
      throw new Error('접근 권한이 없습니다.');
    }

    // confirmed, pended 상태만 취소 가능
    if (saleOrder.status !== 'confirmed' && saleOrder.status !== 'pended') {
      throw new Error('확정 또는 보류 상태의 주문만 취소할 수 있습니다.');
    }

    // 문서 ID로 취소 처리 (상태를 'cancelled'로 변경)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('saleOrderNumber', '==', saleOrderNumber),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
      // Error handled silently
    console.error('매출주문 취소 실패:', error);
    throw error;
  }
};

/**
 * 마감 상태별 주문 조회
 * @param cutoffStatus - 'within-cutoff' | 'after-cutoff'
 * @returns 주문 목록
 */
export const getOrdersByCutoffStatus = async (
  cutoffStatus: OrderCutoffStatus
): Promise<SaleOrder[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('cutoffStatus', '==', cutoffStatus),
      where('status', '==', 'confirmed'),
      orderBy('placedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as unknown as SaleOrder[];
  } catch (error) {
    console.error(`마감 상태별 주문 조회 실패 (${cutoffStatus}):`, error);
    throw new Error('마감 상태별 주문 조회에 실패했습니다.');
  }
};

/**
 * 매출주문 확정 (placed → confirmed)
 * @param saleOrderNumber - 매출주문번호
 */
export const confirmSaleOrder = async (saleOrderNumber: string): Promise<void> => {
  try {
    const saleOrder = await getSaleOrder(saleOrderNumber);

    if (!saleOrder) {
      throw new Error('존재하지 않는 매출주문입니다.');
    }

    if (saleOrder.status !== 'placed') {
      throw new Error('접수(placed) 상태의 주문만 확정할 수 있습니다.');
    }

    // confirmed로 상태 변경
    await updateSaleOrderStatus(saleOrderNumber, 'confirmed');
  } catch (error) {
    console.error('매출주문 확정 실패:', error);
    throw error;
  }
};

/**
 * 일괄 확정 결과 타입
 */
export interface BatchConfirmResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    saleOrderNumber: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * 매출주문 일괄 확정 (Service 레이어: batch 사용)
 * @param saleOrderNumbers - 매출주문번호 배열
 * @returns 일괄 확정 결과
 */
export const batchConfirmSaleOrders = async (
  saleOrderNumbers: string[]
): Promise<BatchConfirmResult> => {
  const results: Array<{
    saleOrderNumber: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const saleOrderNumber of saleOrderNumbers) {
    try {
      await confirmSaleOrder(saleOrderNumber);
      results.push({
        saleOrderNumber,
        success: true
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        saleOrderNumber,
        success: false,
        error: err.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return {
    totalCount: saleOrderNumbers.length,
    successCount,
    failureCount: saleOrderNumbers.length - successCount,
    results
  };
};