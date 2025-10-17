/**
 * 파일 경로: /src/types/customerStatement.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 거래명세서 TypeScript 타입 정의
 * 관련 데이터: 동적 생성 (컬렉션 아님)
 */

import { Timestamp } from 'firebase/firestore';

// 거래명세서 (동적 생성)
export interface CustomerStatement {
  customerId: string;
  customerName: string;

  // 기간 정보
  periodStart: Date;
  periodEnd: Date;

  // 잔액 정보
  previousBalance: number;         // 이월 미수금
  currentSalesAmount: number;      // 당기 매출액
  currentPaymentAmount: number;    // 당기 수금액
  currentBalance: number;          // 현재 미수금

  // 상세 내역
  salesLedgers: {                  // 매출 내역
    saleLedgerNumber: string;
    saleDate: Timestamp;
    amount: number;
    description: string;
  }[];

  payments: {                      // 수금 내역
    paymentNumber: string;
    paymentDate: Timestamp;
    paymentMethod: string;
    amount: number;
  }[];

  // 생성 정보
  generatedAt: Timestamp;
  generatedBy: string;
}

// 거래명세서 생성 요청 데이터
export interface GenerateStatementRequest {
  customerId: string;
  startDate: Date;
  endDate: Date;
}

// API 응답 타입
export interface CustomerStatementResponse {
  success: boolean;
  data?: CustomerStatement;
  error?: string;
  message?: string;
}
