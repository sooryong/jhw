/**
 * 파일 경로: /src/pages/payments/PaymentCreatePage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 수금 등록 페이지
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Autocomplete
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Payment as PaymentIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { createCollection, getCustomerAccount, type CreatePaymentData } from '../../services/customerCollectionService';
import { getCustomers } from '../../services/customerService';
import type { Customer } from '../../types/customer';
import type { CollectionMethod } from '../../types/customerCollection';
import { COLLECTION_METHOD_LABELS } from '../../types/customerCollection';

const PaymentCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  const [formData, setFormData] = useState({
    collectionMethod: 'cash' as CollectionMethod,
    collectionAmount: '',
    collectionDate: new Date().toISOString().split('T')[0],
    notes: '',
    // 세금계산서 정보
    invoiceNumber: '',
    issueDate: '',
    bankAccount: '',
    depositDate: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 고객사 목록 로드
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data.filter(c => c.isActive));
    } catch (error) {
      // Error handled silently
      console.error('고객사 로드 실패:', error);
      setError('고객사 목록을 불러오는데 실패했습니다.');
    }
  };

  const loadCustomerBalance = useCallback(async () => {
    if (!selectedCustomer) return;

    try {
      const account = await getCustomerAccount(selectedCustomer.businessNumber);
      setCurrentBalance(account?.currentBalance || 0);
    } catch (error) {
      // Error handled silently
      console.error('계정 조회 실패:', error);
      setCurrentBalance(0);
    }
  }, [selectedCustomer]);

  // 고객사 선택 시 미수금 조회
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerBalance();
    }
  }, [selectedCustomer, loadCustomerBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setError('고객사를 선택해주세요.');
      return;
    }

    if (!formData.collectionAmount || parseFloat(formData.collectionAmount) <= 0) {
      setError('수금액을 입력해주세요.');
      return;
    }

    if (!user) {
      setError('사용자 정보를 확인할 수 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const paymentData: CreatePaymentData = {
        customerId: selectedCustomer.businessNumber,
        collectionMethod: formData.collectionMethod,
        collectionAmount: parseFloat(formData.collectionAmount),
        collectionDate: new Date(formData.collectionDate),
        processedBy: user.uid,
        processedByName: user.displayName || user.email || '관리자',
        ...(formData.notes && { notes: formData.notes }),
        ...(formData.collectionMethod === 'tax_invoice' && formData.invoiceNumber && {
          taxInvoice: {
            invoiceNumber: formData.invoiceNumber,
            issueDate: new Date(formData.issueDate),
            bankAccount: formData.bankAccount,
            depositDate: new Date(formData.depositDate)
          }
        })
      };

      await createCollection(paymentData);
      setSuccess(true);

      // 2초 후 목록으로 이동
      setTimeout(() => {
        navigate('/payments');
      }, 2000);

    } catch (error: unknown) {
      console.error('수금 등록 실패:', error);
      setError(error.message || '수금 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => navigate('/payments')}>
                <ArrowBackIcon />
              </IconButton>
              <PaymentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                수금 등록
              </Typography>
            </Box>
          </Box>

          {/* 폼 */}
          <Box sx={{ p: 2 }}>
            <Paper sx={{ p: 3 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  수금이 성공적으로 등록되었습니다. 목록으로 이동합니다...
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                {/* 고객사 선택 */}
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => `${option.businessName} (${option.businessNumber})`}
                  value={selectedCustomer}
                  onChange={(_, newValue) => setSelectedCustomer(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="고객사"
                      required
                      fullWidth
                      sx={{ mb: 2 }}
                    />
                  )}
                  disabled={loading || success}
                />

                {/* 미수금 표시 */}
                {selectedCustomer && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    현재 미수금: <strong>{currentBalance.toLocaleString()}원</strong>
                  </Alert>
                )}

                {/* 수금수단 */}
                <TextField
                  select
                  label="수금수단"
                  value={formData.collectionMethod}
                  onChange={(e) => setFormData({ ...formData, collectionMethod: e.target.value as CollectionMethod })}
                  required
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={loading || success}
                >
                  {Object.entries(COLLECTION_METHOD_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                {/* 수금액 */}
                <TextField
                  label="수금액"
                  type="number"
                  value={formData.collectionAmount}
                  onChange={(e) => setFormData({ ...formData, collectionAmount: e.target.value })}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                  sx={{ mb: 2 }}
                  disabled={loading || success}
                />

                {/* 수금일 */}
                <TextField
                  label="수금일"
                  type="date"
                  value={formData.collectionDate}
                  onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                  disabled={loading || success}
                />

                {/* 세금계산서 정보 (조건부) */}
                {formData.collectionMethod === 'tax_invoice' && (
                  <>
                    <TextField
                      label="세금계산서 번호"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      fullWidth
                      sx={{ mb: 2 }}
                      disabled={loading || success}
                    />
                    <TextField
                      label="발행일"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{ mb: 2 }}
                      disabled={loading || success}
                    />
                    <TextField
                      label="입금 계좌"
                      value={formData.bankAccount}
                      onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                      fullWidth
                      sx={{ mb: 2 }}
                      disabled={loading || success}
                    />
                    <TextField
                      label="입금 확인일"
                      type="date"
                      value={formData.depositDate}
                      onChange={(e) => setFormData({ ...formData, depositDate: e.target.value })}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{ mb: 2 }}
                      disabled={loading || success}
                    />
                  </>
                )}

                {/* 비고 */}
                <TextField
                  label="비고"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                  sx={{ mb: 3 }}
                  disabled={loading || success}
                />

                {/* 버튼 */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/payments')}
                    disabled={loading || success}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || success}
                    startIcon={loading ? <CircularProgress size={20} /> : <PaymentIcon />}
                  >
                    {loading ? '등록 중...' : '수금 등록'}
                  </Button>
                </Box>
              </form>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default PaymentCreatePage;
