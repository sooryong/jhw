/**
 * 파일 경로: /src/pages/customer/CustomerAddPage.tsx
 * 작성 날짜: 2025-09-24
 * 주요 내용: 고객사 신규 등록
 * 관련 데이터: customers 컬렉션
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  TextField,
  Grid,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import type { CustomerFormData } from '../../types/company';
import CompanyForm from '../../components/company/CompanyForm';
import { normalizeNumber, formatMobile } from '../../utils/numberUtils';
import type { NormalizedMobile, CustomerSMSRecipients } from '../../types/phoneNumber';
import {
  validateCustomerForm,
  normalizeCustomerFormData,
  hasValidationErrors,
} from '../../utils/companyValidation';

const CustomerAddPage: React.FC = () => {
  const navigate = useNavigate();

  // 고객사 유형 목록 (Settings에서 로드)
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);

  // 폼 데이터
  const [formData, setFormData] = useState<CustomerFormData>({
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

    // 고객사 전용 필드
    customerType: '',
    discountRate: 0,

    // 새로운 필드들 (초기값)
    specialPrices: [],
    favoriteProducts: [],

    // 기본값 설정 (항상 활성)
    isActive: true,
    currentBalance: 0
  });

  // 로딩 상태
  const [loading, setLoading] = useState(false);
  const [customerTypesLoading, setCustomerTypesLoading] = useState(true);

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

  // Settings에서 고객사 유형 로드
  useEffect(() => {
    const loadCustomerTypes = async () => {
      try {
        setCustomerTypesLoading(true);
        const types = await settingsService.getCustomerTypes();
        setCustomerTypes(types);

        // 첫 번째 타입을 기본값으로 설정
        if (types.length > 0 && !formData.customerType) {
          setFormData(prev => ({
            ...prev,
            customerType: types[0]
          }));
        }
      } catch {
        // 오류 처리: 고객사 유형 로드 실패
      } finally {
        setCustomerTypesLoading(false);
      }
    };

    loadCustomerTypes();
  }, [formData.customerType]);

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
          [field]: field === 'mobile' ? normalizeNumber(value) as NormalizedMobile : value
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
    const validationErrors = validateCustomerForm(formData);
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
      const normalizedData = normalizeCustomerFormData(formData);

      await customerService.createCustomer(normalizedData);

      // 성공 시 폼 초기화
      resetForm();

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `고객사 '${normalizedData.businessName}' 추가가 완료되었습니다.`,
        severity: 'success',
      });
    } catch (error) {
      // 오류 처리: 고객사 생성 실패
      console.error('고객사 추가 페이지 오류:', error);
      if (error instanceof Error) {
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
        setSubmitError(error.message);
      } else {
        console.error('알 수 없는 에러:', error);
        setSubmitError('고객사 등록 중 오류가 발생했습니다.');
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
      customerType: customerTypes.length > 0 ? customerTypes[0] : '',
      discountRate: 0,
      specialPrices: [],
      favoriteProducts: [],
      isActive: true,
      currentBalance: 0
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
      formData.smsRecipient.person2?.mobile !== '' ||
      formData.discountRate !== 0;

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
          <IconButton onClick={() => navigate('/customers')}>
            <BackIcon />
          </IconButton>
          <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            고객사 추가
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
            disabled={loading || customerTypesLoading}
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

              {/* SMS 수신자 등록 안내 */}
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                  🤖 SMS 수신자 등록 안내
                </Typography>
                <Typography variant="body2">
                  • SMS 수신자1(필수)과 2(선택)에는 실제 주문하고 관리하는 분을 등록해주세요.
                </Typography>
              </Alert>
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

export default CustomerAddPage;