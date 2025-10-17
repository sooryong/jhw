/**
 * 파일 경로: /src/pages/supplier-payments/SupplierPaymentCreatePage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 공급사 지급 등록 페이지
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Autocomplete,
  Alert,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Payment as PaymentIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getSuppliers } from '../../services/supplierService';
import { createPayment, getSupplierAccount } from '../../services/supplierPaymentService';
import type { Supplier } from '../../types/company';
import type { SupplierPaymentMethod } from '../../types/supplierPayment';
import { SUPPLIER_PAYMENT_METHOD_LABELS } from '../../types/supplierPayment';

const SupplierPaymentCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>('bank_transfer');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 세금계산서 정보
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [depositDate, setDepositDate] = useState('');

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierBalance();
    } else {
      setCurrentBalance(0);
    }
  }, [selectedSupplier]);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data.filter(s => s.isActive));
    } catch (error) {
      // Error handled silently
      console.error('공급사 로드 실패:', error);
      setError('공급사 목록을 불러오는데 실패했습니다.');
    }
  };

  const loadSupplierBalance = async () => {
    if (!selectedSupplier) return;

    try {
      const account = await getSupplierAccount(selectedSupplier.businessNumber);
      setCurrentBalance(account?.currentBalance || 0);
    } catch (error) {
      // Error handled silently
      console.error('공급사 계정 조회 실패:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      setError('공급사를 선택해주세요.');
      return;
    }

    if (!user) {
      setError('사용자 정보를 확인할 수 없습니다.');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('올바른 지급액을 입력해주세요.');
      return;
    }

    // 세금계산서 선택 시 필수 필드 검증
    if (paymentMethod === 'tax_invoice') {
      if (!invoiceNumber || !issueDate || !bankAccount || !depositDate) {
        setError('세금계산서 정보를 모두 입력해주세요.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const paymentData: Record<string, unknown> = {
        supplierId: selectedSupplier.businessNumber,
        paymentMethod,
        paymentAmount: amount,
        paymentDate: new Date(paymentDate),
        processedBy: user.uid,
        processedByName: user.name,
        notes: notes || undefined
      };

      if (paymentMethod === 'tax_invoice') {
        paymentData.receivedTaxInvoice = {
          invoiceNumber,
          issueDate: new Date(issueDate),
          bankAccount,
          depositDate: new Date(depositDate)
        };
      }

      await createPayment(paymentData);

      navigate('/supplier-payments');
    } catch (error) {
      console.error('지급 등록 실패:', error);
      setError((error as Error).message || '지급 등록에 실패했습니다.');
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
              <IconButton onClick={() => navigate(-1)}>
                <ArrowBackIcon />
              </IconButton>
              <PaymentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                지급 등록
              </Typography>
            </Box>
          </Box>

          {/* 폼 */}
          <Box sx={{ p: 2 }}>
            <Paper sx={{ p: 3 }}>
              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {/* 공급사 선택 */}
                <Autocomplete
                  options={suppliers}
                  getOptionLabel={(option) => `${option.businessName} (${option.businessNumber})`}
                  value={selectedSupplier}
                  onChange={(_, newValue) => setSelectedSupplier(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="공급사" required fullWidth />
                  )}
                  disabled={loading}
                  sx={{ mb: 2 }}
                />

                {/* 현재 미지급금 표시 */}
                {selectedSupplier && (
                  <Alert severity={currentBalance > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                    현재 미지급금: <strong>{currentBalance.toLocaleString()}원</strong>
                  </Alert>
                )}

                {/* 지급 정보 */}
                <TextField
                  select
                  label="지급 수단"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as SupplierPaymentMethod)}
                  fullWidth
                  required
                  disabled={loading}
                  sx={{ mb: 2 }}
                >
                  {Object.entries(SUPPLIER_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="지급액"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                  InputProps={{
                    endAdornment: '원'
                  }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  label="지급일"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                />

                {/* 세금계산서 정보 */}
                {paymentMethod === 'tax_invoice' && (
                  <>
                    <Divider sx={{ my: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        받은 세금계산서 정보
                      </Typography>
                    </Divider>

                    <TextField
                      label="세금계산서 번호"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      label="발행일"
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      InputLabelProps={{ shrink: true }}
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      label="입금 계좌"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      placeholder="은행명 계좌번호"
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      label="입금일"
                      type="date"
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      InputLabelProps={{ shrink: true }}
                      sx={{ mb: 2 }}
                    />
                  </>
                )}

                <TextField
                  label="비고"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  disabled={loading}
                  sx={{ mb: 3 }}
                />

                {/* 버튼 */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate(-1)}
                    disabled={loading}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                    disabled={loading}
                  >
                    {loading ? '등록 중...' : '지급 등록'}
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

export default SupplierPaymentCreatePage;
