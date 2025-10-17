/**
 * 파일 경로: /src/types/accountLedger.ts
 * 작성 날짜: 2025-10-16
 * 주요 내용: 거래처원장 TypeScript 타입 정의
 * 관련 데이터: 동적 생성 (매출/수금, 매입/지급 통합 뷰)
 */

import { Timestamp } from 'firebase/firestore';

// 거래 유형
export type TransactionType = 'sale' | 'payment' | 'purchase' | 'payout';

// 거래처원장 항목 (고객사)
export interface CustomerAccountLedgerEntry {
  date: Timestamp;                  // 거래일자
  transactionType: 'sale' | 'payment'; // 거래 유형
  referenceNumber: string;          // 참조번호 (원장번호/수금번호)
  description: string;              // 설명
  debit: number;                    // 차변 (매출액 증가)
  credit: number;                   // 대변 (수금액 감소)
  balance: number;                  // 잔액 (미수금)
  notes?: string;                   // 비고
}

// 거래처원장 항목 (공급사)
export interface SupplierAccountLedgerEntry {
  date: Timestamp;                  // 거래일자
  transactionType: 'purchase' | 'payout'; // 거래 유형
  referenceNumber: string;          // 참조번호 (원장번호/지급번호)
  description: string;              // 설명
  debit: number;                    // 차변 (매입액 증가)
  credit: number;                   // 대변 (지급액 감소)
  balance: number;                  // 잔액 (미지급금)
  notes?: string;                   // 비고
}

// 고객사 거래처원장
export interface CustomerAccountLedger {
  // 고객사 정보
  customerId: string;
  customerName: string;
  customerBusinessNumber?: string;

  // 기간 정보
  periodStart: Date;
  periodEnd: Date;

  // 이월 잔액
  openingBalance: number;           // 기초 미수금

  // 입출금 내역
  entries: CustomerAccountLedgerEntry[];

  // 요약 정보
  totalSales: number;               // 총 매출액 (차변 합계)
  totalPayments: number;            // 총 수금액 (대변 합계)
  closingBalance: number;           // 기말 미수금

  // 생성 정보
  generatedAt: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 공급사 거래처원장
export interface SupplierAccountLedger {
  // 공급사 정보
  supplierId: string;
  supplierName: string;
  supplierBusinessNumber?: string;

  // 기간 정보
  periodStart: Date;
  periodEnd: Date;

  // 이월 잔액
  openingBalance: number;           // 기초 미지급금

  // 입출금 내역
  entries: SupplierAccountLedgerEntry[];

  // 요약 정보
  totalPurchases: number;           // 총 매입액 (차변 합계)
  totalPayouts: number;             // 총 지급액 (대변 합계)
  closingBalance: number;           // 기말 미지급금

  // 생성 정보
  generatedAt: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 거래처원장 생성 옵션 (고객사)
export interface GenerateCustomerAccountLedgerOptions {
  customerId: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 거래처원장 생성 옵션 (공급사)
export interface GenerateSupplierAccountLedgerOptions {
  supplierId: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedByName?: string;
}

// 거래 유형 레이블
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sale: '매출',
  payment: '수금',
  purchase: '매입',
  payout: '지급'
};

// API 응답 타입
export interface AccountLedgerResponse<T = CustomerAccountLedger | SupplierAccountLedger> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
