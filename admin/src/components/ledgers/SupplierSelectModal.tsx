/**
 * 파일 경로: /src/components/ledgers/SupplierSelectModal.tsx
 * 작성 날짜: 2025-10-17
 * 주요 내용: 공급사 선택 모달 (실시간 검색 지원)
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
import type { Supplier } from '../../types/company';

interface SupplierSelectModalProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelect: (supplierId: string) => void;
}

const SupplierSelectModal: React.FC<SupplierSelectModalProps> = ({
  open,
  onClose,
  suppliers,
  selectedSupplierId,
  onSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 실시간 검색 필터링
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.businessNumber.includes(searchTerm)
  );

  const handleSelect = (supplierId: string) => {
    onSelect(supplierId);
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
        공급사 선택
      </DialogTitle>
      <DialogContent>
        {/* 검색 입력 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="공급사명 또는 사업자번호로 검색"
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

        {/* 공급사 목록 */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }} dense>
          {filteredSuppliers.length > 0 ? (
            filteredSuppliers.map((supplier) => (
              <ListItem key={supplier.businessNumber} disablePadding>
                <ListItemButton
                  onClick={() => handleSelect(supplier.businessNumber)}
                  selected={selectedSupplierId === supplier.businessNumber}
                >
                  <Radio
                    checked={selectedSupplierId === supplier.businessNumber}
                    value={supplier.businessNumber}
                    sx={{ mr: 1 }}
                    size="small"
                  />
                  <ListItemText
                    primary={`${supplier.businessName} (${supplier.businessNumber})`}
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

export default SupplierSelectModal;
