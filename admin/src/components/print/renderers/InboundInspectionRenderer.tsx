/**
 * 파일 경로: /src/components/print/renderers/InboundInspectionRenderer.tsx
 * 작성 날짜: 2025-10-09
 * 주요 내용: 입고 검수표 렌더러
 */

import type { ReactNode } from 'react';
import { Typography, Box } from '@mui/material';
import { format } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { purchaseOrderService } from '../../../services/purchaseOrderService';
import type { PurchaseOrder, PurchaseOrderItem } from '../../../types/purchaseOrder';
import type { Product } from '../../../types/product';
import type { DocumentRenderer } from '../types';

interface InboundInspectionData {
  order: PurchaseOrder;
  items: (PurchaseOrderItem & { category?: string })[];
}

class InboundInspectionRendererClass implements DocumentRenderer<InboundInspectionData> {
  type = 'inbound-inspection' as const;

  async loadDocument(id: string): Promise<InboundInspectionData> {
    const order = await purchaseOrderService.getPurchaseOrderById(id);

    if (!order) {
      throw new Error(`매입주문 ${id}를 찾을 수 없습니다.`);
    }

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

  chunkPages(data: InboundInspectionData): (PurchaseOrderItem & { category?: string })[][] {
    const ITEMS_PER_PAGE = 17;
    const chunks: (PurchaseOrderItem & { category?: string })[][] = [];

    for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
      const chunk: (PurchaseOrderItem & { category?: string })[] = data.items.slice(
        i,
        i + ITEMS_PER_PAGE
      );

      // 17개 미만이면 undefined로 채워서 17개로 만듦
      while (chunk.length < ITEMS_PER_PAGE) {
        chunk.push(undefined as unknown as PurchaseOrderItem & { category?: string });
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
    data: InboundInspectionData,
    chunk: (PurchaseOrderItem & { category?: string })[],
    pageIndex: number,
    totalPages: number,
    key: string,
    id?: string,
    _isLastPage?: boolean
  ): ReactNode {
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
        <Box>
          {/* 머릿글 */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              JWS 플랫폼
            </Typography>
          </Box>

          {/* 제목 */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              일일주문 입고 검수표
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
                매입주문:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {data.order.purchaseOrderNumber}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderBottom: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                발주일시:
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
                {data.order.status === 'completed' ? '입고완료' : '확정'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                공급사:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                {data.order.supplierInfo.businessName}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                검수일:
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
                gridTemplateColumns: '12% 1fr 18% 8% 12% 12%',
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
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  단가
                </Typography>
              </Box>
              <Box sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                  검수 확인
                </Typography>
              </Box>
            </Box>

            {/* 테이블 바디 */}
            {chunk.map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '12% 1fr 18% 8% 12% 12%',
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
                <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', bgcolor: 'grey.50' }} />
                <Box sx={{ p: 1, bgcolor: 'grey.50' }} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* 하단 확인표 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '40% 20% 40%', border: 1, borderColor: 'divider', mt: 2 }}>
          <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', minHeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '80px' }}>
              공급사 확인:
            </Typography>
            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', height: 50, bgcolor: 'grey.50' }} />
          </Box>
          <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              페이지
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              {currentPage}/{totalPages}
            </Typography>
          </Box>
          <Box sx={{ p: 1, minHeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '80px' }}>
              검수자 확인:
            </Typography>
            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', height: 50, bgcolor: 'grey.50' }} />
          </Box>
        </Box>
      </Box>
    );
  }

  getTitle(data: InboundInspectionData): string {
    return data.order.purchaseOrderNumber;
  }

  getSummary(data: InboundInspectionData): string {
    return `${data.order.supplierInfo.businessName} • ${data.items.length}품목`;
  }
}

export const InboundInspectionRenderer = new InboundInspectionRendererClass();
