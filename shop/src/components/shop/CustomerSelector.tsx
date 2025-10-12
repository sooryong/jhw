/**
 * 파일 경로: /src/components/shop/CustomerSelector.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 다중 고객사 선택 컴포넌트
 * 관련 데이터: users.customerBusinessNumbers, customers
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Business as BusinessIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { customerService } from '../../services/customerService';
import type { Customer } from '../../types/company';

interface CustomerSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (businessNumber: string) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { user, getAvailableCustomers } = useAuth();

  // URL 파라미터에서 현재 선택된 고객사 읽기
  const getSelectedCustomer = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('customer');
  };

  // 상태 관리
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedBusinessNumber, setSelectedBusinessNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const availableBusinessNumbers = getAvailableCustomers();
      if (availableBusinessNumbers.length === 0) {
        setError('연결된 고객사가 없습니다.');
        return;
      }

      // 연결된 고객사들의 상세 정보 조회
      const customerPromises = availableBusinessNumbers.map(businessNumber =>
        customerService.getCustomer(businessNumber)
      );

      const customerResults = await Promise.all(customerPromises);
      const validCustomers = customerResults.filter(customer => customer !== null) as Customer[];

      setCustomers(validCustomers);

    } catch (err) {
      console.error('고객사 목록 로드 실패:', err);
      setError('고객사 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [getAvailableCustomers]);

  // 초기 로드
  useEffect(() => {
    if (open) {
      loadCustomers();
      setSelectedBusinessNumber(getSelectedCustomer() || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadCustomers]);

  const handleSelect = () => {
    if (selectedBusinessNumber) {
      onSelect(selectedBusinessNumber);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedBusinessNumber(getSelectedCustomer() || '');
    onClose();
  };

  if (!user || user.role !== 'customer') {
    return null;
  }

  const availableCustomers = getAvailableCustomers();
  const currentSelected = getSelectedCustomer();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BusinessIcon />
        고객사 선택
      </DialogTitle>
      <DialogContent>
        {/* 현재 선택된 고객사 표시 */}
        {currentSelected && (
          <Alert severity="info" sx={{ mb: 2 }}>
            현재 선택: {customers.find(c => c.businessNumber === currentSelected)?.businessName || currentSelected}
          </Alert>
        )}

        {/* 다중 고객사 안내 */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          이 계정은 {availableCustomers.length}개의 고객사에 연결되어 있습니다.
          쇼핑몰을 이용할 고객사를 선택해주세요.
        </Typography>

        {/* 에러 메시지 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 로딩 표시 */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          /* 고객사 선택 폼 */
          (<FormControl fullWidth>
            <InputLabel>고객사 선택</InputLabel>
            <Select
              value={selectedBusinessNumber}
              label="고객사 선택"
              onChange={(e) => setSelectedBusinessNumber(e.target.value)}
            >
              {customers.map((customer) => (
                <MenuItem
                  key={customer.businessNumber}
                  value={customer.businessNumber}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {customer.businessName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {customer.businessNumber} | {customer.customerType}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>)
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          취소
        </Button>
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedBusinessNumber || loading}
          startIcon={<SwapIcon />}
        >
          선택
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerSelector;