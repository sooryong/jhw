/**
 * 파일 경로: /src/pages/inbound/DailyOrderInboundPrintView.tsx
 * 작성 날짜: 2025-10-06
 * 주요 내용: 일일주문 입고 검수표 인쇄 뷰 (A4 세로)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Print as PrintIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/purchaseOrder';
import type { Product } from '../../types/product';
import { format } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const DailyOrderInboundPrintView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [itemsWithCategory, setItemsWithCategory] = useState<(PurchaseOrderItem & { category?: string })[]>([]);

  useEffect(() => {
    if (orderId) {
      loadPurchaseOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const loadPurchaseOrder = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const order = await purchaseOrderService.getPurchaseOrderById(orderId);

      if (!order) {
        setError('매입주문을 찾을 수 없습니다.');
        return;
      }

      setPurchaseOrder(order);

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
      setItemsWithCategory(items);
    } catch (err) {
      console.error('Error loading purchase order:', err);
      setError('매입주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 품목을 17개씩 청크로 분할하고, 각 청크를 17개로 패딩
  const chunkItems = (items: (PurchaseOrderItem & { category?: string })[], size: number = 17): ((PurchaseOrderItem & { category?: string }) | undefined)[][] => {
    const chunks: ((PurchaseOrderItem & { category?: string }) | undefined)[][] = [];
    for (let i = 0; i < items.length; i += size) {
      const chunk: ((PurchaseOrderItem & { category?: string }) | undefined)[] = items.slice(i, i + size);
      // 17개 미만이면 undefined로 채워서 17개로 만듦
      while (chunk.length < size) {
        chunk.push(undefined);
      }
      chunks.push(chunk);
    }
    // 품목이 없는 경우 빈 페이지 1개 생성
    if (chunks.length === 0) {
      chunks.push(Array(size).fill(null));
    }
    return chunks;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !purchaseOrder) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || '매입주문을 찾을 수 없습니다.'}</Alert>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/orders/inbound')}
          sx={{ mt: 2 }}
        >
          목록으로
        </Button>
      </Box>
    );
  }

  const itemChunks = chunkItems(itemsWithCategory);
  const totalPages = itemChunks.length;

  return (
    <>
      {/* 인쇄 시 숨김 버튼 */}
      <Box
        className="no-print"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          '@media print': {
            display: 'none !important'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            onClick={() => navigate('/orders/inbound')}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <BackIcon />
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrintIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h5" component="h1">
              일일주문 입고 검수표 인쇄
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            인쇄
          </Button>
          <Button
            variant="outlined"
            onClick={loadPurchaseOrder}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 인쇄용 스타일 */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm 10mm;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body {
              margin: 0 !important;
              padding: 0 !important;
            }

            /* no-print 클래스 숨김 */
            .no-print {
              display: none !important;
            }

            /* MUI Box with position fixed 숨김 (사이드바) */
            [style*="position: fixed"],
            [style*="position:fixed"] {
              display: none !important;
            }

            .print-page {
              page-break-after: always;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              position: relative;
            }

            .print-page:last-child {
              page-break-after: avoid;
            }

            .print-content {
              flex: 1;
            }

            .signature-table {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
            }
          }
        `}
      </style>

      {/* 각 페이지 렌더링 */}
      {itemChunks.map((items, pageIndex) => {
        const currentPage = pageIndex + 1;

        return (
          <Box
            key={pageIndex}
            className="print-page"
            sx={{
              maxWidth: '210mm',
              margin: '0 auto',
              p: 3,
              '@media print': {
                p: 0,
                margin: '0 auto',
                maxWidth: '190mm'
              }
            }}
          >
            <Box className="print-content">
              {/* 인쇄 페이지 제목 */}
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 'bold',
                    fontSize: { xs: '1.5rem', print: '1.75rem' }
                  }}
                >
                  일일주문 입고 검수표
                </Typography>
              </Box>

              {/* 주문 정보 - 3x2 그리드 */}
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
                    {purchaseOrder.purchaseOrderNumber}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderBottom: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                    발주일시:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                    {format(purchaseOrder.placedAt.toDate(), 'yyyy-MM-dd HH:mm')}
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
                      color: purchaseOrder.status === 'completed' ? 'success.main' : 'primary.main'
                    }}
                  >
                    {purchaseOrder.status === 'completed' ? '입고완료' : '확정'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: 1, borderColor: 'divider', p: 1, minHeight: 50 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                    공급사:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right' }}>
                    {purchaseOrder.supplierInfo.businessName}
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
                    {pageIndex + 1} / {totalPages}
                  </Typography>
                </Box>
              </Box>

              {/* 주문 품목 테이블 */}
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small" sx={{ tableLayout: 'auto' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        align="center"
                        sx={{
                          width: '12%',
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        카테고리
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        상품명
                      </TableCell>
                      <TableCell
                        sx={{
                          width: '18%',
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        규격
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: '8%',
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        수량
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: '12%',
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        단가
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: '12%',
                          fontWeight: 'bold',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.100',
                          fontSize: '0.875rem'
                        }}
                      >
                        검수 확인
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx} sx={{ height: 40 }}>
                        <TableCell
                          align="center"
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            fontSize: '0.75rem',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 0.5
                          }}
                        >
                          {item?.category || ''}
                        </TableCell>
                        <TableCell
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            fontSize: '0.875rem',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 1
                          }}
                        >
                          {item?.productName || ''}
                        </TableCell>
                        <TableCell
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            fontSize: '0.875rem',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 1
                          }}
                        >
                          {item?.specification || ''}
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            fontSize: '0.875rem',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 1
                          }}
                        >
                          {item?.quantity || ''}
                        </TableCell>
                        <TableCell
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'grey.50',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 1
                          }}
                        >
                          {/* 공란 - 수기 작성용 */}
                        </TableCell>
                        <TableCell
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'grey.50',
                            height: 40,
                            verticalAlign: 'middle',
                            p: 1
                          }}
                        >
                          {/* 공란 - 수기 체크용 */}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 하단 확인표 - 3개 컬럼 */}
            <Box className="signature-table">
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableBody>
                  <TableRow sx={{ height: 70 }}>
                    {/* 공급사 확인 (40%) */}
                    <TableCell
                      sx={{
                        width: '40%',
                        border: 1,
                        borderColor: 'divider',
                        height: 70,
                        verticalAlign: 'middle',
                        p: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '80px' }}>
                          공급사 확인:
                        </Typography>
                        <Box
                          sx={{
                            flex: 1,
                            border: 1,
                            borderColor: 'divider',
                            height: 50,
                            bgcolor: 'grey.50'
                          }}
                        />
                      </Box>
                    </TableCell>

                    {/* 페이지 (20%) */}
                    <TableCell
                      sx={{
                        width: '20%',
                        border: 1,
                        borderColor: 'divider',
                        height: 70,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        p: 1
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                        페이지
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {currentPage}/{totalPages}
                      </Typography>
                    </TableCell>

                    {/* 검수자 확인 (40%) */}
                    <TableCell
                      sx={{
                        width: '40%',
                        border: 1,
                        borderColor: 'divider',
                        height: 70,
                        verticalAlign: 'middle',
                        p: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '80px' }}>
                          검수자 확인:
                        </Typography>
                        <Box
                          sx={{
                            flex: 1,
                            border: 1,
                            borderColor: 'divider',
                            height: 50,
                            bgcolor: 'grey.50'
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Box>
        );
      })}
    </>
  );
};

export default DailyOrderInboundPrintView;
