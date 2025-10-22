/**
 * 파일 경로: /src/services/saleOrderAggregationService.ts
 * 작성 날짜: 2025-10-18
 * 주요 내용: 매출주문 집계 서비스
 * 관련 데이터: saleOrders, products, suppliers 컬렉션
 */

import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  OrderAggregationData,
  CategoryAggregation,
  SupplierAggregation,
  AggregationFilter,
  StatusAggregation
} from '../types/orderAggregation';
import type { SaleOrder } from '../types/saleOrder';
import type { Product } from '../types/product';
import type { Company } from '../types/company';
import timeRangeService from './timeRangeService';

class SaleOrderAggregationService {
  /**
   * 특정 날짜의 매출주문 조회
   */
  async getSaleOrdersByDate(date: Date): Promise<SaleOrder[]> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const q = query(
      collection(db, 'saleOrders'),
      where('placedAt', '>=', Timestamp.fromDate(startOfDay)),
      where('placedAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleOrder));
  }

  /**
   * placed/confirmed/pending 주문 조회 (날짜 필터 없음)
   */
  async getActiveOrders(): Promise<SaleOrder[]> {
    const q = query(
      collection(db, 'saleOrders'),
      where('status', 'in', ['placed', 'confirmed', 'pended'])
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleOrder));
  }

