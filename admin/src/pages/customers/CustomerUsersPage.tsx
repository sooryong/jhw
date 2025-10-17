/**
 * 파일 경로: /src/pages/customers/CustomerUsersPage.tsx
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 사용자 관리 페이지
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { getCustomer } from '../../services/customerService';
import {
  getCustomerUsers,
  createCustomerUser,
  removeUserFromCustomer,
  toggleUserActive,
  type CustomerUserListItem,
  type CreateCustomerUserData
} from '../../services/customerUserService';
import type { Customer } from '../../types/company';
import type { CustomerUserRole } from '../../types/user';
import { formatMobile } from '../../utils/numberUtils';

const CustomerUsersPage = () => {
  const { businessNumber } = useParams<{ businessNumber: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [users, setUsers] = useState<CustomerUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용자 추가 다이얼로그
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState<Partial<CreateCustomerUserData>>({
    name: '',
    mobile: '',
    customerId: businessNumber || '',
    customerRole: 'member'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessNumber) {
      loadData();
    }
  }, [businessNumber]);

  const loadData = async () => {
    if (!businessNumber) return;

    setLoading(true);
    setError(null);

    try {
      const [customerData, usersData] = await Promise.all([
        getCustomer(businessNumber),
        getCustomerUsers(businessNumber)
      ]);

      setCustomer(customerData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.mobile || !businessNumber) {
      setError('이름과 휴대폰번호를 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createCustomerUser({
        name: newUser.name,
        mobile: newUser.mobile,
        customerId: businessNumber,
        customerRole: newUser.customerRole || 'member'
      });

      await loadData();
      setAddDialogOpen(false);
      setNewUser({
        name: '',
        mobile: '',
        customerId: businessNumber,
        customerRole: 'member'
      });
    } catch (error) {
      console.error('Error adding user:', error);
      setError((error as Error).message || '사용자 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!businessNumber) return;

    if (!confirm('이 사용자를 고객사에서 제거하시겠습니까?')) {
      return;
    }

    try {
      await removeUserFromCustomer(userId, businessNumber);
      await loadData();
    } catch (error) {
      console.error('Error removing user:', error);
      setError((error as Error).message || '사용자 제거에 실패했습니다.');
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleUserActive(userId, !currentStatus);
      await loadData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError((error as Error).message || '사용자 상태 변경에 실패했습니다.');
    }
  };


  const getRoleLabel = (role: CustomerUserRole): string => {
    switch (role) {
      case 'primary':
        return '주 담당자';
      case 'secondary':
        return '부 담당자';
      case 'member':
        return '일반 사용자';
      default:
        return role;
    }
  };

  const getRoleColor = (role: CustomerUserRole): 'primary' | 'secondary' | 'default' => {
    switch (role) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!customer) {
    return (
      <Container>
        <Alert severity="error">고객사 정보를 찾을 수 없습니다.</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {/* 헤더 */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate(`/customers/${businessNumber}`)}>
                  <ArrowBackIcon />
                </IconButton>
                <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    사용자 관리
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {customer.businessName}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
              >
                사용자 추가
              </Button>
            </Box>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Box sx={{ px: 2, pb: 1 }}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Box>
          )}

          {/* 사용자 목록 */}
          <Box sx={{ px: 2, pb: 2 }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell>이름</TableCell>
                    <TableCell>휴대폰번호</TableCell>
                    <TableCell align="center">역할</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">최근 로그인</TableCell>
                    <TableCell align="center">비밀번호 변경 필요</TableCell>
                    <TableCell align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        등록된 사용자가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{formatMobile(user.mobile)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getRoleLabel(user.customerRole)}
                            color={getRoleColor(user.customerRole)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={user.isActive ? '활성' : '비활성'}
                            color={user.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ko-KR') : '-'}
                        </TableCell>
                        <TableCell align="center">
                          {user.requiresPasswordChange ? (
                            <Chip label="필요" color="warning" size="small" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleToggleActive(user.uid, user.isActive)}
                            title={user.isActive ? '비활성화' : '활성화'}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {user.customerRole !== 'primary' && (
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveUser(user.uid)}
                              title="제거"
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      </Container>

      {/* 사용자 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onClose={() => !saving && setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>새 사용자 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="이름"
              value={newUser.name || ''}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              fullWidth
              required
              disabled={saving}
            />
            <TextField
              label="휴대폰번호"
              value={newUser.mobile || ''}
              onChange={(e) => {
                // 숫자만 추출
                const numbersOnly = e.target.value.replace(/[^0-9]/g, '');
                // 11자리로 제한
                const limited = numbersOnly.slice(0, 11);
                // 포맷팅 적용
                let formatted = limited;
                if (limited.length >= 4) {
                  if (limited.length >= 8) {
                    formatted = `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
                  } else {
                    formatted = `${limited.slice(0, 3)}-${limited.slice(3)}`;
                  }
                }
                setNewUser({ ...newUser, mobile: formatted });
              }}
              placeholder="01012345678"
              fullWidth
              required
              disabled={saving}
            />
            <FormControl fullWidth>
              <InputLabel>역할</InputLabel>
              <Select
                value={newUser.customerRole || 'member'}
                onChange={(e) => setNewUser({ ...newUser, customerRole: e.target.value as CustomerUserRole })}
                label="역할"
                disabled={saving}
              >
                <MenuItem value="primary">주 담당자</MenuItem>
                <MenuItem value="secondary">부 담당자</MenuItem>
                <MenuItem value="member">일반 사용자</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleAddUser}
            variant="contained"
            disabled={saving || !newUser.name || !newUser.mobile}
          >
            {saving ? <CircularProgress size={24} /> : '추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerUsersPage;
