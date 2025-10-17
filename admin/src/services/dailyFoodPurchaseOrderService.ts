/**
 * 파일 경로: /src/services/dailyFoodPurchaseOrderService.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 일일식품 매입주문 전용 서비스
 * 관련 데이터: Firebase purchaseOrders 컬렉션 (category: '일일식품')
 */

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PurchaseOrder, PurchaseOrderFormData } from '../types/purchaseOrder';
import { PurchaseOrderServiceError } from '../types/purchaseOrder';
import type { SupplierAggregation } from '../types/orderAggregation';
import purchaseOrderService from './purchaseOrderService';

class DailyFoodPurchaseOrderService {
  private collectionName = 'purchaseOrders';
  private category = '일일식품';

  /**
   * 최근 매입주문 중복 체크 (일일식품 전용)
   * @private
   */
  private async checkRecentPurchaseOrder(
    supplierId: string
  ): Promise<{ exists: boolean; purchaseOrderNumber?: string }> {
    const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
    const status = await dailyOrderCycleService.getStatus();

    if (!status.lastConfirmedAt) {
      return { exists: false };
    }

    const confirmedTime = status.lastConfirmedAt;
    const startTime = new Date(confirmedTime.getTime() - 60000);
    const endTime = new Date(confirmedTime.getTime() + 60000);

    const q = query(
      collection(db, this.collectionName),
      where('supplierId', '==', supplierId),
      where('category', '==', this.category),
      where('placedAt', '>=', Timestamp.fromDate(startTime)),
      where('placedAt', '<=', Timestamp.fromDate(endTime))
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return {
        exists: true,
        purchaseOrderNumber: snapshot.docs[0].data().purchaseOrderNumber
      };
    }

    return { exists: false };
  }

  /**
   * 단일 공급사의 일일식품 매입주문 생성
   * @param supplier - 공급사 집계 데이터
   * @param status - 주문 상태 ('placed' | 'confirmed')
   * @returns 생성된 매입주문 ID
   */
  async createFromAggregation(
    supplier: SupplierAggregation,
    status: 'placed' | 'confirmed' = 'placed'
  ): Promise<string> {
    try {
      // 1. 중복 체크
      const recentCheck = await this.checkRecentPurchaseOrder(supplier.supplierId);

      if (recentCheck.exists) {
        throw new PurchaseOrderServiceError(
          `이미 생성된 매입주문이 있습니다: ${recentCheck.purchaseOrderNumber}`,
          'DUPLICATE_PURCHASE_ORDER'
        );
      }

      // 2. 매입주문번호 생성
      const purchaseOrderNumber = await purchaseOrderService.generatePurchaseOrderId();

      // 3. 공급사 정보 조회
      const supplierQuery = query(
        collection(db, 'suppliers'),
        where('businessNumber', '==', supplier.supplierId)
      );
      const supplierSnapshot = await getDocs(supplierQuery);

      if (supplierSnapshot.empty) {
        throw new PurchaseOrderServiceError(
          `공급사를 찾을 수 없습니다: ${supplier.supplierId}`,
          'SUPPLIER_NOT_FOUND'
        );
      }

      const supplierData = supplierSnapshot.docs[0].data();

      // 4. 주문 품목 생성
      const orderItems = supplier.products.map(product => ({
        productId: product.productId,
        productName: product.productName,
        specification: product.specification || '',
        quantity: product.totalQuantity
      }));

      // 5. 일일확정 상태 조회 (현재 사용하지 않지만 향후 확장 가능)
      // const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
      // const confirmationStatus = await dailyOrderCycleService.getStatus();

      // 6. 매입주문 데이터 생성
      const now = Timestamp.now();
      const purchaseOrder: Partial<PurchaseOrder> = {
        purchaseOrderNumber,
        supplierId: supplier.supplierId,
        category: this.category,
        status,
        itemCount: orderItems.length,
        orderItems,
        supplierInfo: {
          businessName: supplierData.businessName || supplier.supplierName,
          smsRecipients: supplier.smsRecipients
        },
        placedAt: now,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      } as unknown as PurchaseOrder;

      // confirmed 상태인 경우에만 confirmedAt 추가
      if (status === 'confirmed') {
        purchaseOrder.confirmedAt = now;
      }

      // 7. Firestore에 저장
      await addDoc(collection(db, this.collectionName), purchaseOrder);

      return purchaseOrderNumber;

    } catch (error) {
      // Error handled silently
      console.error('Error creating daily food purchase order:', error);
      throw error;
    }
  }