  /**
   * 특정 시간 이후의 Active 주문 조회 (시간 기반 집계용)
   */
  async getActiveOrdersFromTime(fromTime: Date | null): Promise<SaleOrder[]> {
    if (!fromTime) {
      // fromTime이 없으면 timeRangeService에서 기준 시간 가져오기
      fromTime = await timeRangeService.getCurrentRangeStart();
    }

    const q = query(
      collection(db, 'saleOrders'),
      where('status', 'in', ['placed', 'confirmed', 'pended']),
      where('placedAt', '>=', Timestamp.fromDate(fromTime))
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as SaleOrder));
  }

  /**
   * 상품 정보 일괄 조회
   */
  private async getProductsByIds(productIds: string[]): Promise<Map<string, Product>> {
    if (productIds.length === 0) return new Map();

    // Firestore 문서 ID로 직접 조회
    const products: Product[] = [];

    for (const productId of productIds) {
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          products.push({
            productId: docSnap.id,
            ...docSnap.data()
          } as Product);
        } else {
          // Error handled silently
        }
      } catch (error) {
        // Error handled silently
        console.error(`Error fetching product ${productId}:`, error);
      }
    }

    return new Map(products.map(p => [p.productId!, p]));
  }

  /**
   * 공급사 정보 일괄 조회
   * 사업자번호는 하이픈 포함 형식으로 통일됨
   */
  private async getSuppliersByIds(supplierIds: string[]): Promise<Map<string, Company>> {
    if (supplierIds.length === 0) return new Map();

    const suppliers: Company[] = [];
    for (const supplierId of supplierIds) {
      try {
        const q = query(
          collection(db, 'suppliers'),
          where('businessNumber', '==', supplierId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const supplier = snapshot.docs[0].data() as Company;
          suppliers.push(supplier);
        } else {
          // Error handled silently
        }
      } catch (error) {
        // Error handled silently
        console.error(`Error fetching supplier ${supplierId}:`, error);
      }
    }

    // Map의 키는 하이픈 포함 사업자번호
    return new Map(
      suppliers.map(s => [s.businessNumber, s])
    );
  }

  /**
   * 카테고리별 주문 집계
   */
  async aggregateByCategory(
    orders: SaleOrder[],
    filter?: AggregationFilter
  ): Promise<{ [category: string]: CategoryAggregation }> {
    // 필터 적용
    let filteredOrders = orders;
    if (filter?.status && filter.status !== 'all') {
      filteredOrders = orders.filter(order => order.status === filter.status);
    }

    // 모든 상품 ID 추출
    const productIds = [
      ...new Set(
        filteredOrders.flatMap(order =>
          order.orderItems.map(item => item.productId)
        )
      )
    ];

    // 상품 정보 조회
    const productMap = await this.getProductsByIds(productIds);

    // 공급사 ID 추출
    const supplierIds = [
      ...new Set(
        Array.from(productMap.values())
          .map(p => p.supplierId)
          .filter(Boolean) as string[]
      )
    ];

    // 공급사 정보 조회
    const supplierMap = await this.getSuppliersByIds(supplierIds);

    // 카테고리별 집계 맵
    const categoryMap = new Map<string, CategoryAggregation>();

    // 주문별 처리
    filteredOrders.forEach(order => {
      order.orderItems.forEach(item => {
        const product = productMap.get(item.productId);
        if (!product || !product.mainCategory) return;

        const category = product.mainCategory;
        const supplierId = product.supplierId;
        if (!supplierId) return;

        // 카테고리 집계 초기화
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            totalOrders: 0,
            placedOrders: 0,
            confirmedOrders: 0,
            totalAmount: 0,
            placedAmount: 0,
            confirmedAmount: 0,
            suppliers: []
          });
        }

        const categoryAgg = categoryMap.get(category)!;

        // 주문 카운트
        categoryAgg.totalOrders++;
        categoryAgg.totalAmount += item.lineTotal;

        // 공급사별 집계
        let supplierAgg = categoryAgg.suppliers.find(s => s.supplierId === supplierId);
        if (!supplierAgg) {
          const supplier = supplierMap.get(supplierId);
          const smsRecipients: unknown[] = [];

          supplierAgg = {
            supplierId,
            supplierName: supplier?.businessName || '알 수 없음',
            smsRecipients,
            products: [],
            totalQuantity: 0,
            totalPlacedQuantity: 0,
            totalConfirmedQuantity: 0,
            totalAmount: 0
          };
          categoryAgg.suppliers.push(supplierAgg);
        }

        // 상품별 집계
        let productAgg = supplierAgg.products.find(p => p.productId === item.productId);
        if (!productAgg) {
          productAgg = {
            productId: item.productId,
            productName: item.productName,
            specification: item.specification,
            mainCategory: category,
            placedQuantity: 0,
            confirmedQuantity: 0,
            totalQuantity: 0,
            placedAmount: 0,
            confirmedAmount: 0,
            totalAmount: 0,
            unitPrice: product.purchasePrice ?? product.latestPurchasePrice ?? 0,
            stockQuantity: product.stockQuantity ?? 0,
            orderCount: 0
          };
          supplierAgg.products.push(productAgg);
        }

        // 수량 및 금액 집계
        productAgg.totalQuantity += item.quantity;
        productAgg.totalAmount += item.lineTotal;
        productAgg.orderCount++;

        supplierAgg.totalQuantity += item.quantity;
        supplierAgg.totalAmount += item.lineTotal;
      });
    });

    // Map을 객체로 변환
    const result: { [category: string]: CategoryAggregation } = {};
    categoryMap.forEach((value, key) => {
      // 공급사별 정렬 (금액 내림차순)
      value.suppliers.sort((a, b) => b.totalAmount - a.totalAmount);
      result[key] = value;
    });

    return result;
  }

  /**
   * 전체 주문 집계 데이터 생성
   */
  async getOrderAggregationData(filter: AggregationFilter): Promise<OrderAggregationData> {
    const orders = await this.getSaleOrdersByDate(filter.date);

    // 카테고리별 집계
    const categories = await this.aggregateByCategory(orders, filter);

    // 전체 통계 계산
    const total: StatusAggregation = {
      regular: { count: 0, amount: 0 },
      additional: { count: 0, amount: 0 },
      pended: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    orders.forEach(order => {
      if (order.status === 'pended') {
        total.pended.count++;
        total.pended.amount += order.finalAmount;
      } else if (order.status === 'rejected') {
        total.rejected.count++;
        total.rejected.amount += order.finalAmount;
      } else {
        // 일반 주문은 regular로 집계
        total.regular.count++;
        total.regular.amount += order.finalAmount;
      }
    });

    return {
      total,
      categories,
      date: filter.date
    };
  }

  /**
   * Active 주문 집계 데이터 생성
   */
  async getActiveOrderAggregationData(): Promise<OrderAggregationData> {
    // timeRangeService에서 기준 시간 가져오기
    const rangeStart = await timeRangeService.getCurrentRangeStart();

    // 기준 시간 이후의 주문만 조회
    const orders = await this.getActiveOrdersFromTime(rangeStart);

    // 카테고리별 집계
    const categories = await this.aggregateByCategory(orders);

    // 통계 계산
    const total: StatusAggregation = {
      regular: { count: 0, amount: 0, quantity: 0 },
      additional: { count: 0, amount: 0, quantity: 0 },
      pended: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    orders.forEach(order => {
      if (order.status === 'pended') {
        total.pended.count++;
        total.pended.amount += order.finalAmount;
      } else if (order.status === 'rejected') {
        total.rejected.count++;
        total.rejected.amount += order.finalAmount;
      } else {
        // 모든 일반 주문은 regular로 통합
        total.regular.count++;
        total.regular.amount += order.finalAmount;
        // 수량 집계
        if (order.orderItems && Array.isArray(order.orderItems)) {
          order.orderItems.forEach(item => {
            total.regular.quantity! += item.quantity;
          });
        }
      }
    });

    return {
      total,
      categories,
      orders, // 원본 주문 데이터 포함
      date: new Date() // 현재 시간 기준
    };
  }

  /**
   * 공급사별 매입주문 데이터 생성
   */
  async generatePurchaseOrderData(
    suppliers: SupplierAggregation[]
  ): Promise<Array<{
    supplierId: string;
    category: string;
    orderItems: Array<{
      productId: string;
      productName: string;
      specification?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>> {
    return suppliers.map(supplier => ({
      supplierId: supplier.supplierId,
      category: '일일식품',
      orderItems: supplier.products.map(product => ({
        productId: product.productId,
        productName: product.productName,
        specification: product.specification,
        quantity: product.totalQuantity,
        unitPrice: product.unitPrice,
        lineTotal: product.totalAmount
      }))
    }));
  }

  /**
   * 상품별 주문 상세 정보 조회
   */
  async getProductOrderDetails(productId: string): Promise<{
    productName: string;
    specification: string;
    orders: Array<{
      customerName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      orderDate: Date;
      status: string;
    }>;
    totalQuantity: number;
    totalAmount: number;
  }> {
    // timeRangeService에서 기준 시간 가져오기
    const rangeStart = await timeRangeService.getCurrentRangeStart();
    const activeOrders = await this.getActiveOrdersFromTime(rangeStart);

    const orderDetails: Array<{
      customerName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      orderDate: Date;
      status: string;
    }> = [];

    let productName = '';
    let specification = '';
    let totalQuantity = 0;
    let totalAmount = 0;

    activeOrders.forEach(order => {
      const item = order.orderItems.find(i => i.productId === productId);
      if (item) {
        productName = item.productName;
        specification = item.specification || '-';

        orderDetails.push({
          customerName: order.customerInfo.businessName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          orderDate: order.placedAt.toDate(),
          status: order.status
        });

        totalQuantity += item.quantity;
        totalAmount += item.lineTotal;
      }
    });

    // 주문일 기준 내림차순 정렬
    orderDetails.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

    return {
      productName,
      specification,
      orders: orderDetails,
      totalQuantity,
      totalAmount
    };
  }
}

// 싱글톤 인스턴스
export const saleOrderAggregationService = new SaleOrderAggregationService();
export default saleOrderAggregationService;
