/**
 * 파일 경로: /src/components/orders/SaleOrderDetailDialog.tsx
 * 작성 날짜: 2025-10-11
 * 주요 내용: 매출주문 상세 다이얼로그
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { SaleOrder } from '../../types/saleOrder';
import type { Customer } from '../../types/company';
import { confirmSaleOrder, updateSaleOrderStatus } from '../../services/saleOrderService';

interface SaleOrderDetailDialogProps {
  open: boolean;
  order: SaleOrder | null;
  onClose: () => void;
  onStatusChanged?: () => void;
}

const SaleOrderDetailDialog = ({
  open,
  order,
  onClose
}: SaleOrderDetailDialogProps) => {

  // 상태 관리
  const [currentStatus, setCurrentStatus] = useState<SaleOrder['status']>(order?.status || 'placed');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [customer, setCustomer] = useState<Customer | null>(null);

  // 케밥 메뉴
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // 상태 변경 모달
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'placed' | 'confirmed' | 'pended' | 'rejected'>('placed');
  const [statusChanging, setStatusChanging] = useState(false);

  // order가 변경될 때 currentStatus 동기화 및 customer 정보 조회
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);

      // Customer 정보 조회
      const fetchCustomer = async () => {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', order.customerId));
          if (customerDoc.exists()) {
            setCustomer(customerDoc.data() as Customer);
          }
        } catch (error) {
          console.error('Error fetching customer:', error);
        }
      };

      fetchCustomer();
    }
  }, [order]);

  if (!order) return null;

  // 합계 계산
  const totalQuantity = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // 주문 상품 컬럼 정의
  const orderItemColumns: GridColDef[] = [
    {
      field: 'productName',
      headerName: `상품명 (${order.itemCount})`,
      flex: 0.35,
      minWidth: 200
    },
    {
      field: 'specification',
      headerName: '규격',
      flex: 0.20,
      minWidth: 120
    },
    {
      field: 'quantity',
      headerName: `수량 (${totalQuantity.toLocaleString()})`,
      flex: 0.15,
      minWidth: 80,
      align: 'center',
      headerAlign: 'center',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'unitPrice',
      headerName: '단가',
      flex: 0.15,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    },
    {
      field: 'lineTotal',
      headerName: '소계',
      flex: 0.15,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: unknown) => (value as number)?.toLocaleString()
    }
  ];

  // 주문 상품 데이터 (id 추가)
  const orderItemsWithId = order.orderItems.map((item, index) => ({
    id: index + 1,
    ...item
  }));

  // 짧은 날짜 포맷 (MM/DD HH:MM)
  const formatDateShort = (timestamp: unknown) => {
    const date = (timestamp as { toDate?: () => Date }).toDate ? (timestamp as { toDate: () => Date }).toDate() : new Date(timestamp as string | number | Date);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // 케밥 메뉴 핸들러
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChangeClick = () => {
    handleMenuClose();
    // 현재 상태를 선택된 상태로 설정
    if (currentStatus === 'placed' || currentStatus === 'confirmed' || currentStatus === 'pended' || currentStatus === 'rejected') {
      setSelectedStatus(currentStatus);
    } else {
      setSelectedStatus('placed');
    }
    setStatusChangeModalOpen(true);
  };

  // 상태 변경
  const handleStatusChange = async () => {
    if (!order) return;
    setStatusChanging(true);
    try {
      // placed → confirmed 전환 시 재고 확인
      if (currentStatus === 'placed' && selectedStatus === 'confirmed') {
        await confirmSaleOrder(order.saleOrderNumber);
      } else {
        await updateSaleOrderStatus(order.saleOrderNumber, selectedStatus);
      }

      // 로컬 상태 업데이트
      setCurrentStatus(selectedStatus);

      const statusMessages: Record<string, string> = {
        placed: '접수',
        confirmed: '확정',
        pended: '보류',
        rejected: '거절'
      };

      setSnackbar({
        open: true,
        message: `상태가 ${statusMessages[selectedStatus]}(으)로 변경되었습니다.`,
        severity: 'success'
      });

      // 상태 변경 모달만 닫기 (메인 모달은 유지)
      setStatusChangeModalOpen(false);
    } catch (error) {
      console.error('상태 변경 실패:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setStatusChanging(false);
    }
  };

  // 상태 칩 표시
  const getStatusChip = () => {
    const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }> = {
      placed: { label: '접수', color: 'default' },
      confirmed: { label: '확정', color: 'primary' },
      pended: { label: '보류', color: 'warning' },
      rejected: { label: '거절', color: 'error' },
      completed: { label: '완료', color: 'success' }
    };
    const status = statusMap[currentStatus] || { label: currentStatus, color: 'default' };
    return <Chip label={status.label} color={status.color} size="small" />;
  };

  // 커스텀 DataGrid Footer (페이지네이션만)
  const CustomFooter = () => {
    return (
      <GridFooterContainer>
        <GridPagination />
      </GridFooterContainer>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{
          fontWeight: 600,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
            매출주문 확정 - {order.saleOrderNumber}({formatDateShort(order.placedAt)})
          </Typography>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              color: 'white',
              borderColor: 'white',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            닫기
          </Button>
        </Box>

        <DialogContent sx={{ pt: 1 }}>
          {/* 주문 기본 정보 */}
          <Box sx={{
            mb: 1,
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 1,
            position: 'relative'
          }}>
            {/* 케밥 메뉴 */}
            <IconButton
              onClick={handleMenuClick}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8
              }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleStatusChangeClick}>상태 변경</MenuItem>
            </Menu>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" color="text.secondary">
                  고객사
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {order.customerInfo.businessName}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  대표자
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {customer?.president || '-'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  고객 유형
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {order.customerInfo.customerType}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  주문금액
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {order.finalAmount.toLocaleString()}원
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  상태
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {getStatusChip()}
                </Box>
              </Box>
            </Box>
          </Box>

        {/* 주문 상품 목록 */}
        <Box>
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={orderItemsWithId}
              columns={orderItemColumns}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } }
              }}
              pageSizeOptions={[10, 20, 30]}
              disableRowSelectionOnClick
              rowHeight={38}
              slots={{
                footer: CustomFooter
              }}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiDataGrid-cell': {
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: 'grey.100',
                  borderColor: 'divider',
                },
              }}
            />
          </Box>
        </Box>
      </DialogContent>

        {/* 알림 스낵바 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog
        open={statusChangeModalOpen}
        onClose={() => setStatusChangeModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            상태 변경
          </Typography>
          <IconButton onClick={() => setStatusChangeModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent>
          <RadioGroup
            row
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'placed' | 'confirmed' | 'pended' | 'rejected')}
            sx={{ justifyContent: 'center', gap: 2 }}
          >
            <FormControlLabel
              value="placed"
              control={<Radio disabled={statusChanging} />}
              label="접수"
            />
            <FormControlLabel
              value="confirmed"
              control={<Radio disabled={statusChanging} />}
              label="확정"
            />
            <FormControlLabel
              value="pended"
              control={<Radio disabled={statusChanging} />}
              label="보류"
            />
            <FormControlLabel
              value="rejected"
              control={<Radio disabled={statusChanging} />}
              label="거절"
            />
          </RadioGroup>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setStatusChangeModalOpen(false)} variant="outlined" disabled={statusChanging}>
            취소
          </Button>
          <Button
            onClick={handleStatusChange}
            variant="contained"
            disabled={statusChanging}
            startIcon={statusChanging ? <CircularProgress size={16} /> : null}
          >
            {statusChanging ? '변경 중...' : '상태 변경'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SaleOrderDetailDialog;
