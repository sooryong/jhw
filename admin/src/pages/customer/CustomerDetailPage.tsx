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
  Grid,
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
  LocalOffer as PriceIcon,
  Add as AddIcon,
  Assessment as StatsIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import CompanyForm from '../../components/company/CompanyForm';
import UserLinkModal from '../../components/user/UserLinkModal';
import type { Customer, CustomerFormData, SpecialPrice } from '../../types/company';
import {
  validateCustomerForm,
  hasValidationErrors,
} from '../../utils/companyValidation';
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

  // 담당자 조회 상태

  // 사용자 검색 모달 상태
  const [userSearchModal, setUserSearchModal] = useState<{
    open: boolean;
    contactType: 'primary' | 'secondary' | null;
  }>({ open: false, contactType: null });

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
      // ContactInfo 구조에서 직접 데이터 가져오기 (userId 포함)
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
        primaryContact: {
          userId: customerData.primaryContact?.userId,
          name: customerData.primaryContact?.name || '',
          mobile: customerData.primaryContact?.mobile ? formatMobile(customerData.primaryContact.mobile) : '',
        },
        secondaryContact: customerData.secondaryContact ? {
          userId: customerData.secondaryContact.userId,
          name: customerData.secondaryContact.name,
          mobile: formatMobile(customerData.secondaryContact.mobile),
        } : { name: '', mobile: '' },
        isActive: customerData.isActive,
        customerType: customerData.customerType,
        discountRate: customerData.discountRate,
        currentBalance: customerData.currentBalance || 0,
        specialPrices: customerData.specialPrices || []
        // favoriteProducts는 서브컬렉션으로 분리됨
      };

      setSpecialPrices(customerData.specialPrices || []);

      setFormData(formDataObj);
      setOriginalData(formDataObj);
    } catch (error) {
      // 오류 처리: 고객사 정보 로드 실패
      console.error('고객사 로드 에러:', error);
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


  // 사용자 검색 모달 열기 (자동으로 빈 슬롯 결정)
  const handleOpenUserSearch = (contact?: 'primary' | 'secondary') => {
    // contact가 지정되지 않으면 자동으로 빈 슬롯 찾기
    let targetContact: 'primary' | 'secondary' = 'primary';

    if (!contact) {
      // 담당자1이 비어있으면 담당자1에 추가
      if (!formData?.primaryContact?.name && !formData?.primaryContact?.mobile) {
        targetContact = 'primary';
      }
      // 담당자1이 있고 담당자2가 비어있으면 담당자2에 추가
      else if (!formData?.secondaryContact?.name && !formData?.secondaryContact?.mobile) {
        targetContact = 'secondary';
      }
    } else {
      targetContact = contact;
    }

    setUserSearchModal({ open: true, contactType: targetContact });
  };

  // 사용자 검색 모달 닫기
  const handleCloseUserSearch = () => {
    setUserSearchModal({ open: false, contactType: null });
  };

  // 사용자 선택 핸들러
  const handleUserSelect = (user: unknown) => {
    if (!formData || !userSearchModal.contactType) return;

    const contact = userSearchModal.contactType;
    const contactKey = contact === 'primary' ? 'primaryContact' : 'secondaryContact';

    // 사용자 정보 자동 입력
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [contactKey]: {
          ...prev[contactKey],
          userId: (user as { uid: string; name: string; mobile: string }).uid,
          name: (user as { uid: string; name: string; mobile: string }).name,
          mobile: formatMobile((user as { uid: string; name: string; mobile: string }).mobile)
        }
      };
    });

    setSnackbar({
      open: true,
      message: `사용자 ${(user as { uid: string; name: string; mobile: string }).name}을(를) 선택했습니다.`,
      severity: 'success',
    });

    // 모달 닫기
    handleCloseUserSearch();
  };

  // 담당자 제거 (담당자2 제거 시 담당자1로 승격 없음, 담당자1 제거 시 담당자2를 담당자1로 승격)
  const handleRemoveContact = (contact: 'primary' | 'secondary') => {
    const contactLabel = contact === 'primary' ? '담당자1' : '담당자2';

    if (!window.confirm(`${contactLabel}을(를) 제거하시겠습니까?`)) {
      return;
    }

    if (contact === 'primary') {
      // 담당자1 제거: 담당자2가 있으면 담당자1로 승격
      if (formData?.secondaryContact?.name || formData?.secondaryContact?.mobile) {
        setFormData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            primaryContact: prev.secondaryContact,
            secondaryContact: { name: '', mobile: '' }
          };
        });
            setSnackbar({
          open: true,
          message: '담당자1을 제거하고 담당자2를 담당자1로 승격했습니다.',
          severity: 'success',
        });
      } else {
        // 담당자2가 없으면 그냥 담당자1만 제거
        setFormData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            primaryContact: { name: '', mobile: '' }
          };
        });

        setSnackbar({
          open: true,
          message: '담당자1을 제거했습니다.',
          severity: 'success',
        });
      }
    } else {
      // 담당자2 제거
      setFormData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          secondaryContact: { name: '', mobile: '' }
        };
      });

      setSnackbar({
        open: true,
        message: '담당자2를 제거했습니다.',
        severity: 'success',
      });
    }
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
  const validateForm = useCallback((): boolean => {
    if (!formData) return false;

    const validationErrors = validateCustomerForm(formData);
    setErrors(validationErrors);
    return !hasValidationErrors(validationErrors);
  }, [formData]);

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
      await customerService.updateCustomer(businessNumber, formData);

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
          {/* 👤 주문 담당자 카드 (최상단) */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, height: 'auto' }}>
              {/* 헤더 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    주문 담당자(SMS 수신)
                  </Typography>
                </Box>
                {/* 담당자 추가 버튼 - 담당자가 2명 미만일 때만 표시 */}
                {editMode && (
                  ((!formData.primaryContact?.name && !formData.primaryContact?.mobile) ||
                   (!formData.secondaryContact?.name && !formData.secondaryContact?.mobile)) && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenUserSearch()}
                    >
                      담당자 추가
                    </Button>
                  )
                )}
              </Box>

              {/* 담당자 목록 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* 담당자1 */}
                {(formData.primaryContact?.name || formData.primaryContact?.mobile) ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.default'
                    }}
                  >
                    <Chip
                      label="담당자1"
                      color="primary"
                      size="small"
                      sx={{ minWidth: '80px', fontWeight: 600 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <PhoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body1">
                        {formData.primaryContact.mobile || '-'}
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
                      {formData.primaryContact.name || '-'}
                    </Typography>
                    {editMode && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveContact('primary')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ) : null}

                {/* 담당자2 */}
                {(formData.secondaryContact?.name || formData.secondaryContact?.mobile) ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.default'
                    }}
                  >
                    <Chip
                      label="담당자2"
                      color="secondary"
                      size="small"
                      sx={{ minWidth: '80px', fontWeight: 600 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <PhoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body1">
                        {formData.secondaryContact.mobile || '-'}
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
                      {formData.secondaryContact.name || '-'}
                    </Typography>
                    {editMode && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveContact('secondary')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ) : null}

                {/* 빈 상태 메시지 */}
                {!formData.primaryContact?.name && !formData.primaryContact?.mobile &&
                 !formData.secondaryContact?.name && !formData.secondaryContact?.mobile && (
                  <Alert severity="info">
                    등록된 담당자가 없습니다. {editMode && '상단의 [담당자 추가] 버튼을 클릭하여 담당자를 추가하세요.'}
                  </Alert>
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
              readOnly={!editMode}
              onChange={handleChange}
              renderCustomerFields={true}
            />
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

export default CustomerDetailPage;