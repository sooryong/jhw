/**
 * 파일 경로: /src/types/supplierStatement.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 거래명세서 TypeScript 타입 정의
 * 관련 데이터: 동적 생성 (DB 저장 안 함)
 */

import type { PurchaseLedger } from './purchaseLedger';
import type { SupplierPayout } from './supplierPayout';

// 공급사 거래명세서
export interface SupplierStatement {
  // 기본 정보
  supplierId: string;
  supplierName: string;
  periodStart: Date;
  periodEnd: Date;

  // 잔액 요약
  previousBalance: number;         // 이월 미지급금
  currentPurchaseAmount: number;   // 당기 매입액
  currentPayoutAmount: number;     // 당기 지급액
  currentBalance: number;          // 현재 미지급금

  // 상세 내역
  purchaseLedgers: PurchaseLedger[];  // 매입 내역
  payouts: SupplierPayout[];          // 지급 내역

  // 생성 정보
  generatedAt: Date;
  generatedBy: string;
}

// 거래명세서 생성 옵션
export interface SupplierStatementOptions {
  supplierId: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
}

// API 응답 타입
export interface SupplierStatementResponse {
  success: boolean;
  data?: SupplierStatement;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class SupplierStatementServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SupplierStatementServiceError';
    this.code = code;
  }
}
