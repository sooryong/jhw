/**
 * 파일 경로: /src/components/ledgers/PaymentRegistrationModal.tsx
 * 작성 날짜: 2025-10-17
 * 주요 내용: 수금 등록 모달
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { createCollection } from '../../services/customerCollectionService';
import { COLLECTION_METHOD_LABELS, type CollectionMethod } from '../../types/customerCollection';
import { useAuth } from '../../hooks/useAuth';

interface PaymentRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

const PaymentRegistrationModal: React.FC<PaymentRegistrationModalProps> = ({
  open,
  onClose,
  customerId,
  customerName,
  onSuccess
}) => {
  const { user } = useAuth();
  const [collectionDate, setPaymentDate] = useState<Date | null>(new Date());
  const [collectionAmount, setPaymentAmount] = useState<string>('');
  const [collectionMethod, setCollectionMethod] = useState<CollectionMethod>('bank_transfer');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setPaymentDate(new Date());
    setPaymentAmount('');
    setCollectionMethod('bank_transfer');
    setNotes('');
    setError(null);
  };

  // 금액 입력 처리 (실시간 천단위 포맷)
  const handleAmountChange = (value: string) => {
    // 숫자만 추출
    const numericValue = value.replace(/[^\d]/g, '');

    // 숫자가 있으면 천단위 구분 쉼표 추가
    if (numericValue) {
      const formatted = parseInt(numericValue, 10).toLocaleString();
      setPaymentAmount(formatted);
    } else {
      setPaymentAmount('');
    }
  };

  const handleSubmit = async () => {
    // 입력 검증
    if (!collectionDate) {
      setError('수금 일시를 선택해주세요.');
      return;
    }

    // 쉼표 제거 후 숫자로 변환
    const numericValue = collectionAmount.replace(/,/g, '');
    const amount = parseFloat(numericValue);
    if (isNaN(amount) || amount <= 0) {
      setError('유효한 수금 금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const paymentData: {
        customerId: string;
        collectionMethod: typeof collectionMethod;
        collectionAmount: number;
        collectionDate: Date;
        notes?: string;
        processedBy: string;
        processedByName: string;
      } = {
        customerId,
        collectionMethod,
        collectionAmount: amount,
        collectionDate,
        processedBy: user?.uid || '',
        processedByName: user?.name || ''
      };

      // notes가 있을 때만 포함
      const trimmedNotes = notes.trim();
      if (trimmedNotes) {
        paymentData.notes = trimmedNotes;
      }

      await createCollection(paymentData);

      // 성공 시 폼 리셋 및 콜백 호출
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Payment registration error:', err);
      setError(err instanceof Error ? err.message : '수금 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        수금 등록
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* 고객사 정보 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              고객사
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {customerName}
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* 수금 일시 */}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DateTimePicker
              label="수금 일시"
              value={collectionDate}
              onChange={(newValue) => setPaymentDate(newValue)}
              format="yyyy-MM-dd HH:mm"
              ampm={false}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  sx: {
                    mb: 2,
                    '& .MuiInputBase-root': {
                      height: '52px'
                    }
                  }
                }
              }}
            />
          </LocalizationProvider>

          {/* 수금 금액 & 수금 방법 */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                required
                label="수금 금액"
                type="text"
                value={collectionAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                InputProps={{
                  startAdornment: <InputAdornment position="start">₩</InputAdornment>,
                  sx: { height: '52px' }
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                required
                select
                label="수금 방법"
                value={collectionMethod}
                onChange={(e) => setCollectionMethod(e.target.value as CollectionMethod)}
                InputProps={{
                  sx: { height: '52px' }
                }}
              >
                {Object.entries(COLLECTION_METHOD_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          {/* 적요 */}
          <TextField
            fullWidth
            label="적요"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="적요를 입력하세요 (최대 15자)"
            inputProps={{ maxLength: 15 }}
            InputProps={{
              sx: { height: '52px' }
            }}
            helperText={`${notes.length}/15자`}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? '등록 중...' : '등록'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentRegistrationModal;
