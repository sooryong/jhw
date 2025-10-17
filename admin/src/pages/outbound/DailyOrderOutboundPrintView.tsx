/**
 * 파일 경로: /src/pages/outbound/DailyOrderOutboundPrintView.tsx
 * 작성 날짜: 2025-10-13
 * 주요 내용: 일일주문 출하 검수서 인쇄 뷰
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress
} from '@mui/material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { SaleOrder } from '../../types/saleOrder';

const DailyOrderOutboundPrintView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;

      try {
        const q = query(
          collection(db, 'saleOrders'),
          where('saleOrderNumber', '==', orderId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          setSaleOrder(snapshot.docs[0].data() as SaleOrder);
        }
      } catch (error) {
      // Error handled silently
        console.error('Error loading sale order:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (saleOrder && !loading) {
      // 데이터 로드 후 자동 인쇄
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [saleOrder, loading]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!saleOrder) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>매출주문을 찾을 수 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: '210mm', mx: 'auto', '@media print': { p: 0 } }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          출하 검수서
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {new Date().toLocaleDateString('ko-KR')}
        </Typography>
      </Box>

      {/* 주문 정보 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              매출주문 코드
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleOrder.saleOrderNumber}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              고객사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {saleOrder.customerInfo.businessName}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 출하 품목 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>상품명</TableCell>
              <TableCell>규격</TableCell>
              <TableCell align="right">주문수량</TableCell>
              <TableCell align="right">출하수량</TableCell>
              <TableCell align="right">단가</TableCell>
              <TableCell align="right">금액</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {saleOrder.orderItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.specification || '-'}</TableCell>
                <TableCell align="right">{item.quantity.toLocaleString()}</TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #000' }}>
                  {/* 출하수량 기록란 */}
                </TableCell>
                <TableCell align="right">{item.unitPrice.toLocaleString()}</TableCell>
                <TableCell align="right">{item.lineTotal.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5} align="right">
                <strong>합계</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{saleOrder.finalAmount.toLocaleString()}원</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* 서명란 */}
      <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <Box>
          <Typography variant="body2" gutterBottom>
            출하 담당자:
          </Typography>
          <Box sx={{ borderBottom: '1px solid #000', height: 40 }} />
        </Box>
        <Box>
          <Typography variant="body2" gutterBottom>
            확인자:
          </Typography>
          <Box sx={{ borderBottom: '1px solid #000', height: 40 }} />
        </Box>
      </Box>
    </Box>
  );
};

export default DailyOrderOutboundPrintView;
