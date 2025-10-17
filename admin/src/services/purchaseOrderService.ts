/**
 * 파일 경로: /src/services/purchaseOrderService.ts
 * 작성 날짜: 2025-10-04
 * 주요 내용: 매입주문 관리 서비스
 * 관련 데이터: Firebase purchaseOrders 컬렉션
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderFormData
} from '../types/purchaseOrder';
import { PurchaseOrderServiceError } from '../types/purchaseOrder';
import type { SupplierAggregation } from '../types/orderAggregation';
import { format } from 'date-fns';

class PurchaseOrderService {
  private collectionName = 'purchaseOrders';

  /**
   * 매입주문번호 생성 (PO-YYMMDD-001)
   */
  async generatePurchaseOrderId(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2); // YY
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // MM
    const day = today.getDate().toString().padStart(2, '0'); // DD
    const currentDate = `${year}${month}${day}`; // YYMMDD

    const counterRef = doc(db, 'lastCounters', 'purchaseOrder');

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
    return `PO-${currentDate}-${paddedNumber}`;
  }

  /**
   * 매입주문 생성
   */
  async createPurchaseOrder(
    formData: PurchaseOrderFormData,
    createdBy: string
  ): Promise<PurchaseOrder> {
    try {
      // 매입주문번호 생성
      const purchaseOrderNumber = await this.generatePurchaseOrderId();

      // 공급사 정보 조회
      const supplierDoc = await getDoc(
        doc(db, 'suppliers', formData.supplierId)
      );

      if (!supplierDoc.exists()) {
        throw new PurchaseOrderServiceError(
          '공급사 정보를 찾을 수 없습니다.',
          'SUPPLIER_NOT_FOUND'
        );
      }

      const supplier = supplierDoc.data();

      // SMS 수신자 배열 생성
      const smsRecipients = [];
      if (supplier.smsRecipient?.person1) {
        smsRecipients.push(supplier.smsRecipient.person1);
      }
      if (supplier.smsRecipient?.person2) {
        smsRecipients.push(supplier.smsRecipient.person2);
      }

      // 일일확정 상태 조회 (v1.1)
      const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
      const confirmationStatus = await dailyOrderCycleService.getStatus();

      // 매입주문 데이터 생성
      const purchaseOrder: PurchaseOrder = {
        purchaseOrderNumber,
        supplierId: formData.supplierId,
        supplierInfo: {
          businessName: supplier.businessName,
          smsRecipients
        },
        orderItems: formData.orderItems,
        itemCount: formData.orderItems.length,
        category: formData.category,
        confirmationStatus: confirmationStatus.isConfirmed ? 'additional' : 'regular',
        status: 'placed',
        placedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy
      };

      // Firestore에 저장
      await addDoc(collection(db, this.collectionName), purchaseOrder);

      return purchaseOrder;
    } catch (error) {
      // Error handled silently
      console.error('Error creating purchase order:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        '매입주문 생성 중 오류가 발생했습니다.',
        'CREATE_FAILED'
      );
    }
  }

  /**
   * 매입주문 조회 (ID로)
   */
  async getPurchaseOrderById(purchaseOrderNumber: string): Promise<PurchaseOrder | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('purchaseOrderNumber', '==', purchaseOrderNumber)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      return {
        ...snapshot.docs[0].data()
      } as PurchaseOrder;
    } catch (error) {
      // Error handled silently
      console.error('Error fetching purchase order:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 조회 중 오류가 발생했습니다.',
        'FETCH_FAILED'
      );
    }
  }

  /**
   * 매입주문 목록 조회 (날짜, 상태, 카테고리 필터)
   */
  async getPurchaseOrders(filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: PurchaseOrder['status'];
    category?: string;
    supplierId?: string;
  }): Promise<PurchaseOrder[]> {
    try {
      const constraints: QueryConstraint[] = [];

      // 날짜 필터
      if (filters?.startDate) {
        constraints.push(
          where('placedAt', '>=', Timestamp.fromDate(filters.startDate))
        );
      }
      if (filters?.endDate) {
        constraints.push(
          where('placedAt', '<=', Timestamp.fromDate(filters.endDate))
        );
      }

      // 상태 필터
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }

      // 카테고리 필터
      if (filters?.category) {
        constraints.push(where('category', '==', filters.category));
      }

      // 공급사 필터
      if (filters?.supplierId) {
        constraints.push(where('supplierId', '==', filters.supplierId));
      }

      // 정렬
      constraints.push(orderBy('placedAt', 'desc'));

      const q = query(collection(db, this.collectionName), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        ...doc.data()
      } as PurchaseOrder));
    } catch (error) {
      // Error handled silently
      console.error('Error fetching purchase orders:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 목록 조회 중 오류가 발생했습니다.',
        'FETCH_LIST_FAILED'
      );
    }
  }

  /**
   * 매입주문 상태 변경
   */
  async updatePurchaseOrderStatus(
    purchaseOrderNumber: string,
    status: PurchaseOrder['status']
  ): Promise<void> {
    try {
      // 문서 찾기
      const q = query(
        collection(db, this.collectionName),
        where('purchaseOrderNumber', '==', purchaseOrderNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new PurchaseOrderServiceError(
          '매입주문을 찾을 수 없습니다.',
          'NOT_FOUND'
        );
      }

      const docRef = snapshot.docs[0].ref;
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: Timestamp.now()
      };

      // 상태별 타임스탬프 설정
      if (status === 'confirmed') {
        updateData.confirmedAt = Timestamp.now();
      } else if (status === 'pended') {
        updateData.pendedAt = Timestamp.now();
      } else if (status === 'completed') {
        updateData.completedAt = Timestamp.now();
      }

      await updateDoc(docRef, updateData as unknown);
    } catch (error) {
      // Error handled silently
      console.error('Error updating purchase order status:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        '매입주문 상태 변경 중 오류가 발생했습니다.',
        'UPDATE_STATUS_FAILED'
      );
    }
  }

  /**
   * SMS 발송 시간 및 성공 여부 업데이트
   */
  async updateSmsSentTime(purchaseOrderNumber: string, success: boolean = true): Promise<void> {
    try {
      // 문서 찾기
      const q = query(
        collection(db, this.collectionName),
        where('purchaseOrderNumber', '==', purchaseOrderNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new PurchaseOrderServiceError(
          '매입주문을 찾을 수 없습니다.',
          'NOT_FOUND'
        );
      }

      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, {
        lastSmsSentAt: Timestamp.now(),
        smsSuccess: success,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      // Error handled silently
      console.error('Error updating SMS sent time:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        'SMS 발송 시간 업데이트 중 오류가 발생했습니다.',
        'UPDATE_SMS_TIME_FAILED'
      );
    }
  }


  /**
   * 매입주문 일괄 생성 (일일식품 확정용)
   */
  async createBatchPurchaseOrders(
    orders: PurchaseOrderFormData[],
    createdBy: string
  ): Promise<PurchaseOrder[]> {
    try {
      const createdOrders: PurchaseOrder[] = [];

      for (const orderData of orders) {
        const order = await this.createPurchaseOrder(orderData, createdBy);
        createdOrders.push(order);
      }

      return createdOrders;
    } catch (error) {
      // Error handled silently
      console.error('Error creating batch purchase orders:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 일괄 생성 중 오류가 발생했습니다.',
        'BATCH_CREATE_FAILED'
      );
    }
  }

  /**
   * 오늘 일일식품 매입주문 조회
   */
  async getTodayDailyFoodPurchaseOrders(): Promise<PurchaseOrder[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    return this.getPurchaseOrders({
      startDate: startOfDay,
      endDate: endOfDay,
      category: '일일식품'
    });
  }

  /**
   * 매입주문 일괄 삭제 (확정 취소용)
   */
  async deleteBatchPurchaseOrders(purchaseOrderNumbers: string[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      for (const purchaseOrderNumber of purchaseOrderNumbers) {
        // 매입주문 조회
        const q = query(
          collection(db, this.collectionName),
          where('purchaseOrderNumber', '==', purchaseOrderNumber)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          continue;
        }

        const docRef = snapshot.docs[0].ref;

        // 배치에 삭제 작업 추가
        batch.delete(docRef);
      }

      // 일괄 삭제 실행
      await batch.commit();
    } catch (error) {
      // Error handled silently
      console.error('Error deleting batch purchase orders:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        '매입주문 일괄 삭제 중 오류가 발생했습니다.',
        'BATCH_DELETE_FAILED'
      );
    }
  }

  /**
   * 매입주문 상품 수량 수정
   */
  async updateOrderItemQuantity(
    purchaseOrderNumber: string,
    productId: string,
    newQuantity: number
  ): Promise<void> {
    try {
      if (newQuantity < 1) {
        throw new PurchaseOrderServiceError(
          '수량은 1개 이상이어야 합니다.',
          'INVALID_QUANTITY'
        );
      }

      // 매입주문 조회
      const q = query(
        collection(db, this.collectionName),
        where('purchaseOrderNumber', '==', purchaseOrderNumber)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new PurchaseOrderServiceError(
          '매입주문을 찾을 수 없습니다.',
          'NOT_FOUND'
        );
      }

      const docRef = snapshot.docs[0].ref;
      const purchaseOrder = snapshot.docs[0].data() as PurchaseOrder;

      // placed 상태에서만 수정 가능
      if (purchaseOrder.status !== 'placed') {
        throw new PurchaseOrderServiceError(
          '확정된 주문은 수량을 수정할 수 없습니다.',
          'ALREADY_CONFIRMED'
        );
      }

      // orderItems에서 해당 상품 찾아서 수량 업데이트
      const updatedItems = purchaseOrder.orderItems.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            quantity: newQuantity
          };
        }
        return item;
      });

      // Firebase 업데이트
      await updateDoc(docRef, {
        orderItems: updatedItems,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      // Error handled silently
      console.error('Error updating order item quantity:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        '상품 수량 수정 중 오류가 발생했습니다.',
        'UPDATE_QUANTITY_FAILED'
      );
    }
  }

  /**
   * 개별 수신자에게 SMS 발송
   */
  async sendSmsToRecipient(
    purchaseOrderNumber: string,
    recipientPhone: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // 매입주문 조회
      const purchaseOrder = await this.getPurchaseOrderById(purchaseOrderNumber);

      if (!purchaseOrder) {
        throw new PurchaseOrderServiceError(
          '매입주문을 찾을 수 없습니다.',
          'NOT_FOUND'
        );
      }

      // 수신자 정보 찾기
      const recipient = purchaseOrder.supplierInfo.smsRecipients.find(
        r => r.mobile === recipientPhone
      );

      if (!recipient) {
        throw new PurchaseOrderServiceError(
          '수신자 정보를 찾을 수 없습니다.',
          'RECIPIENT_NOT_FOUND'
        );
      }

      // SMS 메시지 생성
      const { generatePurchaseOrderMessage } = await import('../utils/smsTemplates');
      const message = generatePurchaseOrderMessage(purchaseOrder);

      // SMS 발송
      const smsService = (await import('./smsService')).default;
      const result = await smsService.sendMessage(
        message,
        [{ phone: recipient.mobile, name: recipient.name }],
        { messageType: 'purchase_order' }
      );

      return {
        success: result.success,
        messageId: result.results[0]?.messageIds?.[0],
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      // Error handled silently
      console.error('Error sending SMS to recipient:', error);
      if (error instanceof PurchaseOrderServiceError) {
        throw error;
      }
      throw new PurchaseOrderServiceError(
        'SMS 발송 중 오류가 발생했습니다.',
        'SMS_SEND_FAILED'
      );
    }
  }

  /**
   * 매입주문 일괄 SMS 발송
   */
  async sendBatchSms(purchaseOrderNumbers: string[]): Promise<{
    totalSent: number;
    totalSuccess: number;
    results: Array<{
      purchaseOrderNumber: string;
      success: boolean;
      sentCount: number;
      successCount: number;
      error?: string;
    }>;
  }> {
    try {
      const results: Array<{
        purchaseOrderNumber: string;
        success: boolean;
        sentCount: number;
        successCount: number;
        error?: string;
      }> = [];

      let totalSent = 0;
      let totalSuccess = 0;

      // SMS 서비스 동적 import
      const smsService = (await import('./smsService')).default;
      const { generatePurchaseOrderMessage } = await import('../utils/smsTemplates');

      for (const purchaseOrderNumber of purchaseOrderNumbers) {
        try {
          // 매입주문 조회
          const purchaseOrder = await this.getPurchaseOrderById(purchaseOrderNumber);

          if (!purchaseOrder) {
            results.push({
              purchaseOrderNumber,
              success: false,
              sentCount: 0,
              successCount: 0,
              error: '매입주문을 찾을 수 없습니다.'
            });
            continue;
          }


          // SMS 메시지 생성
          const message = generatePurchaseOrderMessage(purchaseOrder);

          // 공급사 정보 조회하여 담당자 번호 가져오기
          const { supplierService } = await import('./supplierService');
          const supplier = await supplierService.getSupplierById(purchaseOrder.supplierId);

          if (!supplier) {
            results.push({
              purchaseOrderNumber,
              success: false,
              sentCount: 0,
              successCount: 0,
              error: '공급사 정보를 찾을 수 없습니다.'
            });
            continue;
          }

          // 수신자 배열 생성 (primaryContact, secondaryContact)
          const recipients: Array<{ phone: string; name: string }> = [];

          if (supplier.primaryContact?.mobile) {
            recipients.push({
              phone: supplier.primaryContact.mobile,
              name: supplier.primaryContact.name || '담당자'
            });
          }

          if (supplier.secondaryContact?.mobile) {
            recipients.push({
              phone: supplier.secondaryContact.mobile,
              name: supplier.secondaryContact.name || '부담당자'
            });
          }

          if (recipients.length === 0) {
            results.push({
              purchaseOrderNumber,
              success: false,
              sentCount: 0,
              successCount: 0,
              error: 'SMS 수신자(담당자)가 없습니다.'
            });
            continue;
          }

          // SMS 발송
          const result = await smsService.sendMessage(message, recipients, {
            messageType: 'purchase_order'
          });

          const sentCount = recipients.length;
          const successCount = result.successCount;

          totalSent += sentCount;
          totalSuccess += successCount;

          // SMS 발송 결과를 DB에 기록
          await this.updateSmsSentTime(purchaseOrderNumber, result.success);

          results.push({
            purchaseOrderNumber,
            success: result.success,
            sentCount,
            successCount,
            error: result.success ? undefined : result.message
          });
        } catch (smsError) {
          console.error(`SMS 발송 실패 (${purchaseOrderNumber}):`, smsError);

          // SMS 발송 실패도 DB에 기록
          try {
            await this.updateSmsSentTime(purchaseOrderNumber, false);
          } catch (updateError) {
            console.error(`SMS 상태 업데이트 실패 (${purchaseOrderNumber}):`, updateError);
          }

          results.push({
            purchaseOrderNumber,
            success: false,
            sentCount: 0,
            successCount: 0,
            error: smsError instanceof Error ? smsError.message : 'SMS 발송 실패'
          });
        }
      }

      return {
        totalSent,
        totalSuccess,
        results
      };
    } catch (error) {
      // Error handled silently
      console.error('Error sending batch SMS:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 일괄 SMS 발송 중 오류가 발생했습니다.',
        'BATCH_SMS_FAILED'
      );
    }
  }

  /**
   * 최근 매입주문 중복 체크
   * @private
   */
  private async checkRecentPurchaseOrder(
    supplierId: string,
    category: string
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
      where('category', '==', category),
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
   * 단일 공급사의 매입주문 생성
   * @param supplier - 공급사 집계 데이터
   * @param category - 카테고리 ("일일식품")
   * @param status - 주문 상태 ('placed' | 'confirmed')
   * @returns 생성된 매입주문 ID
   */
  async createPurchaseOrderFromAggregation(
    supplier: SupplierAggregation,
    category: string,
    status: 'placed' | 'confirmed' = 'placed'
  ): Promise<string> {
    try {
      // 1. 중복 체크
      const recentCheck = await this.checkRecentPurchaseOrder(
        supplier.supplierId,
        category
      );

      if (recentCheck.exists) {
        throw new PurchaseOrderServiceError(
          `이미 생성된 매입주문이 있습니다: ${recentCheck.purchaseOrderNumber}`,
          'DUPLICATE_PURCHASE_ORDER'
        );
      }

      // 2. 매입주문번호 생성
      const purchaseOrderNumber = await this.generatePurchaseOrderId();

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

      // 5. 일일확정 상태 조회 (v1.1)
      const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
      const confirmationStatus = await dailyOrderCycleService.getStatus();

      // 6. 매입주문 데이터 생성
      const now = Timestamp.now();
      const purchaseOrder: Partial<PurchaseOrder> = {
        purchaseOrderNumber,
        supplierId: supplier.supplierId,
        category,
        confirmationStatus: confirmationStatus.isConfirmed ? 'additional' : 'regular',
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
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  /**
   * 단일 공급사의 매입주문을 confirmed 상태로 생성
   * @param supplier - 공급사 집계 데이터
   * @param category - 카테고리 ("일일식품")
   * @returns 생성된 매입주문 ID
   */
  async createConfirmedPurchaseOrder(
    supplier: SupplierAggregation,
    category: string
  ): Promise<string> {
    return await this.createPurchaseOrderFromAggregation(supplier, category, 'confirmed');
  }

  /**
   * 공급사별 집계 데이터로부터 매입주문 생성 (일일식품 확정 시 사용)
   * @param suppliers - 공급사별 집계 데이터 배열
   * @param category - 카테고리 (예: "일일식품")
   * @returns 생성된 매입주문 ID 배열
   */
  async createPurchaseOrdersFromAggregation(
    suppliers: SupplierAggregation[],
    category: string
  ): Promise<string[]> {
    try {
      const createdOrderIds: string[] = [];

      // 일일확정 상태 조회 (v1.1)
      const { default: dailyOrderCycleService } = await import('./dailyOrderCycleService');
      const confirmationStatus = await dailyOrderCycleService.getStatus();

      for (const supplier of suppliers) {
        // 매입주문번호 생성
        const purchaseOrderNumber = await this.generatePurchaseOrderId();

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

        // 매입주문 데이터 생성 (placed 상태로 생성, SMS 발송 성공 시 confirmed로 변경)
        const now = Timestamp.now();
        const purchaseOrder: Omit<PurchaseOrder, 'id'> = {
          purchaseOrderNumber,
          supplierId: supplier.supplierId,
          category,
          confirmationStatus: confirmationStatus.isConfirmed ? 'additional' : 'regular',
          status: 'placed',
          itemCount: orderItems.length,
          orderItems,
          supplierInfo: {
            businessName: supplierData.businessName || supplier.supplierName,
            smsRecipients: supplier.smsRecipients || []
          },
          placedAt: now,
          createdAt: now,
          updatedAt: now,
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
      console.error('Error creating purchase orders from aggregation:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 생성 중 오류가 발생했습니다.',
        'CREATE_FROM_AGGREGATION_FAILED'
      );
    }
  }

  /**
   * 오늘 날짜의 매입주문 통계 조회
   * @returns 매입주문 통계 (전체, 확정, 보류, 취소)
   */
  async getPurchaseOrderStats(): Promise<{
    total: number;
    confirmed: number;
    pended: number;
    cancelled: number;
  }> {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const q = query(
        collection(db, this.collectionName),
        where('purchaseOrderNumber', '>=', `PO-${today.replace(/-/g, '')}-`),
        where('purchaseOrderNumber', '<', `PO-${today.replace(/-/g, '')}-999`)
      );

      const snapshot = await getDocs(q);

      let confirmed = 0;
      let pended = 0;
      let cancelled = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data() as PurchaseOrder;
        if (data.status === 'confirmed') confirmed++;
        if (data.status === 'pended') pended++;
        if (data.status === 'cancelled') cancelled++;
      });

      return {
        total: snapshot.size,
        confirmed,
        pended,
        cancelled
      };
    } catch (error) {
      // Error handled silently
      console.error('Error getting purchase order stats:', error);
      throw new PurchaseOrderServiceError(
        '매입주문 통계 조회 중 오류가 발생했습니다.',
        'STATS_FETCH_FAILED'
      );
    }
  }
}

// 싱글톤 인스턴스
export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;
