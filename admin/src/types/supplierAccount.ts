/**
 * 파일 경로: /src/types/supplierAccount.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 계정 잔액 TypeScript 타입 정의
 * 관련 데이터: Firebase supplierAccounts 컬렉션
 */

import { Timestamp } from 'firebase/firestore';

// 공급사 계정 잔액
export interface SupplierAccount {
  supplierId: string;              // 공급사 사업자번호 (문서 ID로 사용)
  supplierName: string;            // 공급사명 (스냅샷)

  // 잔액 정보
  totalPurchaseAmount: number;     // 누적 매입액 (총 매입원장 합계)
  totalPaidAmount: number;         // 누적 지급액 (총 지급 합계)
  currentBalance: number;          // 현재 미지급금 (totalPurchaseAmount - totalPaidAmount)

  // 통계
  transactionCount: number;        // 총 거래 건수
  lastPurchaseDate: Timestamp | null; // 최근 매입일
  lastPaymentDate: Timestamp | null;  // 최근 지급일

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// API 응답 타입
export interface SupplierAccountResponse<T = SupplierAccount | SupplierAccount[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 서비스 에러 타입
export class SupplierAccountServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SupplierAccountServiceError';
    this.code = code;
  }
}

// 타입 가드 함수
export const isValidSupplierAccount = (data: unknown): data is SupplierAccount => {
  const sa = data as SupplierAccount;
  return (
    sa &&
    typeof sa.supplierId === 'string' &&
    typeof sa.supplierName === 'string' &&
    typeof sa.totalPurchaseAmount === 'number' &&
    typeof sa.totalPaidAmount === 'number' &&
    typeof sa.currentBalance === 'number'
  );
};
