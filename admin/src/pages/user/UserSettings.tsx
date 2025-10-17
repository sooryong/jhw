/**
 * 파일 경로: /src/pages/user/UserSettings.tsx
 * 작성 날짜: 2025-09-27
 * 주요 내용: 사용자 설정 페이지
 * 관련 데이터: users 컬렉션
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Switch,
  Snackbar,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getUsers, deleteUserAccount, createUser, updateUser, resetUserPassword, findUserByMobileAndRole } from '../../services/userService';
import { customerService } from '../../services/customerService';
import { settingsService } from '../../services/settingsService';
import { customerLinkService } from '../../services/customerLinkService';
import { formatMobile, normalizeNumber, formatNumberInput } from '../../utils/numberUtils';
import type { JWSUser } from '../../types/user';
import type { Customer } from '../../types/company';
import type { NormalizedMobile, NormalizedBusinessNumber } from '../../types/phoneNumber';
import { useAuth } from '../../hooks/useAuth';
import {
  validateUserForm,
  hasValidationErrors,
} from '../../utils/userValidation';

interface AddFormData {
  name: string;
  mobile: string;
  role: string; // settings의 코드 값 (예: "0", "1", "2")
}

const UserSettings: React.FC = () => {
  // 현재 로그인한 사용자 정보
  const { user: currentUser } = useAuth();

  // 기본 상태 관리
  const [users, setUsers] = useState<JWSUser[]>([]);
  const [userRoles, setUserRoles] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [addFormData, setAddFormData] = useState<AddFormData>({
    name: '',
    mobile: '',
    role: '2', // 기본값: 고객사 (settings의 코드)
  });
  const [addFormLoading, setAddFormLoading] = useState(false);

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<JWSUser | null>(null);
  const [editFormData, setEditFormData] = useState<{
    isActive: boolean;
  }>({
    isActive: true
  });
  const [editLoading, setEditLoading] = useState(false);

  // 삭제 확인 다이얼로그
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<JWSUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 비밀번호 초기화 확인 다이얼로그
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<JWSUser | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // 성공 메시지
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 고객사 상세 정보 모달
  const [customerDetailModalOpen, setCustomerDetailModalOpen] = useState(false);
  const [modalCustomerDetails, setModalCustomerDetails] = useState<Customer[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // 폼 필드 참조
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // 데이터 로드
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [userData, userRoleData] = await Promise.all([
        getUsers(),
        settingsService.getUserRoles() // 사용자 역할 목록 조회
      ]);

      setUsers(userData);
      setUserRoles(userRoleData);

    } catch (err) {
      // 오류 처리: 사용자 목록 로드 실패
      setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 컴포넌트 마운트 시 첫 번째 필드에 포커스
  useEffect(() => {
    if (firstFieldRef.current) {
      setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 100);
    }
  }, []);



  // 폼 초기화 함수
  const resetForm = () => {
    setAddFormData({
      name: '',
      mobile: '',
      role: '2',
    });
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      resetForm();
      return;
    }

    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        // Ctrl+Enter로 저장
        e.preventDefault();
        handleAddFormSubmit();
        return;
      }

      // Enter로 다음 필드 이동
      e.preventDefault();
      const form = e.currentTarget.closest('form') || e.currentTarget.closest('[role="form"]');
      if (!form) return;

      const inputs = Array.from(form.querySelectorAll('input, select, button[type="submit"]'));
      const currentIndex = inputs.indexOf(e.target as Element);
      const nextInput = inputs[currentIndex + 1] as HTMLElement;

      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  // 인라인 추가 폼 핸들러
  const handleAddFormSubmit = async () => {
    // 폼 검증 (통합 유틸리티 사용)
    const validationErrors = validateUserForm(addFormData.name, addFormData.mobile, addFormData.role);

    if (hasValidationErrors(validationErrors)) {
      const errorMessage = Object.values(validationErrors)[0]; // 첫 번째 에러 메시지 표시
      setError(errorMessage);
      return;
    }

    // 휴대폰번호 정규화 (저장용)
    const normalizedMobile = normalizeNumber(addFormData.mobile);

    // customer 또는 supplier 역할인지 확인
    const actualRole = settingsService.codeToUserRole(addFormData.role);
    let linkedCustomers: string[] = [];

    if (actualRole === 'customer') {
      // SMS 수신자 기반 연결: 휴대폰번호로 연결된 고객사 자동 확인 (선택적)
      try {
        const smsResult = await customerLinkService.findCustomersBySMSRecipient(normalizedMobile);

        if (smsResult && smsResult.linkedCustomers.length > 0) {
          // SMS 수신자로 등록된 경우: 연결된 고객사 목록을 설정
          linkedCustomers = smsResult.linkedCustomers.map(customer =>
            customer.businessNumber // 하이픈 있는 형태로 저장 (customers 문서 ID와 일치)
          );
        } else {
          // SMS 수신자가 아닌 경우: 빈 배열로 초기화하고 계속 진행
          linkedCustomers = [];
        }

      } catch (error) {
      // Error handled silently
        // SMS 수신자 확인 실패 시에도 빈 배열로 사용자 생성 계속 진행
        linkedCustomers = [];
      }
    }

    try {
      setAddFormLoading(true);

      // 휴대폰번호 + 역할 중복 체크
      const existingUser = await findUserByMobileAndRole(normalizedMobile, actualRole);

      if (existingUser) {
        setError(`이미 ${actualRole} 역할로 등록된 휴대폰 번호입니다. (등록된 사용자: ${existingUser.name})`);
        // 폼 초기화
        resetForm();
        return;
      }

      const userData: Partial<JWSUser> = {
        name: addFormData.name,
        mobile: normalizedMobile as NormalizedMobile,
        role: actualRole, // 변환된 실제 역할 사용
        isActive: true,
        requiresPasswordChange: true
      };

      // customer 역할인 경우 linkedCustomers 필드 추가
      if (actualRole === 'customer') {
        userData.linkedCustomers = (linkedCustomers || []) as NormalizedBusinessNumber[];
      }

      // supplier 역할인 경우 linkedSuppliers 필드 추가 (빈 배열)
      if (actualRole === 'supplier') {
        userData.linkedSuppliers = [] as NormalizedBusinessNumber[];
      }

      const result = await createUser(userData);

      // supplier 역할은 로그인 안 함
      if (actualRole === 'supplier') {
        setSuccessMessage(`공급사 사용자가 추가되었습니다. (Firebase Auth 미사용)`);
      } else {
        setSuccessMessage(`사용자가 추가되었습니다. 기본 비밀번호: ${result.defaultPassword} (첫 로그인 시 비밀번호 변경 필수)`);
      }

      resetForm();
      loadUsers();
    } catch (error) {
      // Error handled silently
      setError(error instanceof Error ? error.message : '사용자 추가 중 오류가 발생했습니다.');
    } finally {
      setAddFormLoading(false);
    }
  };

  // 수정 다이얼로그 열기
  const handleEditClick = (user: JWSUser) => {
    setUserToEdit(user);
    setEditFormData({
      isActive: user.isActive
    });
    setEditDialogOpen(true);
    setEditLoading(false);
  };

  // 수정 다이얼로그 닫기
  const handleEditDialogClose = () => {
    if (editLoading) return;
    setEditDialogOpen(false);
    setUserToEdit(null);
    setEditFormData({ isActive: true });
  };

  // 사용자 상태 즉시 변경 (Auto-save)
  const handleStatusToggle = async (checked: boolean) => {
    if (!userToEdit) return;

    // 상태 먼저 업데이트 (UI 즉시 반영)
    setEditFormData(prev => ({ ...prev, isActive: checked }));

    try {
      setEditLoading(true);

      const updateData: Partial<JWSUser> = {
        isActive: checked
      };

      await updateUser(userToEdit.uid, updateData);
      // 성공 시 userToEdit 상태 업데이트 (모달 유지)
      setUserToEdit(prev => prev ? { ...prev, isActive: checked } : null);
      // users 목록도 업데이트 (DataGrid 반영)
      setUsers(prevUsers =>
        prevUsers.map(u => u.uid === userToEdit.uid ? { ...u, isActive: checked } : u)
      );
    } catch (error) {
      // Error handled silently
      // 실패 시 원래 상태로 복구
      setEditFormData(prev => ({ ...prev, isActive: !checked }));
      setError('계정 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  // 비밀번호 초기화 (수정 다이얼로그에서)
  const handlePasswordResetClick = (user: JWSUser) => {
    setUserToResetPassword(user);
    setResetPasswordDialogOpen(true);
    setResetPasswordLoading(false);
  };

  const handlePasswordResetConfirm = async () => {
    if (!userToResetPassword) return;

    setResetPasswordLoading(true);

    // 즉시 시작 알림 표시
    setSuccessMessage(`${userToResetPassword.name}님의 비밀번호 초기화를 시작합니다...`);

    try {
      await resetUserPassword(userToResetPassword.uid);
      setResetPasswordDialogOpen(false);
      setUserToResetPassword(null);
      setSuccessMessage(`${userToResetPassword.name}님의 비밀번호가 초기화되었습니다. 해당 사용자는 다음 로그인 시 비밀번호 변경이 필요합니다.`);
    } catch (error) {
      // Error handled silently
      setError(error instanceof Error ? error.message : '비밀번호 초기화 중 오류가 발생했습니다.');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // 고객사 상세 정보 모달 열기
  const handleCustomerDetailsClick = async (businessNumbers: string[]) => {
    if (!businessNumbers || businessNumbers.length === 0) return;

    setModalLoading(true);
    setCustomerDetailModalOpen(true);
    setModalCustomerDetails([]);

    try {
      const customerDetails: Customer[] = [];
      for (const businessNumber of businessNumbers) {
        const customer = await customerService.getCustomer(businessNumber);
        if (customer) {
          customerDetails.push(customer);
        }
      }
      setModalCustomerDetails(customerDetails);
    } catch (error) {
      // Error handled silently
      setError('고객사 정보를 불러올 수 없습니다.');
    } finally {
      setModalLoading(false);
    }
  };

  // 고객사 상세 정보 모달 닫기
  const handleCustomerDetailsClose = () => {
    setCustomerDetailModalOpen(false);
    setModalCustomerDetails([]);
    setModalLoading(false);
  };


  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);

    // 즉시 시작 알림 표시
    setSuccessMessage(`${userToDelete.name}님의 계정 삭제를 시작합니다...`);

    try {
      // Firebase Auth + Firestore 통합 삭제 (Cloud Function 호출)
      await deleteUserAccount(userToDelete.uid);

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setSuccessMessage('사용자가 완전히 삭제되었습니다. (Firebase Auth + Firestore)');
      loadUsers();
    } catch (error) {
      // Error handled silently
      setError('사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 삭제 핸들러
  const handleDeleteClick = (user: JWSUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
    setDeleteLoading(false); // 다이얼로그 열 때 로딩 상태 초기화
    // 수정 모달이 열려있으면 닫기
    if (editDialogOpen) {
      setEditDialogOpen(false);
      setUserToEdit(null);
    }
  };

  // 데이터그리드 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'mobile',
      headerName: 'ID(휴대폰번호)',
      flex: 0.15, // 15%
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {formatMobile(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'name',
      headerName: '이름',
      flex: 0.15, // 15%
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'role',
      headerName: '역할',
      flex: 0.15, // 15%
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value}
            variant="outlined"
            size="small"
            color={
              params.value === 'admin' ? 'error'
              : params.value === 'customer' ? 'primary'
              : 'default'
            }
            sx={{ fontSize: '0.75rem', minWidth: '80px' }}
          />
        </Box>
      ),
    },
    {
      field: 'connections',
      headerName: '연결',
      flex: 0.20, // 20%
      align: 'center',
      headerAlign: 'center',
      valueGetter: (value, row) => {
        if (row.role === 'customer') return row.linkedCustomers || [];
        if (row.role === 'supplier') return row.linkedSuppliers || [];
        return [];
      },
      renderCell: (params) => {
        const isCustomer = params.row.role === 'customer';
        const isSupplier = params.row.role === 'supplier';

        const customerCount = isCustomer ? (params.row.linkedCustomers?.length || 0) : 0;
        const supplierCount = isSupplier ? (params.row.linkedSuppliers?.length || 0) : 0;

        // admin, staff는 연결 없음
        if (!isCustomer && !isSupplier) {
          return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                -
              </Typography>
            </Box>
          );
        }

        // 고객사 사용자
        if (isCustomer) {
          return (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              height="100%"
              onClick={customerCount > 0 ? () => handleCustomerDetailsClick(params.row.linkedCustomers) : undefined}
              sx={customerCount > 0 ? { cursor: 'pointer' } : undefined}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: customerCount > 0 ? 'primary.main' : 'text.secondary',
                  fontWeight: customerCount > 0 ? 600 : 400
                }}
              >
                {customerCount}
              </Typography>
            </Box>
          );
        }

        // 공급사 사용자
        if (isSupplier) {
          return (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              height="100%"
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: supplierCount > 0 ? 'secondary.main' : 'text.secondary',
                  fontWeight: supplierCount > 0 ? 600 : 400
                }}
              >
                {supplierCount}
              </Typography>
            </Box>
          );
        }

        return null;
      },
    },
    {
      field: 'isActive',
      headerName: '상태',
      flex: 0.15, // 15%
      align: 'center',
      headerAlign: 'center',
      hideable: true,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value ? '활성' : '비활성'}
            size="small"
            color={params.value ? 'success' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: '수정',
      width: 60,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const isCurrentUser = currentUser?.uid === params.row.uid;

        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            {isCurrentUser ? (
              <Chip
                label="본인"
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: '20px' }}
              />
            ) : (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClick(params.row);
                }}
                sx={{ color: 'primary.main' }}
                title="사용자 수정"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      overflowX: 'hidden',
      p: 3,
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography
            variant="h4"
            component="h1"
            onClick={loadUsers}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            사용자 설정
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={loadUsers}
          disabled={loading}
          size="small"
        >
          새로고침
        </Button>
      </Box>

      {/* 사용자 추가 페이퍼 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, mb: 2 }}>
          사용자 추가
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* 칼럼 1 (40%): 휴대폰 번호, 이름 */}
          <Box sx={{ flex: '0 0 40%', display: 'flex', gap: 1 }}>
            <TextField
              ref={firstFieldRef}
              label="ID(휴대폰번호)"
              value={addFormData.mobile}
              onChange={(e) => setAddFormData(prev => ({ ...prev, mobile: formatNumberInput(e.target.value, 'mobile') }))}
              onKeyDown={handleKeyDown}
              fullWidth
              required
              placeholder="01012345678"
              size="small"
            />
            <TextField
              label="이름"
              value={addFormData.name}
              onChange={(e) => setAddFormData(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={handleKeyDown}
              fullWidth
              required
              size="small"
            />
          </Box>

          {/* 칼럼 2 (40%): 역할 선택 라디오 버튼 */}
          <Box sx={{ flex: '1', display: 'flex', alignItems: 'center' }}>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                row
                value={addFormData.role}
                onChange={(e) => setAddFormData(prev => ({ ...prev, role: e.target.value }))}
                sx={{ gap: 1, flexWrap: 'nowrap' }}
              >
                {userRoles.map((userRole) => (
                  <FormControlLabel
                    key={userRole.code}
                    value={userRole.code}
                    control={<Radio size="small" />}
                    label={userRole.name}
                    sx={{
                      border: '1px solid',
                      borderColor: addFormData.role === userRole.code ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      px: 1.5,
                      py: 0.5,
                      m: 0,
                      flex: '1',
                      minWidth: 0,
                      transition: 'all 0.2s',
                      bgcolor: addFormData.role === userRole.code ? 'primary.50' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50',
                        cursor: 'pointer'
                      },
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: addFormData.role === userRole.code ? 600 : 400,
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>

          {/* 칼럼 3 (20%): 초기화 아이콘 버튼 + 추가 버튼 */}
          <Box sx={{ flex: '0 0 20%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={resetForm}
              disabled={addFormLoading}
              color="default"
              title="초기화 (ESC)"
              size="small"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover'
                }
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <Button
              variant="contained"
              onClick={handleAddFormSubmit}
              disabled={addFormLoading}
              size="small"
              startIcon={<AddIcon />}
              sx={{ height: '40px', minWidth: '120px' }}
            >
              {addFormLoading ? '추가 중...' : '추가'}
            </Button>
          </Box>
        </Box>
      </Paper>
      {/* 에러 표시 */}
      {error && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
          <Box sx={{ width: '80%' }}>
            <Alert severity="error">
              {error}
            </Alert>
          </Box>
        </Box>
      )}
      {/* 사용자 목록 테이블 (100% 너비) */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', flex: 1, minHeight: 0 }}>
        <Paper sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>
            <DataGrid
              rows={users}
              columns={columns}
              loading={loading}
              disableRowSelectionOnClick
              disableColumnResize
              disableColumnMenu
              getRowId={(row) => row.uid}
              getRowClassName={(params) =>
                !params.row.isActive ? 'inactive-user-row' : ''
              }
              pagination
              paginationModel={{ page: 0, pageSize: 10 }}
              pageSizeOptions={[10, 20, 30]}
              sx={{
                border: 0,
                width: '100%',
                height: '100%',
                minWidth: 0,
                overflow: 'hidden',
                '& .MuiDataGrid-main': {
                  overflow: 'hidden'
                },
                '& .inactive-user-row': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  opacity: 0.7,
                  '& .MuiDataGrid-cell': {
                    color: 'text.secondary',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                    opacity: 0.8,
                  },
                },
                '& .MuiDataGrid-cell': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  wordBreak: 'break-word',
                  padding: '8px 4px',
                },
                '& .MuiDataGrid-columnHeader': {
                  padding: '8px 4px',
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
              slotProps={{
                loadingOverlay: {
                  variant: 'skeleton',
                  noRowsVariant: 'skeleton',
                },
              }}
            />
          </Box>
        </Paper>
      </Box>
      {/* 성공/에러 메시지 */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={deleteLoading ? undefined : () => setDeleteDialogOpen(false)}
        disableEscapeKeyDown={deleteLoading}
      >
        <DialogTitle sx={{ color: deleteLoading ? 'primary.main' : 'error.main' }}>
          {deleteLoading ? '🗑️ 사용자 삭제 진행 중' : '⚠️ 사용자 삭제 확인'}
        </DialogTitle>
        <DialogContent>
          {deleteLoading ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography>
                  <strong>'{userToDelete?.name}'</strong>님의 계정을 삭제하고 있습니다...
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • Firebase Auth에서 사용자 인증 정보를 삭제 중입니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • Firestore에서 사용자 데이터를 삭제 중입니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 예상 소요 시간: 3-5초
              </Typography>
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                ⏳ 잠시만 기다려주세요...
              </Typography>
            </>
          ) : (
            <>
              <Typography sx={{ mb: 2 }}>
                <strong>'{userToDelete?.name}'</strong> 사용자를 정말 삭제하시겠습니까?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • Firebase Auth와 Firestore에서 모든 데이터가 완전히 삭제됩니다.
              </Typography>
              <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                ⚠️ 이 작업은 되돌릴 수 없습니다.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleteLoading}
          >
            {deleteLoading ? '처리 중...' : '취소'}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color={deleteLoading ? 'primary' : 'error'}
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {deleteLoading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* 비밀번호 초기화 확인 다이얼로그 */}
      <Dialog
        open={resetPasswordDialogOpen}
        onClose={resetPasswordLoading ? undefined : () => setResetPasswordDialogOpen(false)}
        disableEscapeKeyDown={resetPasswordLoading}
      >
        <DialogTitle sx={{ color: resetPasswordLoading ? 'primary.main' : 'warning.main' }}>
          {resetPasswordLoading ? '🔄 비밀번호 초기화 진행 중' : '⚠️ 비밀번호 초기화 확인'}
        </DialogTitle>
        <DialogContent>
          {resetPasswordLoading ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography>
                  <strong>'{userToResetPassword?.name}'</strong>님의 비밀번호를 초기화하고 있습니다...
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • Firebase Auth 서버와 통신 중입니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 예상 소요 시간: 3-5초
              </Typography>
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                ⏳ 잠시만 기다려주세요...
              </Typography>
            </>
          ) : (
            <>
              <Typography sx={{ mb: 2 }}>
                <strong>'{userToResetPassword?.name}'</strong> 사용자의 비밀번호를 초기화하시겠습니까?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 새 비밀번호는 휴대폰 뒷자리 4자리를 2번 반복한 형태입니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 예: 010-1234-5678 → 새 비밀번호: 56785678
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                ✅ Firebase Auth와 연동되어 실제 로그인 비밀번호가 변경됩니다.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setResetPasswordDialogOpen(false)}
            disabled={resetPasswordLoading}
          >
            {resetPasswordLoading ? '처리 중...' : '취소'}
          </Button>
          <Button
            onClick={handlePasswordResetConfirm}
            color={resetPasswordLoading ? 'primary' : 'warning'}
            variant="contained"
            disabled={resetPasswordLoading}
            startIcon={resetPasswordLoading ? <CircularProgress size={20} color="inherit" /> : <VpnKeyIcon />}
          >
            {resetPasswordLoading ? '처리 중...' : '초기화 실행'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 사용자 수정 다이얼로그 */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditDialogClose}
        disableEscapeKeyDown={editLoading}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          ✏️ 사용자 정보 수정
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
              {/* 사용자 기본 정보 */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      휴대폰번호(ID)
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {userToEdit?.mobile ? formatMobile(userToEdit.mobile) : ''}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      이름
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {userToEdit?.name}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      역할
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {userToEdit?.role}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* 상태 변경 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                  계정 상태
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    계정 활성 상태
                  </Typography>
                  <Switch
                    checked={editFormData.isActive}
                    onChange={(e) => handleStatusToggle(e.target.checked)}
                    disabled={editLoading}
                    color="success"
                  />
                  <Chip
                    label={editFormData.isActive ? '활성' : '비활성'}
                    size="small"
                    color={editFormData.isActive ? 'success' : 'default'}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  비활성 계정은 로그인할 수 없습니다.
                </Typography>
              </Box>

              {/* 비밀번호 초기화 (supplier 제외) */}
              {userToEdit?.role !== 'supplier' && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                    비밀번호 관리
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.200' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        비밀번호 초기화
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        color="warning"
                        startIcon={<VpnKeyIcon />}
                        onClick={() => userToEdit && handlePasswordResetClick(userToEdit)}
                      >
                        초기화
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      비밀번호를 휴대폰 뒷자리 4자리 2회 반복으로 초기화합니다. (예: 5678 → 56785678)
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* 사용자 삭제 */}
              <Box>
                <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                  위험 구역
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.200' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      사용자 완전 삭제
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => userToEdit && handleDeleteClick(userToEdit)}
                    >
                      삭제
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Firebase Auth와 Firestore에서 모든 데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  </Typography>
                </Box>
              </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleEditDialogClose}
            disabled={editLoading}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 고객사 상세 정보 모달 */}
      <Dialog
        open={customerDetailModalOpen}
        onClose={handleCustomerDetailsClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          고객사 상세 정보
        </DialogTitle>
        <DialogContent>
          {modalLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                고객사 정보를 불러오는 중...
              </Typography>
            </Box>
          ) : modalCustomerDetails.length > 0 ? (
            <Box sx={{ pt: 1 }}>
              {modalCustomerDetails.map((customer, index) => (
                <Paper
                  key={customer.businessNumber}
                  sx={{
                    p: 2,
                    mb: index < modalCustomerDetails.length - 1 ? 2 : 0,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">
                        사업자등록번호
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {customer.businessNumber}
                      </Typography>
                    </Grid>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">
                        상호명
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {customer.businessName}
                      </Typography>
                    </Grid>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">
                        대표자
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {customer.president}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">
                        고객사 유형
                      </Typography>
                      <Typography variant="body1">
                        {customer.customerType}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">
                        할인율
                      </Typography>
                      <Typography variant="body1">
                        {customer.discountRate}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              연결된 고객사 정보가 없습니다.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCustomerDetailsClose}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default UserSettings;