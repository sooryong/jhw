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
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import type { CustomerFormData } from '../../types/company';
import CompanyForm from '../../components/company/CompanyForm';
import UserLinkModal from '../../components/user/UserLinkModal';
import { formatMobile } from '../../utils/numberUtils';
import {
  validateCustomerForm,
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

    // 주문 담당자 (primary 필수, secondary 선택)
    primaryContact: { name: '', mobile: '' },
    secondaryContact: { name: '', mobile: '' },

    // 고객사 전용 필드
    customerType: '',
    discountRate: 0,

    // 새로운 필드들 (초기값)
    specialPrices: [],
    // favoriteProducts는 서브컬렉션으로 분리됨

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

  // 사업자등록번호 검증 상태
  const [businessNumberValidated, setBusinessNumberValidated] = useState(false);

  // Snackbar 상태
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 담당자 조회 상태
  const [setPrimaryUserStatus] = useState<{
    searched: boolean;
    found: boolean;
    loading: boolean;
  }>({ searched: false, found: false, loading: false });

  const [setSecondaryUserStatus] = useState<{
    searched: boolean;
    found: boolean;
    loading: boolean;
  }>({ searched: false, found: false, loading: false });

  // 사용자 검색 모달 상태
  const [userSearchModal, setUserSearchModal] = useState<{
    open: boolean;
    contactType: 'primary' | 'secondary' | null;
  }>({ open: false, contactType: null });

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
      // Error handled silently
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

  // 사업자등록번호 검증 핸들러
  const handleBusinessNumberValidate = async (businessNumber: string) => {
    try {
      const result = await customerService.validateBusinessNumber(businessNumber);

      if (!result.valid) {
        setErrors(prev => ({
          ...prev,
          businessNumber: result.message || '유효하지 않은 사업자등록번호입니다.'
        }));
        setBusinessNumberValidated(false);
      } else {
        setErrors(prev => ({
          ...prev,
          businessNumber: ''
        }));
        setBusinessNumberValidated(true);
      }
    } catch (error) {
      console.error('사업자등록번호 검증 오류:', error);
      setErrors(prev => ({
        ...prev,
        businessNumber: '사업자등록번호 검증 중 오류가 발생했습니다.'
      }));
      setBusinessNumberValidated(false);
    }
  };

  // 사용자 검색 모달 열기
  const handleOpenUserSearch = (contact: 'primary' | 'secondary') => {
    setUserSearchModal({ open: true, contactType: contact });
  };

  // 사용자 검색 모달 닫기
  const handleCloseUserSearch = () => {
    setUserSearchModal({ open: false, contactType: null });
  };

  // 사용자 선택 핸들러
  const handleUserSelect = (user: unknown) => {
    if (!userSearchModal.contactType) return;

    const contact = userSearchModal.contactType;
    const contactKey = contact === 'primary' ? 'primaryContact' : 'secondaryContact';

    const userObj = user as { uid: string; name: string; mobile: string };

    // 사용자 정보 자동 입력
    setFormData(prev => ({
      ...prev,
      [contactKey]: {
        ...prev[contactKey],
        userId: userObj.uid,
        name: userObj.name,
        mobile: formatMobile(userObj.mobile)
      }
    }));

    // 상태 업데이트
    if (contact === 'primary') {
      setPrimaryUserStatus({ searched: true, found: true, loading: false });
    } else {
      setSecondaryUserStatus({ searched: true, found: true, loading: false });
    }

    setSnackbar({
      open: true,
      message: `사용자 ${userObj.name}을(를) 선택했습니다.`,
      severity: 'success',
    });

    handleCloseUserSearch();
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = (): boolean => {
    // 사업자등록번호 검증 여부 확인
    if (!businessNumberValidated) {
      setErrors(prev => ({
        ...prev,
        businessNumber: '사업자등록번호를 확인해주세요.'
      }));
      return false;
    }

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
      await customerService.createCustomer(formData);

      // 성공 시 폼 초기화
      resetForm();

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `고객사 '${formData.businessName}' 추가가 완료되었습니다.`,
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
      primaryContact: { name: '', mobile: '' },
      secondaryContact: { name: '', mobile: '' },
      customerType: customerTypes.length > 0 ? customerTypes[0] : '',
      discountRate: 0,
      specialPrices: [],
      // favoriteProducts는 서브컬렉션으로 분리됨
      isActive: true,
      currentBalance: 0
    });

    // 에러 초기화
    setErrors({});
    setSubmitError(null);
    setBusinessNumberValidated(false);

    // 조회 상태 초기화
    setPrimaryUserStatus({ searched: false, found: false, loading: false });
    setSecondaryUserStatus({ searched: false, found: false, loading: false });
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
      formData.primaryContact.name !== '' ||
      formData.primaryContact.mobile !== '' ||
      formData.secondaryContact?.name !== '' ||
      formData.secondaryContact?.mobile !== '' ||
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
      width: '100%',
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
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={loading || customerTypesLoading}
            sx={{ minWidth: '120px' }}
          >
            {loading ? '저장 중...' : '저장'}
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
          {/* 👤 주문 담당자 카드 (최상단) */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    주문 담당자(SMS 수신)
                  </Typography>
                </Box>
                {/* 담당자 추가 버튼 (담당자가 2명 미만일 때만 표시) */}
                {(!formData.primaryContact?.userId || !formData.secondaryContact?.userId) && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (!formData.primaryContact?.userId) {
                        handleOpenUserSearch('primary');
                      } else {
                        handleOpenUserSearch('secondary');
                      }
                    }}
                  >
                    담당자 추가
                  </Button>
                )}
              </Box>

              {/* 담당자 목록 (컴팩트 카드 레이아웃) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* 담당자1 */}
                {formData.primaryContact?.userId ? (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}>
                    <Chip label="담당자1" color="primary" size="small" sx={{ fontWeight: 600 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <PhoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{formData.primaryContact.mobile}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                      {formData.primaryContact.name}
                    </Typography>
                    <IconButton size="small" onClick={() => {
                      if (window.confirm('담당자1을 제거하시겠습니까?')) {
                        setFormData(prev => ({
                          ...prev,
                          primaryContact: { userId: undefined, name: '', mobile: '' }
                        }));
                        setPrimaryUserStatus({ searched: false, found: false, loading: false });
                      }
                    }} color="error">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      ⚠️ 담당자1은 필수입니다. [담당자 추가] 버튼을 클릭하여 등록해주세요.
                    </Typography>
                  </Alert>
                )}

                {/* 담당자2 */}
                {formData.secondaryContact?.userId && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}>
                    <Chip label="담당자2" color="secondary" size="small" sx={{ fontWeight: 600 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <PhoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{formData.secondaryContact.mobile}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                      {formData.secondaryContact.name}
                    </Typography>
                    <IconButton size="small" onClick={() => {
                      if (window.confirm('담당자2를 제거하시겠습니까?')) {
                        setFormData(prev => ({
                          ...prev,
                          secondaryContact: { userId: undefined, name: '', mobile: '' }
                        }));
                        setSecondaryUserStatus({ searched: false, found: false, loading: false });
                      }
                    }} color="error">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* CompanyForm 컴포넌트 사용 (고객사 필드 포함, 주문 담당자 제외) */}
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
              customerType={formData.customerType}
              discountRate={formData.discountRate}
              customerTypes={customerTypes}
              customerTypesLoading={customerTypesLoading}
              errors={errors}
              onChange={handleChange}
              onBusinessNumberValidate={handleBusinessNumberValidate}
              renderCustomerFields={true}
            />
          </Grid>
        </Grid>
      </Box>

      {/* 담당자 연결 모달 */}
      <UserLinkModal
        open={userSearchModal.open}
        onClose={handleCloseUserSearch}
        onSelect={handleUserSelect}
        title={`담당자${userSearchModal.contactType === 'primary' ? '1' : '2'} 연결`}
        excludeUserIds={[
          formData?.primaryContact?.userId,
          formData?.secondaryContact?.userId
        ].filter(Boolean) as string[]}
      />

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