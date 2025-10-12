/**
 * 파일 경로: /src/components/print/types.ts
 * 작성 날짜: 2025-10-09
 * 주요 내용: 범용 인쇄 센터 타입 정의
 */

import type { ReactNode } from 'react';

/**
 * 지원하는 문서 타입
 */
export type DocumentType =
  | 'inbound-inspection'   // 입고 검수표
  | 'outbound-shipment'    // 출하 명세서
  | 'order-receipt'        // 주문 영수증
  | 'purchase-ledger';     // 매입 원장

/**
 * 인쇄할 문서 정보
 */
export interface PrintDocument<T = any> {
  id: string;
  title: string;
  summary: string;
  data: T;
}

/**
 * 문서 렌더러 인터페이스
 * 각 문서 타입별로 이 인터페이스를 구현해야 함
 */
export interface DocumentRenderer<T = any> {
  /**
   * 렌더러가 처리하는 문서 타입
   */
  type: DocumentType;

  /**
   * 문서 ID로 데이터 로딩
   * @param id - 문서 ID
   * @returns 로딩된 문서 데이터
   */
  loadDocument: (id: string) => Promise<T>;

  /**
   * 문서 데이터를 페이지별로 분할
   * @param data - 문서 데이터
   * @returns 페이지별 데이터 청크 배열
   */
  chunkPages: (data: T) => any[][];

  /**
   * 특정 페이지 렌더링
   * @param data - 문서 데이터
   * @param chunk - 현재 페이지 데이터 청크
   * @param pageIndex - 페이지 인덱스 (0-based)
   * @param totalPages - 전체 페이지 수
   * @param key - React key 값
   * @param id - 스크롤 타겟용 DOM ID (첫 페이지만)
   * @param isLastPage - 마지막 페이지 여부
   * @returns 렌더링된 React 노드
   */
  renderPage: (
    data: T,
    chunk: any[],
    pageIndex: number,
    totalPages: number,
    key: string,
    id?: string,
    isLastPage?: boolean
  ) => ReactNode;

  /**
   * 문서 제목 추출
   * @param data - 문서 데이터
   * @returns 문서 제목
   */
  getTitle: (data: T) => string;

  /**
   * 문서 요약 정보 추출
   * @param data - 문서 데이터
   * @returns 문서 요약 (예: "공급사명 • N품목")
   */
  getSummary: (data: T) => string;
}

/**
 * 렌더러 레지스트리 타입
 */
export type RendererRegistry = Map<DocumentType, DocumentRenderer<any>>;
