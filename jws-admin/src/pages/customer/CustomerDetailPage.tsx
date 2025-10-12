/**
 * 파일 경로: /src/pages/customer/CustomerDetailPage.tsx
 * 작성 날짜: 2025-09-24
 * 주요 내용: 고객사 상세보기/수정
 * 관련 데이터: customers 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  LocalOffer as PriceIcon,
  Add as AddIcon,
  Assessment as StatsIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import CompanyForm from '../../components/company/CompanyForm';
import type { Customer, CustomerFormData, SpecialPrice } from '../../types/company';
import { businessNumberUtils } from '../../types/company';
import {
  validateCustomerForm,
  normalizeCustomerFormData,
  hasValidationErrors,
} from '../../utils/companyValidation';
import { normalizeNumber } from '../../utils/numberUtils';
import type { NormalizedMobile, CustomerSMSRecipients } from '../../types/phoneNumber';
import {
  formatBusinessNumber,
  formatMobile,
  formatPhone,
} from '../../utils/numberUtils';

const CustomerDetailPage: React.FC = () => {
  const { businessNumber: encodedBusinessNumber } = useParams<{ businessNumber: string }>();
  const businessNumber = encodedBusinessNumber ? decodeURIComponent(encodedBusinessNumber) : undefined;
  const navigate = useNavigate();

  // 상태 관리
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData | null>(null);
  const [originalData, setOriginalData] = useState<CustomerFormData | null>(null);
  const [specialPrices, setSpecialPrices] = useState<SpecialPrice[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);

  // Snackbar 상태
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [statusLoading, setStatusLoading] = useState(false);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [customerTypesLoading, setCustomerTypesLoading] = useState(true);

  // 고객사 유형 로드
  useEffect(() => {
    const loadCustomerTypes = async () => {
      try {
        setCustomerTypesLoading(true);
        const types = await settingsService.getCustomerTypes();
        setCustomerTypes(types);
      } catch {
        // 오류 처리: 고객사 유형 로드 실패
      } finally {
        setCustomerTypesLoading(false);
      }
    };

    loadCustomerTypes();
  }, []);

  // 데이터 로드 함수
  const loadCustomer = useCallback(async () => {
    if (!businessNumber) {
      navigate('/customers');
      return;
    }

    setLoading(true);
    try {
      const customerData = await customerService.getCustomer(businessNumber);
      if (!customerData) {
        navigate('/customers');
        return;
      }

      setCustomer(customerData);

      // FormData로 변환 (포맷팅 적용)
      const formDataObj: CustomerFormData = {
        businessNumber: formatBusinessNumber(customerData.businessNumber),
        businessName: customerData.businessName,
        president: customerData.president,
        businessAddress: customerData.businessAddress,
        businessType: customerData.businessType || '',
        businessItem: customerData.businessItem || '',
        presidentMobile: customerData.presidentMobile ? formatMobile(customerData.presidentMobile) : '',
        businessPhone: customerData.businessPhone ? formatPhone(customerData.businessPhone) : '',
        businessEmail: customerData.businessEmail || '',
        smsRecipient: {
          person1: {
            name: customerData.smsRecipient.person1.name,
            mobile: formatMobile(customerData.smsRecipient.person1.mobile),
          },
          person2: customerData.smsRecipient.person2 ? {
            name: customerData.smsRecipient.person2.name,
            mobile: formatMobile(customerData.smsRecipient.person2.mobile),
          } : undefined,
        },
        isActive: customerData.isActive,
        customerType: customerData.customerType,
        discountRate: customerData.discountRate,
        currentBalance: customerData.currentBalance || 0,
        specialPrices: customerData.specialPrices || [],
        favoriteProducts: customerData.favoriteProducts || [],
      };

      setSpecialPrices(customerData.specialPrices || []);

      setFormData(formDataObj);
      setOriginalData(formDataObj);
    } catch {
      // 오류 처리: 고객사 정보 로드 실패
      setSubmitError('고객사 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [businessNumber, navigate]);

  // 데이터 로드
  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  // 입력값 변경 처리
  const handleChange = (field: string, value: string | number | boolean | undefined) => {
    if (!formData) return;

    setFormData(prev => ({
      ...prev!,
      [field]: value,
    }));

    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
    setSubmitError(null);
  };

  // SMS 수신자 변경 (person1/person2 구조)
  const handleSMSRecipientUpdate = (person: 'person1' | 'person2', field: 'name' | 'mobile', value: string) => {
    if (!formData) return;

    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        smsRecipient: {
          ...prev.smsRecipient,
          [person]: {
            ...prev.smsRecipient[person],
            [field]: field === 'mobile' ? normalizeNumber(value) as NormalizedMobile : value
          }
        }
      };
    });
  };

  // 변경사항 확인
  const hasChanges = (): boolean => {
    if (!originalData || !formData) return false;
    return JSON.stringify(originalData) !== JSON.stringify(formData);
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    if (editMode) {
      // 취소 시 변경사항 확인
      if (hasChanges()) {
        if (!window.confirm('변경사항이 있습니다. 취소하시겠습니까?')) {
          return;
        }
      }
      // 원래 데이터로 복원
      setFormData(originalData);
      setErrors({});
      setSubmitError(null);
    }
    setEditMode(!editMode);
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    if (!formData) return false;

    const validationErrors = validateCustomerForm(formData);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  };

  // 저장
  const handleSave = useCallback(async () => {
    if (!formData || !businessNumber) return;

    if (!validateForm()) {
      setSubmitError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      // 폼 데이터 정규화 (통합 유틸리티 사용)
      const normalizedData = normalizeCustomerFormData(formData);

      await customerService.updateCustomer(businessNumber, normalizedData);

      // 데이터 새로고침
      const updatedCustomer = await customerService.getCustomer(businessNumber);
      if (updatedCustomer) {
        setCustomer(updatedCustomer);
        setOriginalData(formData);
      }

      setEditMode(false);

      // 성공 메시지
      setSnackbar({
        open: true,
        message: '고객사 정보가 저장되었습니다.',
        severity: 'success',
      });
    } catch (error) {
      // 오류 처리: 고객사 수정 실패
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('고객사 수정 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [businessNumber, formData, validateForm]);

  // 상태 토글 처리
  const handleStatusToggle = () => {
    setStatusDialog(true);
  };

  const handleStatusConfirm = async () => {
    if (!businessNumber || !customer) return;

    setStatusDialog(false);
    setStatusLoading(true);

    try {
      const newStatus = !customer.isActive;

      // 낙관적 업데이트
      setCustomer(prev => prev ? { ...prev, isActive: newStatus } : null);

      // 서버 업데이트
      await customerService.updateCustomer(businessNumber, { isActive: newStatus });

      // FormData도 동기화
      if (formData) {
        setFormData(prev => prev ? { ...prev, isActive: newStatus } : null);
        setOriginalData(prev => prev ? { ...prev, isActive: newStatus } : null);
      }

    } catch {
      // 오류 처리: 고객사 상태 변경 실패

      // 롤백
      setCustomer(prev => prev ? { ...prev, isActive: !customer.isActive } : null);

      setSubmitError('고객사 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setStatusLoading(false);
    }
  };

  // 삭제
  const handleDelete = useCallback(async () => {
    if (!businessNumber) return;

    setDeleteDialog(false);
    setLoading(true);

    try {
      await customerService.deleteCustomer(businessNumber);
      navigate('/customers');
    } catch {
      // 오류 처리: 고객사 삭제 실패
      setSubmitError('고객사 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [businessNumber, navigate]);

  if (loading && !formData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!customer || !formData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          고객사 정보를 찾을 수 없습니다.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      width: '80%',
      margin: '0 auto',
      maxWidth: '100vw',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3,
        pb: 2,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/customers')}>
            <BackIcon />
          </IconButton>
          <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            {customer.businessName}
          </Typography>
          {/* 상태 토글 스위치 */}
          <FormControlLabel
            control={
              <Switch
                checked={customer.isActive}
                onChange={handleStatusToggle}
                disabled={statusLoading}
                color="success"
              />
            }
            label={customer.isActive ? "활성" : "비활성"}
            sx={{
              ml: 2,
              '& .MuiFormControlLabel-label': {
                color: customer.isActive ? 'success.main' : 'text.secondary',
                fontWeight: 'medium'
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {editMode ? (
            <>
              <Button
                startIcon={<CancelIcon />}
                onClick={toggleEditMode}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={loading}
              >
                저장
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialog(true)}
                disabled={loading}
              >
                삭제
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={toggleEditMode}
                disabled={loading}
              >
                수정
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            onClick={loadCustomer}
            disabled={loading}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 에러 메시지 및 폼 영역 - 스크롤 가능한 영역 */}
      <Box sx={{ px: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        <Grid container spacing={1}>
          {/* CompanyForm 컴포넌트 사용 (고객사 필드 포함, SMS 수신자 제외) */}
          <Grid size={{ xs: 12 }}>
            <CompanyForm
              businessNumber={formData.businessNumber}
              businessName={formData.businessName}
              president={formData.president}
              businessAddress={formData.businessAddress}
              businessType={formData.businessType}
              businessItem={formData.businessItem}
              presidentMobile={formData.presidentMobile}
              businessPhone={formData.businessPhone}
              businessEmail={formData.businessEmail}
              smsRecipient={formData.smsRecipient as CustomerSMSRecipients}
              customerType={formData.customerType}
              discountRate={formData.discountRate}
              customerTypes={customerTypes}
              customerTypesLoading={customerTypesLoading}
              errors={errors}
              readOnly={!editMode}
              onChange={handleChange}
              onSMSRecipientUpdate={handleSMSRecipientUpdate}
              renderSmsRecipient={false}
              renderCustomerFields={true}
            />
          </Grid>

          {/* 📱 SMS 수신자 카드 */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <MessageIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  SMS 수신자
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="이름1"
                    value={formData.smsRecipient.person1?.name || ''}
                    onChange={(e) => handleSMSRecipientUpdate('person1', 'name', e.target.value)}
                    error={!!errors.smsRecipient_person1_name}
                    helperText={errors.smsRecipient_person1_name}
                    InputProps={{ readOnly: !editMode }}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="휴대폰1"
                    value={formData.smsRecipient.person1?.mobile || ''}
                    onChange={(e) => {
                      const formatted = formatMobile(e.target.value);
                      handleSMSRecipientUpdate('person1', 'mobile', formatted);
                    }}
                    error={!!errors.smsRecipient_person1_mobile}
                    helperText={errors.smsRecipient_person1_mobile}
                    placeholder="010-1234-5678"
                    InputProps={{ readOnly: !editMode }}
                    required
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="이름2"
                    value={formData.smsRecipient.person2?.name || ''}
                    onChange={(e) => handleSMSRecipientUpdate('person2', 'name', e.target.value)}
                    error={!!errors.smsRecipient_person2_name}
                    helperText={errors.smsRecipient_person2_name}
                    InputProps={{ readOnly: !editMode }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="휴대폰2"
                    value={formData.smsRecipient.person2?.mobile || ''}
                    onChange={(e) => {
                      const formatted = formatMobile(e.target.value);
                      handleSMSRecipientUpdate('person2', 'mobile', formatted);
                    }}
                    error={!!errors.smsRecipient_person2_mobile}
                    helperText={errors.smsRecipient_person2_mobile}
                    placeholder="010-1234-5678"
                    InputProps={{ readOnly: !editMode }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 등록 정보 (읽기 전용) */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <StatsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  등록 정보
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="등록일" color="primary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={customer.createdAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="수정일" color="secondary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={customer.updatedAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 특별 가격 목록 */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PriceIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    특별 가격 목록
                  </Typography>
                </Box>
                {editMode && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {/* TODO: 특별가격 추가 모달 */}}
                    disabled
                  >
                    특별가격 추가
                  </Button>
                )}
              </Box>

              {specialPrices.length === 0 ? (
                <Alert severity="info">
                  설정된 특별 가격이 없습니다.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>상품명</TableCell>
                        <TableCell align="right">원가</TableCell>
                        <TableCell align="right">기본할인가</TableCell>
                        <TableCell align="right">특별가격</TableCell>
                        <TableCell align="center">활성</TableCell>
                        <TableCell>시작일</TableCell>
                        <TableCell>종료일</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {specialPrices.map((price, index) => (
                        <TableRow key={index}>
                          <TableCell>{price.productName}</TableCell>
                          <TableCell align="right">
                            ₩{price.originalPrice.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            ₩{price.discountedPrice.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              color={price.specialPrice < price.discountedPrice ? 'error.main' : 'inherit'}
                              fontWeight={price.specialPrice < price.discountedPrice ? 'bold' : 'normal'}
                            >
                              ₩{price.specialPrice.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={price.isActive ? '활성' : '비활성'}
                              color={price.isActive ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {price.startDate ? price.startDate.toDate().toLocaleDateString('ko-KR') : '-'}
                          </TableCell>
                          <TableCell>
                            {price.endDate ? price.endDate.toDate().toLocaleDateString('ko-KR') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">고객사 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            <strong>{customer.businessName}</strong> 고객사를 삭제하시겠습니까?
          </DialogContentText>
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            ⚠️ 이 작업은 복구할 수 없습니다.
            <br />
            해당 고객사의 모든 데이터가 영구적으로 삭제됩니다.
          </Typography>
          <Typography variant="body2" sx={{
            mt: 2,
            p: 2,
            border: 1,
            borderColor: 'primary.main',
            borderRadius: 1
          }}>
            💡 <strong>대안:</strong> 완전 삭제 대신 고객사를 <strong>비활성 상태</strong>로 변경할 수 있습니다.
            비활성화하면 목록에서 구분 표시되지만 기존 데이터와 거래 이력은 보존됩니다.
            상태 변경은 상단의 활성/비활성 버튼을 이용해주세요.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog(false)}
            autoFocus
          >
            취소
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            완전 삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상태 변경 확인 다이얼로그 */}
      <Dialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        aria-labelledby="status-dialog-title"
        aria-describedby="status-dialog-description"
      >
        <DialogTitle id="status-dialog-title">
          고객사 상태 변경 확인
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="status-dialog-description">
            <strong>{customer.businessName}</strong> 고객사를 <strong>{customer.isActive ? '비활성' : '활성'}</strong> 상태로 변경하시겠습니까?
          </DialogContentText>
          {customer.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
              ⚠️ 비활성화하면 고객사 목록에서 숨겨지며, 새로운 거래가 제한될 수 있습니다.
            </Typography>
          )}
          {!customer.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'success.main' }}>
              ✅ 활성화하면 고객사 목록에 표시되며, 정상적인 거래가 가능해집니다.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStatusDialog(false)}
            disabled={statusLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleStatusConfirm}
            variant="contained"
            color={customer.isActive ? "warning" : "success"}
            disabled={statusLoading}
            autoFocus
          >
            {customer.isActive ? '비활성화' : '활성화'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomerDetailPage;