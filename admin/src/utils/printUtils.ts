/**
 * 파일 경로: /src/utils/printUtils.ts
 * 작성 날짜: 2025-10-09
 * 주요 내용: 인쇄 센터 윈도우 관리 유틸리티
 */

import type { DocumentType } from '../components/print/types';

// 프린트 센터 윈도우 참조 저장
let printCenterWindow: Window | null = null;

/**
 * 인쇄 센터를 새 탭으로 열거나 기존 탭을 재사용합니다.
 *
 * @param documentType - 문서 타입 (예: 'inbound-inspection', 'outbound-shipment')
 * @param documentIds - 인쇄할 문서 ID 배열
 * @param windowName - 탭 이름 (기본값: 'jwsPrintCenter')
 * @returns 열린 탭의 Window 객체 또는 null
 */
export const openPrintCenter = (
  documentType: DocumentType,
  documentIds: string[],
  windowName: string = 'jwsPrintCenter'
): Window | null => {
  if (!documentIds || documentIds.length === 0) {
    return null;
  }

  // 기존 탭이 열려있고 닫히지 않았는지 확인
  if (printCenterWindow && !printCenterWindow.closed) {
    // 기존 탭에 새 문서 추가 메시지 전송
    printCenterWindow.postMessage(
      {
        type: 'ADD_DOCUMENTS',
        documentType,
        documentIds
      },
      window.location.origin
    );

    // 탭에 포커스
    printCenterWindow.focus();
    return printCenterWindow;
  }

  // 새 탭 생성
  // 인쇄 센터 URL 구성
  const url = `/print-center?type=${documentType}&ids=${documentIds.join(',')}`;

  // 새 탭으로 열기 (features 파라미터 없이)
  printCenterWindow = window.open(url, windowName);

  if (printCenterWindow) {
    // 탭에 포커스
    printCenterWindow.focus();
  } else {
    console.error('Failed to open print center tab. Please check browser settings.');
  }

  return printCenterWindow;
};
