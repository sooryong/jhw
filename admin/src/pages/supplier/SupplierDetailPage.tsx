/**
 * 파일 경로: /src/pages/supplier/SupplierDetailPage.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 공급사 상세보기/수정 (CustomerDetailPage와 동일한 UI/로직)
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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Assessment as StatsIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { supplierService } from '../../services/supplierService';
import CompanyForm from '../../components/company/CompanyForm';
import UserLinkModal from '../../components/user/UserLinkModal';
import type { Supplier, SupplierFormData } from '../../types/company';
import {
  validateSupplierForm,
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

  // 담당자 조회 상태
  const [, setPrimaryUserStatus] = useState<{
    searched: boolean;
    found: boolean;
    loading: boolean;
  }>({ searched: false, found: false, loading: false });

  const [secondaryUserStatus, setSecondaryUserStatus] = useState<{
    searched: boolean;
    found: boolean;
    loading: boolean;
  }>({ searched: false, found: false, loading: false });

  // 사용자 검색 모달 상태
  const [userSearchModal, setUserSearchModal] = useState<{
    open: boolean;
    contactType: 'primary' | 'secondary' | null;
  }>({ open: false, contactType: null });

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
      // ContactInfo 구조에서 직접 데이터 가져오기 (userId 포함)
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
        primaryContact: {
          userId: supplierData.primaryContact?.userId,
          name: supplierData.primaryContact?.name || '',
          mobile: supplierData.primaryContact?.mobile ? formatMobile(supplierData.primaryContact.mobile) : '',
        },
        secondaryContact: supplierData.secondaryContact ? {
          userId: supplierData.secondaryContact.userId,
          name: supplierData.secondaryContact.name,
          mobile: formatMobile(supplierData.secondaryContact.mobile),
        } : { name: '', mobile: '' },
        isActive: supplierData.isActive,
      };

      setFormData(formDataObj);
      setOriginalData(formDataObj);
    } catch (error) {
      // Error handled silently
      // 오류 처리: 공급사 정보 로드 실패
      console.error('공급사 로드 에러:', error);
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

  // handleContactUpdate is not used - contacts are managed via UserLinkModal

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
  const handleUserSelect = (user: { uid: string; name: string; mobile: string }) => {
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
          userId: user.uid,
          name: user.name,
          mobile: formatMobile(user.mobile)
        }
      };
    });

    // 상태 업데이트
    if (contact === 'primary') {
      setPrimaryUserStatus({ searched: true, found: true, loading: false });
    } else {
      setSecondaryUserStatus({ searched: true, found: true, loading: false });
    }

    setSnackbar({
      open: true,
      message: `사용자 ${user.name}을(를) 선택했습니다.`,
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
        // 상태도 업데이트
        setPrimaryUserStatus(secondaryUserStatus);
        setSecondaryUserStatus({ searched: false, found: false, loading: false });

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
        setPrimaryUserStatus({ searched: false, found: false, loading: false });

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
      setSecondaryUserStatus({ searched: false, found: false, loading: false });

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
      // 조회 상태 초기화
      setPrimaryUserStatus({ searched: false, found: false, loading: false });
      setSecondaryUserStatus({ searched: false, found: false, loading: false });
    } else {
      // 편집 모드 시작 시 조회 상태 초기화
      setPrimaryUserStatus({ searched: false, found: false, loading: false });
      setSecondaryUserStatus({ searched: false, found: false, loading: false });
    }
    setEditMode(!editMode);
  };

  // 폼 검증 (통합 유틸리티 사용)
  const validateForm = useCallback((): boolean => {
    if (!formData) return false;

    const validationErrors = validateSupplierForm(formData);
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
      await supplierService.updateSupplier(businessNumber, formData);

      // 데이터 새로고침
      const updatedSupplier = await supplierService.getSupplierById(businessNumber);
      if (updatedSupplier) {
        setSupplier(updatedSupplier);
        setOriginalData(formData);
      }

      setEditMode(false);

      // 성공 메시지
      setSnackbar({
        open: true,
        message: '공급사 정보가 저장되었습니다.',
        severity: 'success',
      });
    } catch (error) {
      // Error handled silently
      // 오류 처리: 공급사 수정 실패
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('공급사 수정 중 오류가 발생했습니다.');
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
    if (!businessNumber || !supplier) return;

    setStatusDialog(false);
    setStatusLoading(true);

    try {
      const newStatus = !supplier.isActive;

      // 낙관적 업데이트
      setSupplier(prev => prev ? { ...prev, isActive: newStatus } : null);

      // 서버 업데이트
      await supplierService.updateSupplier(businessNumber, { isActive: newStatus });

      // FormData도 동기화
      if (formData) {
        setFormData(prev => prev ? { ...prev, isActive: newStatus } : null);
        setOriginalData(prev => prev ? { ...prev, isActive: newStatus } : null);
      }

    } catch {
      // Error handled silently
      // 오류 처리: 공급사 상태 변경 실패

      // 롤백
      setSupplier(prev => prev ? { ...prev, isActive: !supplier.isActive } : null);

      setSubmitError('공급사 상태 변경 중 오류가 발생했습니다.');
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
      await supplierService.deleteSupplier(businessNumber);
      navigate('/suppliers');
    } catch {
      // Error handled silently
      // 오류 처리: 공급사 삭제 실패
      setSubmitError('공급사 삭제 중 오류가 발생했습니다.');
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

  if (!supplier || !formData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          공급사 정보를 찾을 수 없습니다.
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
            onClick={loadSupplier}
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
          {/* 👤 매입주문서 SMS 수신자 카드 (최상단) */}
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
              <Box sx={{
                display: 'flex',
                flexDirection: (formData.primaryContact?.name || formData.primaryContact?.mobile) &&
                               (formData.secondaryContact?.name || formData.secondaryContact?.mobile)
                  ? 'row'
                  : 'column',
                gap: 2
              }}>
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
                      bgcolor: 'background.default',
                      height: '52px',
                      flex: 1
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
                      bgcolor: 'background.default',
                      height: '52px',
                      flex: 1
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

          {/* CompanyForm 컴포넌트 사용 (주문 담당자 제외) */}
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
              errors={errors}
              readOnly={!editMode}
              onChange={handleChange}
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
                      primary={supplier.createdAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip label="수정일" color="secondary" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={supplier.updatedAt.toDate().toLocaleDateString('ko-KR')}
                    />
                  </ListItem>
                </Grid>
              </Grid>
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
        <DialogTitle id="delete-dialog-title">공급사 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            <strong>{supplier.businessName}</strong> 공급사를 삭제하시겠습니까?
          </DialogContentText>
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            ⚠️ 이 작업은 복구할 수 없습니다.
            <br />
            해당 공급사의 모든 데이터가 영구적으로 삭제됩니다.
          </Typography>
          <Typography variant="body2" sx={{
            mt: 2,
            p: 2,
            border: 1,
            borderColor: 'primary.main',
            borderRadius: 1
          }}>
            💡 <strong>대안:</strong> 완전 삭제 대신 공급사를 <strong>비활성 상태</strong>로 변경할 수 있습니다.
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
          공급사 상태 변경 확인
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="status-dialog-description">
            <strong>{supplier.businessName}</strong> 공급사를 <strong>{supplier.isActive ? '비활성' : '활성'}</strong> 상태로 변경하시겠습니까?
          </DialogContentText>
          {supplier.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
              ⚠️ 비활성화하면 공급사 목록에서 숨겨지며, 새로운 거래가 제한될 수 있습니다.
            </Typography>
          )}
          {!supplier.isActive && (
            <Typography variant="body2" sx={{ mt: 2, color: 'success.main' }}>
              ✅ 활성화하면 공급사 목록에 표시되며, 정상적인 거래가 가능해집니다.
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
            color={supplier.isActive ? "warning" : "success"}
            disabled={statusLoading}
            autoFocus
          >
            {supplier.isActive ? '비활성화' : '활성화'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 담당자 연결 모달 */}
      <UserLinkModal
        open={userSearchModal.open}
        onClose={handleCloseUserSearch}
        onSelect={handleUserSelect}
        title={`담당자${userSearchModal.contactType === 'primary' ? '1' : '2'} 연결`}
        filterRole="supplier"
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

export default SupplierDetailPage;
