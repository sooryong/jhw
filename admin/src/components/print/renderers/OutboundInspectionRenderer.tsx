/**
 * 파일 경로: /src/components/print/renderers/OutboundInspectionRenderer.tsx
 * 작성 날짜: 2025-10-16
 * 주요 내용: 출하 검수표 (매출주문서) 렌더러
 */

import type { ReactNode } from 'react';
import { Typography, Box } from '@mui/material';
import { format } from 'date-fns';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { SaleOrder, OrderItem } from '../../../types/saleOrder';
import type { Product } from '../../../types/product';
import type { DocumentRenderer } from '../types';

interface OutboundInspectionData {
  order: SaleOrder;
  items: (OrderItem & { category?: string })[];
}

class OutboundInspectionRendererClass implements DocumentRenderer<OutboundInspectionData> {
  type = 'outbound-inspection' as const;

  async loadDocument(id: string): Promise<OutboundInspectionData> {
    // saleOrderNumber로 매출주문 조회
    const q = query(
      collection(db, 'saleOrders'),
      where('saleOrderNumber', '==', id)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error(`매출주문 ${id}를 찾을 수 없습니다.`);
    }

    const order = snapshot.docs[0].data() as SaleOrder;

    // 각 상품의 카테고리 조회
    const itemsPromises = order.orderItems.map(async (item) => {
      try {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await getDoc(productRef);
        const product = productDoc.exists() ? (productDoc.data() as Product) : null;

        return {
          ...item,
          category: product?.mainCategory || '미분류'
        };
      } catch (err) {
        console.error('Error loading product category:', err);
        return {
          ...item,
          category: '미분류'
        };
      }
    });

    const items = await Promise.all(itemsPromises);

    return { order, items };
  }

  chunkPages(data: OutboundInspectionData): unknown[][] {
    const ITEMS_PER_PAGE = 17;
    const chunks: (OrderItem & { category?: string })[][] = [];

    for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
      const chunk: (OrderItem & { category?: string })[] = data.items.slice(
        i,
        i + ITEMS_PER_PAGE
      );

      // 17개 미만이면 undefined로 채워서 17개로 만듦
      while (chunk.length < ITEMS_PER_PAGE) {
        chunk.push(undefined as unknown as OrderItem & { category?: string });
      }
      chunks.push(chunk);
    }

    // 품목이 없는 경우 빈 페이지 1개 생성
    if (chunks.length === 0) {
      chunks.push(Array(ITEMS_PER_PAGE).fill(undefined));
    }

    return chunks;
  }

  renderPage(
    data: OutboundInspectionData,
    chunk: unknown[],
    pageIndex: number,
    totalPages: number,
    key: string,
    id?: string
  ): ReactNode {
    const typedChunk = chunk as (OrderItem & { category?: string })[];
    const currentPage = pageIndex + 1;

    return (
      <Box
        key={key}
        id={id}
        className="print-page"
        sx={{
          maxWidth: '210mm',
          margin: '0 auto',
          mb: pageIndex < totalPages - 1 ? 3 : 0,
          border: 1,
          borderColor: 'divider',
          p: 3,
          bgcolor: 'background.paper',
          '@media print': {
            border: 'none',
            p: 0,
            mb: 0,
            margin: 0,
            maxWidth: 'none',
            width: '100%',
            bgcolor: 'transparent'
          }
        }}
      >
        <Box sx={{
          minHeight: '297mm',
          display: 'flex',
          flexDirection: 'column',
          '@media print': {
            minHeight: '297mm'
          }
        }}>
          {/* 머릿글 */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              JHW 플랫폼
            </Typography>
          </Box>

          {/* 제목 */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              매출주문 출하 검수표
            </Typography>
          </Box>

          {/* 주문 정보 */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              mb: 2,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderBottom: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                매출주문:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {data.order.saleOrderNumber}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderBottom: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                생성일시:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {format(data.order.placedAt.toDate(), 'yyyy-MM-dd HH:mm')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                상태:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  textAlign: 'right',
                  color: data.order.status === 'completed' ? 'success.main' : 'primary.main'
                }}
              >
                {data.order.status === 'completed' ? '출하완료' : '확정'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                고객사:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {data.order.customerInfo.businessName}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                출하일:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {format(new Date(), 'yyyy-MM-dd')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                페이지:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {currentPage} / {totalPages}
              </Typography>
            </Box>
          </Box>

          {/* 품목 테이블 */}
          <Box sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            {/* 테이블 헤더 */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '12% 1fr 18% 12% 15%',
                bgcolor: 'grey.100',
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  카테고리
                </Typography>
              </Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  상품명
                </Typography>
              </Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  규격
                </Typography>
              </Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  수량
                </Typography>
              </Box>
              <Box sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  피킹 수량
                </Typography>
              </Box>
            </Box>

            {/* 테이블 바디 */}
            {typedChunk.map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '12% 1fr 18% 12% 15%',
                  borderBottom: idx < chunk.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  minHeight: 40
                }}
              >
                <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                    {item?.category || ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {item?.productName || ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {item?.specification || ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {item?.quantity || ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, bgcolor: 'grey.50' }} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* 하단 확인표 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '40% 20% 40%', border: 1, borderColor: 'divider', mt: 2 }}>
          <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', minHeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '80px' }}>
              담당자 확인:
            </Typography>
            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', height: 50, bgcolor: 'grey.50' }} />
          </Box>
          <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              {currentPage}/{totalPages}
            </Typography>
          </Box>
          <Box sx={{ p: 1, minHeight: 70, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '50%', display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                주문 수량:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {data.items.reduce((sum, item) => sum + (item?.quantity || 0), 0)}
              </Typography>
            </Box>
            <Box sx={{ width: '50%', display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                피킹 수량:
              </Typography>
              <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider', height: 24 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  getTitle(data: OutboundInspectionData): string {
    return data.order.saleOrderNumber;
  }

  getSummary(data: OutboundInspectionData): string {
    return `${data.order.customerInfo.businessName} • ${data.items.length}품목`;
  }
}

export const OutboundInspectionRenderer = new OutboundInspectionRendererClass();
