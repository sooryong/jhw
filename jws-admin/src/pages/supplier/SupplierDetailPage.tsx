/**
 * 파일 경로: /src/pages/supplier/SupplierDetailPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 공급사 상세보기/수정
 * 관련 데이터: suppliers 컬렉션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Chip,
  CircularProgress,
  Switch,
  FormControlLabel,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  TextField,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Assessment as StatsIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { supplierService } from '../../services/supplierService';
import CompanyForm from '../../components/company/CompanyForm';
import type { Supplier, SupplierFormData } from '../../types/company';
import {
  validateSupplierForm,
  normalizeSupplierFormData,
  hasValidationErrors,
} from '../../utils/companyValidation';
import {
  formatBusinessNumber,
  formatMobile,
  formatPhone,
} from '../../utils/numberUtils';

const SupplierDetailPage: React.FC = () => {
  const { businessNumber: encodedBusinessNumber } = useParams<{ businessNumber: string }>();
  const businessNumber = encodedBusinessNumber ? decodeURIComponent(encodedBusinessNumber) : undefined;
  const navigate = useNavigate();

  // 상태 관리
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData | null>(null);
  const [originalData, setOriginalData] = useState<SupplierFormData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Snackbar 상태
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: "success"
  });

  // 데이터 로드 함수
  const loadSupplier = useCallback(async () => {
    if (!businessNumber) {
      navigate('/suppliers');
      return;
    }

    setLoading(true);
    try {
      const supplierData = await supplierService.getSupplierById(businessNumber);
      if (!supplierData) {
        navigate('/suppliers');
        return;
      }

      setSupplier(supplierData);

      // FormData로 변환 (포맷팅 적용)
      const formDataObj: SupplierFormData = {
        businessNumber: formatBusinessNumber(supplierData.businessNumber),
        businessName: supplierData.businessName,
        president: supplierData.president,
        businessAddress: supplierData.businessAddress,
        businessType: supplierData.businessType || '',
        businessItem: supplierData.businessItem || '',
        presidentMobile: supplierData.presidentMobile ? formatMobile(supplierData.presidentMobile) : '',
        businessPhone: supplierData.businessPhone ? formatPhone(supplierData.businessPhone) : '',
        businessEmail: supplierData.businessEmail || '',
        smsRecipient: {
          person1: {
            name: supplierData.smsRecipient.person1.name,
            mobile: formatMobile(supplierData.smsRecipient.person1.mobile),
          },
          person2: supplierData.smsRecipient.person2 ? {
            name: supplierData.smsRecipient.person2.name,
            mobile: formatMobile(supplierData.smsRecipient.person2.mobile),
          } : undefined,
        },
        isActive: supplierData.isActive,
      };

      setFormData(formDataObj);
      setOriginalData(formDataObj);
    } catch {
      // 오류 처리: 공급사 정보 로드 실패
      setSubmitError('공급사 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [businessNumber, navigate]);

  // 데이터 로드
  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  // 입력값 변경 처리
  const handleChange = (field: string, value: string | number | boolean | undefined) => {
    if (!formData) return;

    setFormData(prev => prev ? ({
      ...prev,
      [field]: value,
    }) : null);

    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
    setSubmitError(null);
  };

  // SMS 수신자 변경
  const handleSMSRecipientUpdate = (person: 'person1' | 'person2', field: 'name' | 'mobile', value: string) => {
    if (!formData) return;

    setFormData(prev => prev ? ({
      ...prev,
      smsRecipient: {
        ...prev.smsRecipient,
        [person]: {
          ...prev.smsRecipient[person],
          [field]: value
        }
      }
    }) : null);

    // 에러 초기화
    const errorKey = `smsRecipient_${person}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: '',
      }));
    }
  };

  // 편집 모드 토글
  const handleEditToggle = () => {
    if (editMode) {
      // 편집 모드에서 취소할 때 변경사항이 있는지 확인
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
      if (hasChanges) {
        if (!window.confirm('변경사항을 취소하시겠습니까?')) {
          return;
        }
        setFormData(originalData);
        setErrors({});
      }
    }
    setEditMode(!editMode);
    setSubmitError(null);
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    if (!formData) return false;

    const validationErrors = validateSupplierForm(formData);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  };

  // 저장
  const handleSave = useCallback(async () => {
    if (!validateForm() || !formData || !businessNumber) {
      setSubmitError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      // 폼 데이터 정규화 (통합 유틸리티 사용)
      const normalizedData = normalizeSupplierFormData(formData);

      await supplierService.updateSupplier(businessNumber, normalizedData);

      // 성공 시 원본 데이터 업데이트 및 편집 모드 종료
      setOriginalData(formData);
      setEditMode(false);
      setErrors({});

      // 공급사 정보 다시 로드
      const updatedSupplier = await supplierService.getSupplierById(businessNumber);
      if (updatedSupplier) {
        setSupplier(updatedSupplier);
      }

      // 성공 메시지
      setSnackbar({
        open: true,
        message: '공급사 정보가 저장되었습니다.',
        severity: "success"
      });
    } catch (error) {
      // 오류 처리: 공급사 수정 실패
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('공급사 정보 수정 중 오류가 발생했습니다.');
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
    if (!supplier || !businessNumber) return;

    setStatusLoading(true);
    try {
      const newStatus = !supplier.isActive;
      await supplierService.updateSupplierStatus(businessNumber, newStatus);

      // 상태 업데이트
      setSupplier(prev => prev ? { ...prev, isActive: newStatus } : null);
      if (formData) {
        setFormData(prev => prev ? { ...prev, isActive: newStatus } : null);
        setOriginalData(prev => prev ? { ...prev, isActive: newStatus } : null);
      }

      setStatusDialog(false);
      setSnackbar({
        open: true,
        message: `공급사가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`,
        severity: "success"
      });
    } catch {
      // 오류 처리: 공급사 상태 업데이트 실패
      setSnackbar({
        open: true,
        message: '상태 변경 중 오류가 발생했습니다.',
        severity: "error"
      });
    } finally {
      setStatusLoading(false);
    }
  };

  // 삭제 처리
  const handleDeleteConfirm = useCallback(async () => {
    if (!businessNumber) return;

    setLoading(true);
    try {
      await supplierService.deleteSupplier(businessNumber);
      setDeleteDialog(false);
      navigate('/suppliers');
    } catch {
      // 오류 처리: 공급사 삭제 실패
      setDeleteDialog(false);
      setSnackbar({
        open: true,
        message: '공급사 삭제 중 오류가 발생했습니다.',
        severity: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [businessNumber, navigate]);

  if (loading && !supplier) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!supplier || !formData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">공급사 정보를 불러올 수 없습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      pb: 4,
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
        position: 'sticky',
        top: 0,
        backgroundColor: 'background.default',
        zIndex: 1000,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/suppliers')}>
            <BackIcon />
          </IconButton>
          <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            {supplier.businessName}
          </Typography>
          {/* 상태 토글 스위치 */}
          <FormControlLabel
            control={
              <Switch
                checked={supplier.isActive}
                onChange={handleStatusToggle}
                disabled={statusLoading}
                color="success"
              />
            }
            label={supplier.isActive ? "활성" : "비활성"}
            sx={{
              ml: 2,
              '& .MuiFormControlLabel-label': {
                color: supplier.isActive ? 'success.main' : 'text.secondary',
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
                onClick={handleEditToggle}
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
                onClick={handleEditToggle}
                disabled={loading}
              >
                수정
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            onClick={loadSupplier}
            disabled={loading}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 폼 영역 */}
      <Box sx={{ px: 3 }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        <Grid container spacing={1}>
          {/* CompanyForm 컴포넌트 사용 (SMS 수신자 제외) */}
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
              smsRecipient={formData.smsRecipient as any}
              errors={errors}
              onChange={handleChange}
              onSMSRecipientUpdate={handleSMSRecipientUpdate}
              readOnly={!editMode}
              renderSmsRecipient={false}
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

          {/* 등록 정보 카드 */}
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
                      primary={supplier.createdAt ? new Date(supplier.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : '-'}
                    />
                  </ListItem>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="수정일" color="secondary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={supplier.updatedAt ? new Date(supplier.updatedAt.seconds * 1000).toLocaleDateString('ko-KR') : '-'}
                    />
                  </ListItem>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* 상태 변경 확인 다이얼로그 */}
      <Dialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        aria-labelledby="status-dialog-title"
        aria-describedby="status-dialog-description"
      >
        <DialogTitle id="status-dialog-title">
          공급사 상태 변경
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="status-dialog-description">
            '{supplier.businessName}' 공급사를 {supplier.isActive ? '비활성화' : '활성화'}하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)} disabled={statusLoading}>
            취소
          </Button>
          <Button
            onClick={handleStatusConfirm}
            color={supplier.isActive ? "warning" : "success"}
            variant="contained"
            disabled={statusLoading}
          >
            {statusLoading ? <CircularProgress size={20} /> : (supplier.isActive ? '비활성화' : '활성화')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          공급사 삭제
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            '{supplier.businessName}' 공급사를 정말로 삭제하시겠습니까?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
            이 작업은 복구할 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)} disabled={loading}>
            취소
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : '삭제'}
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

export default SupplierDetailPage;