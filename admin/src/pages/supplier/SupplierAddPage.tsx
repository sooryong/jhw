/**
 * 파일 경로: /src/pages/supplier/SupplierAddPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 공급사 신규 등록
 * 관련 데이터: suppliers 컬렉션
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Grid,
  Alert,
  Snackbar,
  Paper,
  TextField,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { supplierService } from '../../services/supplierService';
import type { SupplierFormData } from '../../types/company';
import CompanyForm from '../../components/company/CompanyForm';
import { formatMobile } from '../../utils/numberUtils';
import {
  validateSupplierForm,
  normalizeSupplierFormData,
  hasValidationErrors,
} from '../../utils/companyValidation';

const SupplierAddPage: React.FC = () => {
  const navigate = useNavigate();

  // 폼 데이터
  const [formData, setFormData] = useState<SupplierFormData>({
    // 기본 정보
    businessNumber: '',
    businessName: '',
    president: '',
    businessAddress: '',
    businessType: '',
    businessItem: '',

    // 회사 연락처 (개별 필드)
    presidentMobile: '',
    businessPhone: '',
    businessEmail: '',

    // SMS 수신자 (person1 필수, person2 선택)
    smsRecipient: {
      person1: { name: '', mobile: '' },
      person2: { name: '', mobile: '' }
    },

    // 기본값 설정 (항상 활성)
    isActive: true,
  });

  // 로딩 상태
  const [loading, setLoading] = useState(false);

  // 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // 입력값 변경 처리
  const handleChange = (field: string, value: string | number | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
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
    setFormData(prev => ({
      ...prev,
      smsRecipient: {
        ...prev.smsRecipient,
        [person]: {
          ...prev.smsRecipient[person],
          [field]: value
        }
      }
    }));

    // 에러 초기화
    const errorKey = `smsRecipient_${person}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: '',
      }));
    }
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    const validationErrors = validateSupplierForm(formData);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  };

  // 저장
  const handleSave = async () => {
    if (!validateForm()) {
      setSubmitError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      // 폼 데이터 정규화 (통합 유틸리티 사용)
      const normalizedData = normalizeSupplierFormData(formData);

      await supplierService.createSupplier(normalizedData);

      // 성공 시 폼 초기화
      resetForm();

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `공급사 '${normalizedData.businessName}' 추가가 완료되었습니다.`,
        severity: 'success',
      });
    } catch (error) {
      // 오류 처리: 공급사 생성 실패
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('공급사 등록 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화 함수 (공통)
  const resetForm = () => {
    setFormData({
      businessNumber: '',
      businessName: '',
      president: '',
      businessAddress: '',
      businessType: '',
      businessItem: '',
      presidentMobile: '',
      businessPhone: '',
      businessEmail: '',
      smsRecipient: {
        person1: { name: '', mobile: '' },
        person2: { name: '', mobile: '' }
      },
      isActive: true,
    });

    // 에러 초기화
    setErrors({});
    setSubmitError(null);
  };

  // 취소 - 폼 초기화
  const handleCancel = () => {
    // 사용자가 실제로 입력한 필드만 체크
    const hasUserInput =
      formData.businessNumber !== '' ||
      formData.businessName !== '' ||
      formData.president !== '' ||
      formData.businessAddress !== '' ||
      formData.businessType !== '' ||
      formData.businessItem !== '' ||
      formData.presidentMobile !== '' ||
      formData.businessPhone !== '' ||
      formData.businessEmail !== '' ||
      formData.smsRecipient.person1.name !== '' ||
      formData.smsRecipient.person1.mobile !== '' ||
      formData.smsRecipient.person2?.name !== '' ||
      formData.smsRecipient.person2?.mobile !== '';

    if (hasUserInput) {
      if (!window.confirm('작성 중인 내용을 모두 지우시겠습니까?')) {
        return;
      }
    }

    resetForm();
  };

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
            공급사 추가
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
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
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>

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

export default SupplierAddPage;