  /**
   * 단일 공급사의 일일식품 매입주문을 confirmed 상태로 생성
   * @param supplier - 공급사 집계 데이터
   * @returns 생성된 매입주문 ID
   */
  async createConfirmedOrder(
    supplier: SupplierAggregation
  ): Promise<string> {
    return await this.createFromAggregation(supplier, 'confirmed');
  }

  /**
   * 공급사별 집계 데이터로부터 일일식품 매입주문 일괄 생성
   * (일일식품 확정 시 사용)
   * @param suppliers - 공급사별 집계 데이터 배열
   * @returns 생성된 매입주문 ID 배열
   */
  async createBatchFromAggregation(
    suppliers: SupplierAggregation[]
  ): Promise<string[]> {
    try {
      const createdOrderIds: string[] = [];

      // 일일확정 상태 조회 (현재 사용하지 않지만 향후 확장 가능)
      // const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
      // const confirmationStatus = await dailyOrderCycleService.getStatus();

      for (const supplier of suppliers) {
        // 매입주문번호 생성
        const purchaseOrderNumber = await purchaseOrderService.generatePurchaseOrderId();

        // 공급사 정보 조회 (businessNumber 필드 사용)
        const supplierQuery = query(
          collection(db, 'suppliers'),
          where('businessNumber', '==', supplier.supplierId)
        );
        const supplierSnapshot = await getDocs(supplierQuery);

        if (supplierSnapshot.empty) {
          continue;
        }

        const supplierData = supplierSnapshot.docs[0].data();

        // 주문 품목 생성
        const orderItems = supplier.products.map(product => ({
          productId: product.productId,
          productName: product.productName,
          mainCategory: product.mainCategory || '',
          specification: product.specification || '',
          quantity: product.totalQuantity
        }));

        // 매입주문 데이터 생성
        const purchaseOrder: Omit<PurchaseOrder, 'id'> = {
          purchaseOrderNumber,
          supplierId: supplier.supplierId,
          category: this.category,
          status: 'placed',
          itemCount: orderItems.length,
          orderItems,
          supplierInfo: {
            businessName: supplierData.businessName || supplier.supplierName,
            smsRecipients: supplier.smsRecipients || []
          },
          placedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: 'system'
        };

        // Firestore에 저장
        await addDoc(
          collection(db, this.collectionName),
          purchaseOrder
        );

        createdOrderIds.push(purchaseOrderNumber);
      }

      return createdOrderIds;
    } catch (error) {
      // Error handled silently
      console.error('Error creating batch daily food purchase orders:', error);
      throw new PurchaseOrderServiceError(
        '일일식품 매입주문 일괄 생성 중 오류가 발생했습니다.',
        'BATCH_CREATE_FAILED'
      );
    }
  }

  /**
   * 오늘 일일식품 매입주문 조회
   * @returns 오늘 생성된 일일식품 매입주문 목록
   */
  async getTodayOrders(): Promise<PurchaseOrder[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    return purchaseOrderService.getPurchaseOrders({
      startDate: startOfDay,
      endDate: endOfDay,
      category: this.category
    });
  }

  /**
   * 일일식품 매입주문 일괄 생성 (폼 데이터 기반)
   * @param orders - 매입주문 폼 데이터 배열
   * @param createdBy - 생성자 UID
   * @returns 생성된 매입주문 배열
   */
  async createBatchOrders(
    orders: PurchaseOrderFormData[],
    createdBy: string
  ): Promise<PurchaseOrder[]> {
    try {
      const createdOrders: PurchaseOrder[] = [];

      for (const orderData of orders) {
        // category를 일일식품으로 강제
        const dailyFoodOrderData = {
          ...orderData,
          category: this.category
        };
        const order = await purchaseOrderService.createPurchaseOrder(
          dailyFoodOrderData,
          createdBy
        );
        createdOrders.push(order);
      }

      return createdOrders;
    } catch (error) {
      // Error handled silently
      console.error('Error creating batch daily food purchase orders:', error);
      throw new PurchaseOrderServiceError(
        '일일식품 매입주문 일괄 생성 중 오류가 발생했습니다.',
        'BATCH_CREATE_FAILED'
      );
    }
  }

  /**
   * resetAt 기준 일일식품 매입주문 조회
   * @param resetAt - 시작 시간 (옵션)
   * @returns 일일식품 매입주문 목록
   */
  async getOrdersSinceReset(resetAt?: Date): Promise<PurchaseOrder[]> {
    return purchaseOrderService.getPurchaseOrders({
      category: this.category,
      startDate: resetAt
    });
  }
}

// 싱글톤 인스턴스
export const dailyFoodPurchaseOrderService = new DailyFoodPurchaseOrderService();
export default dailyFoodPurchaseOrderService;
