/**
 * 파일 경로: /src/components/ledgers/CustomerSelectModal.tsx
 * 작성 날짜: 2025-10-16
 * 주요 내용: 고객사 선택 모달 (실시간 검색 지원)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Box,
  Typography,
  InputAdornment,
  Radio
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { Customer } from '../../types/company';

interface CustomerSelectModalProps {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomerId: string;
  onSelect: (customerId: string) => void;
}

const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  open,
  onClose,
  customers,
  selectedCustomerId,
  onSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 실시간 검색 필터링
  const filteredCustomers = customers.filter(customer =>
    customer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.businessNumber.includes(searchTerm)
  );

  const handleSelect = (customerId: string) => {
    onSelect(customerId);
    setSearchTerm(''); // 검색어 초기화
    onClose();
  };

  const handleCancel = () => {
    setSearchTerm(''); // 검색어 초기화
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        고객사 선택
      </DialogTitle>
      <DialogContent>
        {/* 검색 입력 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="고객사명 또는 사업자번호로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            autoFocus
          />
        </Box>

        {/* 고객사 목록 */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }} dense>
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <ListItem key={customer.businessNumber} disablePadding>
                <ListItemButton
                  onClick={() => handleSelect(customer.businessNumber)}
                  selected={selectedCustomerId === customer.businessNumber}
                >
                  <Radio
                    checked={selectedCustomerId === customer.businessNumber}
                    value={customer.businessNumber}
                    sx={{ mr: 1 }}
                    size="small"
                  />
                  <ListItemText
                    primary={`${customer.businessName} (${customer.businessNumber})`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              </ListItem>
            ))
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                검색 결과가 없습니다
              </Typography>
            </Box>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerSelectModal;
