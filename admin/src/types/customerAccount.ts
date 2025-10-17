/**
 * 파일 경로: /src/types/customerAccount.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 계정 잔액 TypeScript 타입 정의
 * 관련 데이터: Firebase customerAccounts 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 고객사 계정 잔액
export interface CustomerAccount {
  customerId: string;              // 고객사 사업자번호 (문서 ID로 사용)
  customerName: string;            // 고객사명 (스냅샷)

  // 잔액 정보
  totalSalesAmount: number;        // 누적 매출액 (총 매출원장 합계)
  totalReceivedAmount: number;     // 누적 수금액 (총 수금 합계)
  currentBalance: number;          // 현재 미수금 (totalSalesAmount - totalReceivedAmount)

  // 통계
  transactionCount: number;        // 총 거래 건수
  lastSaleDate: Timestamp | null;  // 최근 매출일
  lastPaymentDate: Timestamp | null; // 최근 수금일

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// API 응답 타입
export interface CustomerAccountResponse<T = CustomerAccount | CustomerAccount[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class CustomerAccountServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CustomerAccountServiceError';
    this.code = code;
  }
}

// 타입 가드 함수
export const isValidCustomerAccount = (data: unknown): data is CustomerAccount => {
  const ca = data as CustomerAccount;
  return (
    ca &&
    typeof ca.customerId === 'string' &&
    typeof ca.customerName === 'string' &&
    typeof ca.totalSalesAmount === 'number' &&
    typeof ca.totalReceivedAmount === 'number' &&
    typeof ca.currentBalance === 'number'
  );
};
