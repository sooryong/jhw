/**
 * 파일 경로: /src/services/orderValidationService.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: 매출주문 검증 서비스
 * 관련 데이터: saleOrders, products 컬렉션
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ValidationError, OrderItem } from '../types/saleOrder';
import type { Product } from '../types/product';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

class OrderValidationService {
  /**
   * 주문 전체 검증 (메인 오케스트레이터)
   */
  async validateOrder(orderItems: OrderItem[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. 재고 확인
    const stockValidation = await this.checkInventory(orderItems);
    errors.push(...stockValidation.errors);
    warnings.push(...stockValidation.warnings);

    // 2. 수량 검증 (비정상적인 수량)
    const quantityValidation = await this.validateQuantity(orderItems);
    warnings.push(...quantityValidation.warnings);

    // 3. 가격 검증
    const priceValidation = await this.validatePrice(orderItems);
    errors.push(...priceValidation.errors);
    warnings.push(...priceValidation.warnings);

    // 4. 상품 활성화 상태 확인
    const activeValidation = await this.validateProductActive(orderItems);
    errors.push(...activeValidation.errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 재고 가용성 확인
   */
  async checkInventory(orderItems: OrderItem[]): Promise<{ errors: ValidationError[]; warnings: ValidationError[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const item of orderItems) {
      try {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          errors.push({
            field: `orderItems.${item.productId}`,
            code: 'PRODUCT_NOT_FOUND',
            message: `상품을 찾을 수 없습니다: ${item.productName}`,
            severity: 'error'
          });
          continue;
        }

        const product = productSnap.data() as Product;

        // 재고 부족 체크
        if (product.stockQuantity !== undefined && product.stockQuantity < item.quantity) {
          const shortage = item.quantity - product.stockQuantity;
          warnings.push({
            field: `orderItems.${item.productId}.quantity`,
            code: 'STOCK_SHORTAGE',
            message: `재고 부족: ${item.productName} (부족 수량: ${shortage}개, 현재 재고: ${product.stockQuantity}개)`,
            severity: 'warning'
          });
        }

        // 재고 임계값 체크 (주문 후 재고가 최소재고 이하로 떨어지는 경우)
        if (product.stockQuantity !== undefined && product.minimumStock !== undefined) {
          const remainingStock = product.stockQuantity - item.quantity;
          if (remainingStock < product.minimumStock) {
            warnings.push({
              field: `orderItems.${item.productId}.quantity`,
              code: 'BELOW_SAFETY_STOCK',
              message: `최소재고 이하: ${item.productName} (주문 후 재고: ${remainingStock}개, 최소재고: ${product.minimumStock}개)`,
              severity: 'warning'
            });
          }
        }
      } catch (error) {
        console.error(`Error checking inventory for product ${item.productId}:`, error);
        errors.push({
          field: `orderItems.${item.productId}`,
          code: 'INVENTORY_CHECK_FAILED',
          message: `재고 확인 실패: ${item.productName}`,
          severity: 'error'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * 수량 검증 (비정상적인 대량 주문 등)
   */
  async validateQuantity(orderItems: OrderItem[]): Promise<{ warnings: ValidationError[] }> {
    const warnings: ValidationError[] = [];

    for (const item of orderItems) {
      try {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) continue;

        // 비정상적으로 많은 수량 (과거 평균의 5배 이상) - 추후 구현
        // 현재는 1000개 이상을 비정상으로 간주
        if (item.quantity > 1000) {
          warnings.push({
            field: `orderItems.${item.productId}.quantity`,
            code: 'UNUSUAL_QUANTITY',
            message: `비정상적으로 많은 수량: ${item.productName} (${item.quantity}개)`,
            severity: 'warning'
          });
        }
      } catch (error) {
        console.error(`Error validating quantity for product ${item.productId}:`, error);
      }
    }

    return { warnings };
  }

  /**
   * 가격 검증 (적용된 단가가 상품의 현재 판매가와 일치하는지)
   */
  async validatePrice(orderItems: OrderItem[]): Promise<{ errors: ValidationError[]; warnings: ValidationError[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const item of orderItems) {
      try {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) continue;

        const product = productSnap.data() as Product;

        // 기본 판매가와 비교
        if (product.salePrices?.standard !== undefined && item.unitPrice !== product.salePrices.standard) {
          // 특별가 적용 여부 확인 (고객사별 특별가는 별도 체크 필요)
          const priceDiff = Math.abs(item.unitPrice - product.salePrices.standard);
          const diffPercent = (priceDiff / product.salePrices.standard) * 100;

          // 10% 이상 차이나면 경고
          if (diffPercent > 10) {
            warnings.push({
              field: `orderItems.${item.productId}.unitPrice`,
              code: 'PRICE_MISMATCH',
              message: `가격 불일치: ${item.productName} (주문 단가: ${item.unitPrice.toLocaleString()}원, 기본 판매가: ${product.salePrices.standard.toLocaleString()}원)`,
              severity: 'warning'
            });
          }
        }

        // lineTotal 계산 검증
        const expectedLineTotal = item.unitPrice * item.quantity;
        if (item.lineTotal !== expectedLineTotal) {
          errors.push({
            field: `orderItems.${item.productId}.lineTotal`,
            code: 'LINE_TOTAL_MISMATCH',
            message: `라인 합계 오류: ${item.productName} (계산값: ${expectedLineTotal.toLocaleString()}원, 주문값: ${item.lineTotal.toLocaleString()}원)`,
            severity: 'error'
          });
        }
      } catch (error) {
        console.error(`Error validating price for product ${item.productId}:`, error);
      }
    }

    return { errors, warnings };
  }

  /**
   * 상품 활성화 상태 확인
   */
  async validateProductActive(orderItems: OrderItem[]): Promise<{ errors: ValidationError[] }> {
    const errors: ValidationError[] = [];

    for (const item of orderItems) {
      try {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) continue;

        const product = productSnap.data() as Product;

        // 상품이 비활성화 상태인 경우
        if (product.isActive === false) {
          errors.push({
            field: `orderItems.${item.productId}`,
            code: 'PRODUCT_INACTIVE',
            message: `비활성화된 상품: ${item.productName}`,
            severity: 'error'
          });
        }
      } catch (error) {
        console.error(`Error validating product active status for ${item.productId}:`, error);
      }
    }

    return { errors };
  }

  /**
   * pended 사유 요약 생성
   */
  generatePendedReason(errors: ValidationError[], warnings: ValidationError[]): string {
    const reasons: string[] = [];

    if (errors.length > 0) {
      reasons.push(`오류 ${errors.length}건`);
    }

    if (warnings.length > 0) {
      reasons.push(`경고 ${warnings.length}건`);
    }

    // 주요 오류 코드 추출
    const criticalCodes = new Set<string>();
    errors.forEach(err => criticalCodes.add(err.code));
    warnings.forEach(warn => {
      if (warn.code === 'STOCK_SHORTAGE' || warn.code === 'UNUSUAL_QUANTITY') {
        criticalCodes.add(warn.code);
      }
    });

    const codeLabels: { [key: string]: string } = {
      PRODUCT_NOT_FOUND: '상품 없음',
      PRODUCT_INACTIVE: '비활성 상품',
      PRODUCT_DISCONTINUED: '판매 중단',
      STOCK_SHORTAGE: '재고 부족',
      UNUSUAL_QUANTITY: '비정상 수량',
      PRICE_MISMATCH: '가격 불일치',
      LINE_TOTAL_MISMATCH: '금액 계산 오류'
    };

    const criticalLabels = Array.from(criticalCodes)
      .map(code => codeLabels[code] || code)
      .join(', ');

    if (criticalLabels) {
      reasons.push(`(${criticalLabels})`);
    }

    return reasons.join(' ') || '검증 필요';
  }
}

// 싱글톤 인스턴스
export const orderValidationService = new OrderValidationService();
export default orderValidationService;
