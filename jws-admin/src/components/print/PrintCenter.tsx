/**
 * 파일 경로: /src/components/print/PrintCenter.tsx
 * 작성 날짜: 2025-10-09
 * 주요 내용: 범용 인쇄 센터 - 다양한 문서 타입 지원
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Paper
} from '@mui/material';
import {
  Print as PrintIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import type { DocumentType, DocumentRenderer, PrintDocument } from './types';
import { InboundInspectionRenderer } from './renderers/InboundInspectionRenderer';

// 렌더러 레지스트리
const rendererRegistry = new Map<DocumentType, DocumentRenderer<any>>([
  ['inbound-inspection', InboundInspectionRenderer]
  // 향후 추가: ['outbound-shipment', OutboundShipmentRenderer],
  // 향후 추가: ['order-receipt', OrderReceiptRenderer],
]);

const PrintCenter = () => {
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PrintDocument[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [renderer, setRenderer] = useState<DocumentRenderer<any> | null>(null);

  const handleClose = () => {
    window.close();
  };

  const handleDocumentClick = (index: number) => {
    setSelectedIndex(index);
    const docId = `document-${documents[index].id}`;
    const element = document.getElementById(docId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const type = searchParams.get('type') as DocumentType | null;
    const ids = searchParams.get('ids');

    if (!type || !ids) {
      setError('문서 타입 또는 ID가 지정되지 않았습니다.');
      setLoading(false);
      return;
    }

    const selectedRenderer = rendererRegistry.get(type);
    if (!selectedRenderer) {
      setError(`지원하지 않는 문서 타입입니다: ${type}`);
      setLoading(false);
      return;
    }

    setRenderer(selectedRenderer);
    loadDocuments(selectedRenderer, ids.split(','));
     
  }, [searchParams]);

  // postMessage 리스너 - 새 문서 추가
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 보안: origin 체크
      if (event.origin !== window.location.origin) {
        return;
      }

      // 메시지 타입 체크
      if (event.data?.type === 'ADD_DOCUMENTS') {
        const { documentType, documentIds } = event.data;

        // renderer 확인 또는 설정
        let currentRenderer = renderer;
        if (!currentRenderer) {
          const selectedRenderer = rendererRegistry.get(documentType);
          if (!selectedRenderer) {
            console.error(`지원하지 않는 문서 타입입니다: ${documentType}`);
            return;
          }
          currentRenderer = selectedRenderer;
          setRenderer(selectedRenderer);
        }

        // 새 문서 로딩
        try {
          const documentsPromises = documentIds.map(async (id: string) => {
            const data = await currentRenderer.loadDocument(id);
            return {
              id,
              title: currentRenderer.getTitle(data),
              summary: currentRenderer.getSummary(data),
              data
            };
          });

          const newDocuments = await Promise.all(documentsPromises);

          // 기존 문서 목록에 추가 (중복 제거)
          setDocuments(prev => {
            const existingIds = new Set(prev.map(doc => doc.id));
            const uniqueNewDocs = newDocuments.filter(doc => !existingIds.has(doc.id));
            return [...prev, ...uniqueNewDocs];
          });
        } catch (err) {
          console.error('Error loading new documents:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [renderer]);

  const loadDocuments = async (selectedRenderer: DocumentRenderer<any>, documentIds: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const documentsPromises = documentIds.map(async (id) => {
        const data = await selectedRenderer.loadDocument(id);
        return {
          id,
          title: selectedRenderer.getTitle(data),
          summary: selectedRenderer.getSummary(data),
          data
        };
      });

      const loadedDocuments = await Promise.all(documentsPromises);
      setDocuments(loadedDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err instanceof Error ? err.message : '문서를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // 인쇄 시작 시 즉시 모든 문서 제거
    setDocuments([]);

    // 프린트 대화상자 열기
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }


  // 에러가 있거나 renderer가 없으면 에러 화면 표시
  if (error || !renderer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || '문서를 찾을 수 없습니다.'}</Alert>
        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={handleClose}
          sx={{ mt: 2 }}
        >
          닫기
        </Button>
      </Box>
    );
  }

  // 항상 모든 문서의 모든 페이지 렌더링
  const allPagesData = documents.flatMap(doc => {
    const chunks = renderer.chunkPages(doc.data);
    return chunks.map((chunk, pageIndex) => ({
      doc,
      chunk,
      pageIndex,              // 이 문서 내에서의 페이지 인덱스
      totalPages: chunks.length  // 이 문서의 총 페이지 수
    }));
  });


  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      flexDirection: 'column',
      '@media print': {
        display: 'block',
        height: 'auto'
      }
    }}>
      {/* 헤더 - 인쇄 시 숨김 */}
      <Box
        className="no-print"
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '@media print': {
            display: 'none !important'
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PrintIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h5">
              JWS 프린트 센터
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
            >
              인쇄 시작
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={handleClose}
            >
              닫기
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 메인 컨텐츠 영역 */}
      <Box sx={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        '@media print': {
          display: 'block',
          overflow: 'visible'
        }
      }}>
        {/* 좌측 - 문서 목록 (인쇄 시 숨김) */}
        <Paper
          className="no-print"
          sx={{
            width: 300,
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'auto',
            '@media print': {
              display: 'none !important'
            }
          }}
        >
          <List>
            {documents.map((doc, index) => (
              <Box key={doc.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedIndex === index}
                    onClick={() => handleDocumentClick(index)}
                  >
                    <Checkbox
                      edge="start"
                      checked={true}
                      disabled
                      sx={{ mr: 1 }}
                    />
                    <ListItemText
                      primary={doc.title}
                      secondary={
                        <>
                          <Typography variant="caption" component="span" display="block">
                            {doc.summary}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </Box>
            ))}
          </List>
        </Paper>

        {/* 우측 - 미리보기 영역 */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'grey.100',
            '@media print': {
              bgcolor: 'white',
              p: 0,
              overflow: 'visible'
            }
          }}
        >
          {/* 인쇄용 스타일 */}
          <style>
            {`
              /* 페이지 구분자 - 화면에서는 숨김 */
              .page-break {
                display: none;
              }

              @media print {
                @page {
                  size: A4 portrait;
                  margin: 15mm 10mm;
                }

                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                }

                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                .no-print {
                  display: none !important;
                }

                [style*="position: fixed"],
                [style*="position:fixed"] {
                  display: none !important;
                }

                /* 각 페이지 스타일 */
                .print-page {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  display: block !important;
                  position: relative !important;
                }

                /* 페이지 구분자 - 인쇄 시 새 페이지 시작 */
                .page-break {
                  display: block !important;
                  page-break-after: always !important;
                  page-break-before: avoid !important;
                  break-after: page !important;
                  break-before: avoid !important;
                  height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                }
              }
            `}
          </style>

          {/* 미리보기 내용 - 모든 문서의 모든 페이지 연속 렌더링 */}
          <Box className="print-container">
            {allPagesData.map(({ doc, chunk, pageIndex, totalPages }, globalIndex) => {
              // 각 문서의 첫 페이지에만 ID 부여 (스크롤 타겟)
              const isFirstPage = pageIndex === 0;
              const isLastPage = globalIndex === allPagesData.length - 1;

              return (
                <React.Fragment key={`${doc.id}-${pageIndex}`}>
                  {renderer.renderPage(
                    doc.data,
                    chunk,
                    pageIndex,
                    totalPages,
                    `${doc.id}-${pageIndex}`,
                    isFirstPage ? `document-${doc.id}` : undefined,
                    isLastPage
                  )}
                  {/* 마지막 페이지가 아니면 페이지 구분자 추가 */}
                  {!isLastPage && <div className="page-break" />}
                </React.Fragment>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default PrintCenter;
