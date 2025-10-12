/**
 * 파일 경로: /src/utils/printUtils.ts
 * 작성 날짜: 2025-10-09
 * 주요 내용: 인쇄 센터 윈도우 관리 유틸리티
 */

import type { DocumentType } from '../components/print/types';

// 프린트 센터 윈도우 참조 저장
let printCenterWindow: Window | null = null;

/**
 * 인쇄 센터 윈도우를 열거나 기존 윈도우를 재사용합니다.
 *
 * @param documentType - 문서 타입 (예: 'inbound-inspection', 'outbound-shipment')
 * @param documentIds - 인쇄할 문서 ID 배열
 * @param windowName - 윈도우 이름 (기본값: 'jwsPrintCenter')
 * @returns 열린 윈도우 객체 또는 null
 */
export const openPrintCenter = (
  documentType: DocumentType,
  documentIds: string[],
  windowName: string = 'jwsPrintCenter'
): Window | null => {
  if (!documentIds || documentIds.length === 0) {
    console.warn('No document IDs provided for print center');
    return null;
  }

  // 기존 윈도우가 열려있고 닫히지 않았는지 확인
  if (printCenterWindow && !printCenterWindow.closed) {
    // 기존 윈도우에 새 문서 추가 메시지 전송
    printCenterWindow.postMessage(
      {
        type: 'ADD_DOCUMENTS',
        documentType,
        documentIds
      },
      window.location.origin
    );

    // 윈도우에 포커스
    printCenterWindow.focus();
    return printCenterWindow;
  }

  // 새 윈도우 생성
  // 인쇄 센터 URL 구성
  const url = `/print-center?type=${documentType}&ids=${documentIds.join(',')}`;

  // 윈도우 크기 및 위치 계산
  const width = 1200;
  const height = 800;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  // 윈도우 옵션
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'toolbar=no',
    'menubar=no',
    'location=no',
    'status=no',
    'scrollbars=yes',
    'resizable=yes'
  ].join(',');

  // 새 윈도우 생성
  printCenterWindow = window.open(url, windowName, features);

  if (printCenterWindow) {
    // 윈도우에 포커스
    printCenterWindow.focus();
  } else {
    console.error('Failed to open print center window. Please check popup blocker settings.');
  }

  return printCenterWindow;
};
