/**
 * 파일 경로: /src/types/transactionStatement.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래명세서 TypeScript 타입 정의 (개별 원장 출력용)
 * 관련 데이터: 동적 생성 (DB 저장 안 함)
 */

import type { PurchaseLedger } from './purchaseLedger';
import type { SaleLedger } from './saleLedger';

// 매입 거래명세서 (개별 원장 출력)
export interface PurchaseTransactionStatement {
  // 공급사 정보
  supplierId: string;
  supplierName: string;
  supplierBusinessNumber?: string;

  // 매입 원장 (단일 건)
  purchaseLedger: PurchaseLedger;

  // 생성 정보
  generatedAt: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 매출 거래명세서 (개별 원장 출력)
export interface SaleTransactionStatement {
  // 고객사 정보
  customerId: string;
  customerName: string;
  customerBusinessNumber?: string;

  // 매출 원장 (단일 건)
  saleLedger: SaleLedger;

  // 생성 정보
  generatedAt: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 거래명세서 생성 옵션 (매입)
export interface GeneratePurchaseStatementOptions {
  purchaseLedgerId: string;           // 매입 원장 ID
  generatedBy: string;
  generatedByName?: string;
}

// 거래명세서 생성 옵션 (매출)
export interface GenerateSaleStatementOptions {
  saleLedgerId: string;               // 매출 원장 ID
  generatedBy: string;
  generatedByName?: string;
}

// API 응답 타입
export interface TransactionStatementResponse<T = PurchaseTransactionStatement | SaleTransactionStatement> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
