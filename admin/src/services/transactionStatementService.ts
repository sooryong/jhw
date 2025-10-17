/**
 * 파일 경로: /src/services/transactionStatementService.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래명세서 생성 서비스 (개별 원장 출력용)
 */

import { getPurchaseLedgerById } from './purchaseLedgerService';
import { getSaleLedgerById } from './saleLedgerService';
import { getSupplierById } from './supplierService';
import { getCustomer } from './customerService';
import type {
  PurchaseTransactionStatement,
  SaleTransactionStatement,
  GeneratePurchaseStatementOptions,
  GenerateSaleStatementOptions
} from '../types/transactionStatement';

/**
 * 매입 거래명세서 생성 (개별 원장 출력)
 */
export const generatePurchaseStatement = async (
  options: GeneratePurchaseStatementOptions
): Promise<PurchaseTransactionStatement> => {
  try {
    // 매입 원장 조회
    const purchaseLedger = await getPurchaseLedgerById(options.purchaseLedgerId);
    if (!purchaseLedger) {
      throw new Error('매입 원장을 찾을 수 없습니다.');
    }

    // 공급사 정보 조회
    const supplier = await getSupplierById(purchaseLedger.supplierId);
    if (!supplier) {
      throw new Error('공급사 정보를 찾을 수 없습니다.');
    }

    return {
      supplierId: purchaseLedger.supplierId,
      supplierName: supplier.businessName,
      supplierBusinessNumber: supplier.businessNumber,
      purchaseLedger,
      generatedAt: new Date(),
      generatedBy: options.generatedBy,
      generatedByName: options.generatedByName
    };
  } catch (error) {
      // Error handled silently
    console.error('Error generating purchase statement:', error);
    throw new Error('매입 거래명세서 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 매출 거래명세서 생성 (개별 원장 출력)
 */
export const generateSaleStatement = async (
  options: GenerateSaleStatementOptions
): Promise<SaleTransactionStatement> => {
  try {
    // 매출 원장 조회
    const saleLedger = await getSaleLedgerById(options.saleLedgerId);
    if (!saleLedger) {
      throw new Error('매출 원장을 찾을 수 없습니다.');
    }

    // 고객사 정보 조회
    const customer = await getCustomer(saleLedger.customerId);
    if (!customer) {
      throw new Error('고객사 정보를 찾을 수 없습니다.');
    }

    return {
      customerId: saleLedger.customerId,
      customerName: customer.businessName,
      customerBusinessNumber: customer.businessNumber,
      saleLedger,
      generatedAt: new Date(),
      generatedBy: options.generatedBy,
      generatedByName: options.generatedByName
    };
  } catch (error) {
      // Error handled silently
    console.error('Error generating sale statement:', error);
    throw new Error('매출 거래명세서 생성 중 오류가 발생했습니다.');
  }
};
