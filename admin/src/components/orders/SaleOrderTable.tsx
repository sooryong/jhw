/**
 * 파일 경로: /src/components/orders/SaleOrderTable.tsx
 * 작성 날짜: 2025-10-04
 * 주요 내용: 매출주문 테이블 컴포넌트
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Chip,
  Typography,
  Box,
  Collapse,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import dailyFoodPurchaseAggregationService from '../../services/dailyFoodPurchaseAggregationService';
import type { SaleOrder } from '../../types/saleOrder';
import { formatCurrency } from '../../utils/formatUtils';

interface SaleOrderTableProps {
  date: Date;
  statusFilter: 'all' | 'placed' | 'confirmed' | 'completed';
}

const SaleOrderTable = ({ date, statusFilter }: SaleOrderTableProps) => {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // 데이터 로드
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const allOrders = await dailyFoodPurchaseAggregationService.getSaleOrdersByDate(date);

      // 상태 필터 적용
      const filtered =
        statusFilter === 'all'
          ? allOrders
          : allOrders.filter(order => order.status === statusFilter);

      setOrders(filtered);
    } catch (error) {
      // Error handled silently
      console.error('Error loading sale orders:', error);
    } finally {
      setLoading(false);
    }
  }, [date, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRowClick = (orderId: string) => {
    setExpandedRow(expandedRow === orderId ? null : orderId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed':
        return 'info';
      case 'confirmed':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'placed':
        return '주문접수';
      case 'confirmed':
        return '확정';
      case 'completed':
        return '완료';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (orders.length === 0) {
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
        매출주문이 없습니다.
      </Typography>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }} />
              <TableCell sx={{ fontWeight: 600 }}>주문번호</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>고객사</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                품목 수
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                주문금액
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                상태
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>주문일시</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(order => (
              <>
                <TableRow
                  key={order.saleOrderNumber}
                  hover
                  onClick={() => handleRowClick(order.saleOrderNumber)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <IconButton size="small">
                      {expandedRow === order.saleOrderNumber ? (
                        <KeyboardArrowUpIcon />
                      ) : (
                        <KeyboardArrowDownIcon />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {order.saleOrderNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{order.customerInfo.businessName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.customerInfo.customerType}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{order.itemCount}개</TableCell>
                  <TableCell align="right">{formatCurrency(order.finalAmount)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {format(order.placedAt.toDate(), 'yyyy-MM-dd')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(order.placedAt.toDate(), 'HH:mm:ss')}
                    </Typography>
                  </TableCell>
                </TableRow>

                {/* 상세 행 */}
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={expandedRow === order.saleOrderNumber} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 2 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          주문 상품
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>상품명</TableCell>
                              <TableCell>규격</TableCell>
                              <TableCell align="right">단가</TableCell>
                              <TableCell align="right">수량</TableCell>
                              <TableCell align="right">소계</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {order.orderItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.specification}</TableCell>
                                <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                                <TableCell align="right">{item.quantity}</TableCell>
                                <TableCell align="right">{formatCurrency(item.lineTotal)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={orders.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="페이지당 행:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
      />
    </Box>
  );
};

export default SaleOrderTable;
