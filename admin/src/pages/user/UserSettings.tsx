/**
 * 파일 경로: /src/pages/user/UserSettings.tsx
 * 작성 날짜: 2025-09-27
 * 주요 내용: 사용자 설정 페이지
 * 관련 데이터: users 컬렉션
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
    FormControlLabel,
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
  Checkbox,
  FormGroup,
      } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import {
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { getUsers, deleteUserAccount, createUser, updateUser, resetUserPassword, canDeleteUser } from '../../services/userService';
import { customerService } from '../../services/customerService';
import { supplierService } from '../../services/supplierService';
import { settingsService } from '../../services/settingsService';
import { customerLinkService } from '../../services/customerLinkService';
import { formatMobile, normalizeNumber, formatNumberInput, isValidMobile } from '../../utils/numberUtils';
import type { JWSUser } from '../../types/user';
import type { Customer } from '../../types/company';
import type { NormalizedMobile, NormalizedBusinessNumber } from '../../types/phoneNumber';
import { useAuth } from '../../hooks/useAuth';

interface AddFormData {
  name: string;
  mobile: string;
  roles: string[]; // settings의 코드 값 배열 (예: ["0", "1"])
  // primaryRole은 제거 - 우선순위 로직으로 자동 계산 (admin > staff > customer > supplier)
}

const UserSettings: React.FC = () => {
  // 현재 로그인한 사용자 정보
  const { user: currentUser } = useAuth();

  // 기본 상태 관리
  const [users, setUsers] = useState<JWSUser[]>([]);
  const [userRoles, setUserRoles] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고객사/공급사 상호명 매핑 (businessNumber -> businessName)
  const [companyNamesMap, setCompanyNamesMap] = useState<Map<string, string>>(new Map());


  const [addFormData, setAddFormData] = useState<AddFormData>({
    name: '',
    mobile: '',
    roles: ['1'], // 기본값: 직원 (settings의 코드)
  });
  const [addFormLoading, setAddFormLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<JWSUser | null>(null);
  const [editFormData, setEditFormData] = useState<{
    isActive: boolean;
  }>({
    isActive: true
  });
  const [editLoading, setEditLoading] = useState(false);

  // 삭제 관련 상태
  const [userToDelete, setUserToDelete] = useState<JWSUser | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState(false);

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

  // 페이지네이션 및 정렬 상태
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [sortModel, setSortModel] = useState([
    { field: 'mobile', sort: 'asc' as const },
  ]);

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

      // 고객사/공급사 상호명 로드
      const companyMap = new Map<string, string>();

      // 모든 사용자의 연결된 고객사/공급사 번호 수집
      const customerNumbers = new Set<string>();
      const supplierNumbers = new Set<string>();

      userData.forEach(user => {
        if (user.linkedCustomers) {
          user.linkedCustomers.forEach(num => customerNumbers.add(num));
        }
        if (user.linkedSuppliers) {
          user.linkedSuppliers.forEach(num => supplierNumbers.add(num));
        }
      });

      // 고객사 정보 로드
      const customerPromises = Array.from(customerNumbers).map(async (businessNumber) => {
        try {
          const customer = await customerService.getCustomer(businessNumber);
          if (customer) {
            companyMap.set(businessNumber, customer.businessName);
          }
        } catch {
          // 고객사 로드 실패 시 무시
        }
      });

      // 공급사 정보 로드
      const supplierPromises = Array.from(supplierNumbers).map(async (businessNumber) => {
        try {
          const supplier = await supplierService.getSupplierById(businessNumber);
          if (supplier) {
            companyMap.set(businessNumber, supplier.businessName);
          }
        } catch {
          // 공급사 로드 실패 시 무시
        }
      });

      await Promise.all([...customerPromises, ...supplierPromises]);
      setCompanyNamesMap(companyMap);

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
      roles: [], // 기본값: 없음 (사용자가 선택)
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

  // 추가 다이얼로그 열기
  const handleAddDialogOpen = () => {
    resetForm(); // 폼 초기화
    setError(null); // 에러 초기화
    setAddDialogOpen(true);
  };

  // 추가 다이얼로그 닫기
  const handleAddDialogClose = () => {
    if (addFormLoading) return; // 로딩 중에는 닫기 방지
    setAddDialogOpen(false);
    resetForm();
    setError(null);
  };

  // 사용자 추가 폼 제출
  const handleAddFormSubmit = async () => {
    // 폼 검증 - 다중 역할 지원
    if (!addFormData.name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    if (!addFormData.mobile.trim()) {
      setError('휴대폰번호를 입력하세요.');
      return;
    }

    // 휴대폰번호 형식 검증 (010-XXXX-XXXX만 허용)
    const normalizedMobileCheck = normalizeNumber(addFormData.mobile);
    if (!isValidMobile(normalizedMobileCheck)) {
      setError('올바른 휴대폰번호 형식이 아닙니다. (010-XXXX-XXXX)\n일반 전화번호는 SMS 수신이 불가능합니다.');
      return;
    }

    if (addFormData.roles.length === 0) {
      setError('최소 하나의 역할을 선택하세요.');
      return;
    }

    // 휴대폰번호 정규화 (저장용)
    const normalizedMobile = normalizeNumber(addFormData.mobile);

    // 실제 역할 변환
    const actualRoles = addFormData.roles.map(code => settingsService.codeToUserRole(code));
    // primaryRole은 서비스 계층에서 자동 계산됨 (admin > staff > customer > supplier)
    let linkedCustomers: string[] = [];

    // customer 역할이 포함된 경우
    if (actualRoles.includes('customer')) {
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

      } catch {
      // Error handled silently
        // SMS 수신자 확인 실패 시에도 빈 배열로 사용자 생성 계속 진행
        linkedCustomers = [];
      }
    }

    try {
      setAddFormLoading(true);

      // 중복 체크 - 휴대폰번호로만 체크 (다중 역할이므로 역할별 중복 체크는 불필요)
      const allUsers = await getUsers();
      const existingUser = allUsers.find(u => u.mobile === normalizedMobile);

      if (existingUser) {
        setError(`이미 등록된 휴대폰 번호입니다. (등록된 사용자: ${existingUser.name}, 역할: ${existingUser.roles.join(', ')})`);
        return;
      }

      const userData: Partial<JWSUser> = {
        name: addFormData.name,
        mobile: normalizedMobile as NormalizedMobile,
        roles: actualRoles,
        // primaryRole은 자동 계산됨
        isActive: true,
        requiresPasswordChange: true
      };

      // customer 역할이 포함된 경우 linkedCustomers 필드 추가
      if (actualRoles.includes('customer')) {
        userData.linkedCustomers = (linkedCustomers || []) as NormalizedBusinessNumber[];
      }

      // supplier 역할이 포함된 경우 linkedSuppliers 필드 추가 (빈 배열)
      if (actualRoles.includes('supplier')) {
        userData.linkedSuppliers = [] as NormalizedBusinessNumber[];
      }

      const result = await createUser(userData);

      // supplier만 있는 경우 로그인 안 함
      const hasOnlySupplierRole = actualRoles.length === 1 && actualRoles[0] === 'supplier';
      if (hasOnlySupplierRole) {
        setSuccessMessage(`공급사 사용자가 추가되었습니다. (Firebase Auth 미사용)`);
      } else {
        setSuccessMessage(`사용자가 추가되었습니다. 역할: ${actualRoles.join(', ')} | 기본 비밀번호: ${result.defaultPassword} (첫 로그인 시 비밀번호 변경 필수)`);
      }

      setAddDialogOpen(false); // 성공 시 다이얼로그 닫기
      resetForm();
      setError(null);
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
    setDeleteConfirmMode(false); // 삭제 확인 모드 초기화
  };

  // 수정 다이얼로그 닫기
  const handleEditDialogClose = () => {
    if (editLoading) return;
    setEditDialogOpen(false);
    setUserToEdit(null);
    setEditFormData({ isActive: true });
    setDeleteConfirmMode(false); // 삭제 확인 모드 초기화
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
    } catch {
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

  // 고객사 상세 정보 모달 닫기
  const handleCustomerDetailsClose = () => {
    setCustomerDetailModalOpen(false);
    setModalCustomerDetails([]);
    setModalLoading(false);
  };


  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setEditLoading(true); // editLoading 사용 (edit 모달 내부에서 동작)

    // 즉시 시작 알림 표시
    setSuccessMessage(`${userToDelete.name}님의 계정 삭제를 확인하고 있습니다...`);

    try {
      // 삭제 가능 여부 확인 (실제 존재하는 회사만 확인)
      const checkResult = await canDeleteUser(userToDelete.uid);

      if (!checkResult.canDelete) {
        setEditLoading(false);
        setDeleteConfirmMode(false);
        setSuccessMessage(null);
        setError(checkResult.reason || '사용자를 삭제할 수 없습니다.');
        return;
      }

      setSuccessMessage(`${userToDelete.name}님의 계정 삭제를 시작합니다...`);

      // Firebase Auth + Firestore 통합 삭제 (Cloud Function 호출)
      await deleteUserAccount(userToDelete.uid);

      // 성공 시 모달 닫기
      setEditDialogOpen(false);
      setUserToEdit(null);
      setDeleteConfirmMode(false);
      setSuccessMessage('사용자가 완전히 삭제되었습니다. (Firebase Auth + Firestore)');
      loadUsers();
    } catch (error) {
      // Error handled silently
      setError(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
      setDeleteConfirmMode(false); // 오류 시 확인 모드 해제
    } finally {
      setEditLoading(false);
    }
  };

  // 인라인 삭제 확인 핸들러
  const handleInlineDeleteConfirm = async () => {
    if (!userToEdit) return;

    // userToDelete 설정 후 삭제 실행
    setUserToDelete(userToEdit);
    await handleDeleteConfirm();
  };

  // 데이터그리드 컬럼 정의
  const columns: GridColDef[] = useMemo(() => [
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
      flex: 0.20, // 20%
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
      field: 'roles',
      headerName: '역할',
      flex: 0.20, // 20%
      align: 'center',
      headerAlign: 'center',
      // 정렬을 위해 역할 배열을 문자열로 변환 (우선순위: admin > staff > customer > supplier)
      valueGetter: (value, row) => {
        const roles = row.roles || [row.primaryRole];
        // 정렬용: 우선순위 높은 역할 순으로 정렬
        const priority = { admin: 1, staff: 2, customer: 3, supplier: 4 };
        const sortedRoles = [...roles].sort((a, b) => (priority[a] || 999) - (priority[b] || 999));
        return sortedRoles.join(', ');
      },
      renderCell: (params) => {
        const roles = params.row.roles || [params.row.primaryRole];
        const primaryRole = params.row.primaryRole;

        return (
          <Box
            display="flex"
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            height="100%"
            gap={0.5}
            py={0.5}
            flexWrap="wrap"
          >
            {roles.map((role: string) => (
              <Chip
                key={role}
                label={role}
                variant="outlined"
                size="small"
                color={
                  role === 'admin' ? 'error'
                  : role === 'staff' ? 'info'
                  : role === 'customer' ? 'primary'
                  : role === 'supplier' ? 'warning'
                  : 'default'
                }
                sx={{
                  fontSize: '0.65rem',
                  minWidth: '60px',
                  fontWeight: role === primaryRole ? 600 : 400
                }}
              />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'connections',
      headerName: '상호',
      flex: 0.25, // 25%
      align: 'center',
      headerAlign: 'center',
      // 정렬을 위해 상호명 배열을 문자열로 변환
      valueGetter: (value, row) => {
        const roles = row.roles || [row.primaryRole];
        const isCustomer = roles.includes('customer');
        const isSupplier = roles.includes('supplier');

        // admin, staff만 있는 경우
        if (!isCustomer && !isSupplier) {
          return '';
        }

        // 연결된 상호 목록 수집
        const companyNames: string[] = [];

        if (isCustomer && row.linkedCustomers) {
          row.linkedCustomers.forEach((businessNumber: string) => {
            const name = companyNamesMap.get(businessNumber);
            if (name) {
              companyNames.push(name);
            }
          });
        }

        if (isSupplier && row.linkedSuppliers) {
          row.linkedSuppliers.forEach((businessNumber: string) => {
            const name = companyNamesMap.get(businessNumber);
            if (name) {
              companyNames.push(name);
            }
          });
        }

        // 정렬용: 상호명을 쉼표로 연결
        return companyNames.join(', ');
      },
      renderCell: (params) => {
        const roles = params.row.roles || [params.row.primaryRole];
        const isCustomer = roles.includes('customer');
        const isSupplier = roles.includes('supplier');

        // admin, staff만 있는 경우 연결 없음
        if (!isCustomer && !isSupplier) {
          return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                -
              </Typography>
            </Box>
          );
        }

        // 연결된 상호 목록 수집
        const companyNames: string[] = [];

        if (isCustomer && params.row.linkedCustomers) {
          params.row.linkedCustomers.forEach((businessNumber: string) => {
            const name = companyNamesMap.get(businessNumber);
            if (name) {
              companyNames.push(name);
            }
          });
        }

        if (isSupplier && params.row.linkedSuppliers) {
          params.row.linkedSuppliers.forEach((businessNumber: string) => {
            const name = companyNamesMap.get(businessNumber);
            if (name) {
              companyNames.push(name);
            }
          });
        }

        // 연결이 없는 경우
        if (companyNames.length === 0) {
          return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                -
              </Typography>
            </Box>
          );
        }

        // 상호 표시 (1개: 가로, 2개 이상: 세로)
        return (
          <Box
            display="flex"
            flexDirection={companyNames.length > 1 ? 'column' : 'row'}
            alignItems="center"
            justifyContent="center"
            height="100%"
            gap={0.3}
            py={0.5}
          >
            {companyNames.map((name, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.primary',
                  fontWeight: 500,
                  textAlign: 'center'
                }}
              >
                {name}
              </Typography>
            ))}
          </Box>
        );
      },
    },
    {
      field: 'isActive',
      headerName: '상태',
      flex: 0.10, // 10%
      align: 'center',
      headerAlign: 'center',
      hideable: true,
      // 정렬: 활성(true)이 먼저 오도록
      valueGetter: (value, row) => row.isActive ? 1 : 0,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.row.isActive ? '활성' : '비활성'}
            size="small"
            color={params.row.isActive ? 'success' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: '수정',
      flex: 0.10, // 10%
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
  ], [companyNamesMap, currentUser]);

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddDialogOpen}
            size="small"
          >
            사용자 추가
          </Button>
          <Button
            variant="outlined"
            onClick={loadUsers}
            disabled={loading}
            size="small"
          >
            새로고침
          </Button>
        </Box>
      </Box>

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
              getRowId={(row) => row.uid}
              getRowClassName={(params) =>
                !params.row.isActive ? 'inactive-user-row' : ''
              }
              // 페이지네이션
              pagination
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 20, 30, 50]}
              // 정렬
              sortModel={sortModel}
              onSortModelChange={setSortModel}
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
                <Box sx={{ display: 'grid', gridTemplateColumns: '3fr 3fr 4fr', gap: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {userToEdit?.roles?.map((role: string) => (
                        <Chip
                          key={role}
                          label={role === userToEdit.primaryRole ? `${role} (주요)` : role}
                          variant={role === userToEdit.primaryRole ? 'filled' : 'outlined'}
                          size="small"
                          color={
                            role === 'admin' ? 'error'
                            : role === 'staff' ? 'info'
                            : role === 'customer' ? 'primary'
                            : role === 'supplier' ? 'warning'
                            : 'default'
                          }
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ gridColumn: 'span 3', borderTop: '1px solid', borderColor: 'divider', pt: 2, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      계정 상태
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        비활성 계정은 로그인할 수 없습니다
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* 비밀번호 초기화 (supplier만 있는 경우 제외) */}
              {!(userToEdit?.roles?.length === 1 && userToEdit?.roles[0] === 'supplier') && (
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {deleteConfirmMode && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setDeleteConfirmMode(false)}
                          disabled={editLoading}
                        >
                          취소
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        startIcon={editLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                        onClick={() => deleteConfirmMode ? handleInlineDeleteConfirm() : setDeleteConfirmMode(true)}
                        disabled={editLoading}
                      >
                        {editLoading ? '삭제 중...' : deleteConfirmMode ? '삭제 확인' : '삭제'}
                      </Button>
                    </Box>
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

      {/* 사용자 추가 다이얼로그 */}
      <Dialog
        open={addDialogOpen}
        onClose={handleAddDialogClose}
        disableEscapeKeyDown={addFormLoading}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          ➕ 사용자 추가
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }} role="form">
            {/* 에러 표시 */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* ID(휴대폰번호)와 이름 같은 줄 배치 */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={6}>
                <TextField
                  ref={firstFieldRef}
                  fullWidth
                  label="ID(휴대폰번호)"
                  value={addFormData.mobile}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, mobile: formatNumberInput(e.target.value, 'mobile') }))}
                  onKeyDown={handleKeyDown}
                  placeholder="01012345678"
                  required
                  autoFocus
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="이름"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  required
                />
              </Grid>
            </Grid>

            {/* 역할 선택 */}
            <FormControl component="fieldset" fullWidth>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                역할 선택 (복수 가능) *
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                관리자와 직원은 둘 중 하나만 선택 가능합니다
              </Typography>
              <FormGroup row sx={{ gap: 1 }}>
                {userRoles.map((userRole) => (
                  <FormControlLabel
                    key={userRole.code}
                    control={
                      <Checkbox
                        checked={addFormData.roles.includes(userRole.code)}
                        onChange={(e) => {
                          const roleCode = userRole.code;

                          if (e.target.checked) {
                            // 체크 시
                            if (roleCode === '0') {
                              // 관리자 선택 시 직원 제거
                              setAddFormData(prev => ({
                                ...prev,
                                roles: [...prev.roles.filter(r => r !== '1'), roleCode]
                              }));
                            } else if (roleCode === '1') {
                              // 직원 선택 시 관리자 제거
                              setAddFormData(prev => ({
                                ...prev,
                                roles: [...prev.roles.filter(r => r !== '0'), roleCode]
                              }));
                            } else {
                              // 고객사나 공급사는 그냥 추가
                              setAddFormData(prev => ({
                                ...prev,
                                roles: [...prev.roles, roleCode]
                              }));
                            }
                          } else {
                            // 체크 해제 시
                            setAddFormData(prev => ({
                              ...prev,
                              roles: prev.roles.filter(r => r !== roleCode)
                            }));
                          }
                        }}
                      />
                    }
                    label={userRole.name}
                    sx={{
                      border: '1px solid',
                      borderColor: addFormData.roles.includes(userRole.code) ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      px: 1.5,
                      py: 0.5,
                      m: 0,
                      flex: '1',
                      minWidth: 0,
                      bgcolor: addFormData.roles.includes(userRole.code) ? 'primary.50' : 'transparent',
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: addFormData.roles.includes(userRole.code) ? 600 : 400,
                      }
                    }}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleAddDialogClose}
            disabled={addFormLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleAddFormSubmit}
            variant="contained"
            disabled={addFormLoading}
            startIcon={addFormLoading ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
          >
            {addFormLoading ? '추가 중...' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default UserSettings;