/**
 * 파일 경로: /src/pages/user/UserChangePasswordPage.tsx
 * 작성 날짜: 2025-09-27
 * 주요 내용: 사용자 자체 비밀번호 변경 페이지
 * 관련 데이터: Firebase Auth, 사용자 친화적 비밀번호 변경
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Cancel,
  ArrowBack,
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';

interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    id: 'length',
    label: '최소 6자 이상',
    test: (password) => password.length >= 6
  }
];

const UserChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { user, refreshUser } = useAuth();

  const getPasswordStrength = (password: string): number => {
    const passedRequirements = passwordRequirements.filter(req => req.test(password)).length;
    return (passedRequirements / passwordRequirements.length) * 100;
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 40) return 'error';
    if (strength < 80) return 'warning';
    return 'success';
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 40) return '약함';
    if (strength < 80) return '보통';
    return '강함';
  };

  const isPasswordValid = (): boolean => {
    return passwordRequirements.every(req => req.test(newPassword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (!isPasswordValid()) {
      setError('새 비밀번호가 보안 요구사항을 만족하지 않습니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const changePasswordFunction = httpsCallable(functions, 'changeUserPassword');
      const result = await changePasswordFunction({
        currentPassword,
        newPassword
      });

      const data = result.data as { success: boolean; message?: string; error?: string };

      if (!data.success) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      }

      // 사용자 정보 새로고침
      await refreshUser();

      // 성공 처리
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error: unknown) {
      // 비밀번호 변경 오류 처리

      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message?: string };
        if (firebaseError.code === 'functions/invalid-argument') {
          setError(firebaseError.message || '잘못된 요청입니다.');
        } else if (firebaseError.code === 'functions/unauthenticated') {
          setError('인증이 필요합니다. 다시 로그인해주세요.');
        } else {
          setError(firebaseError.message || '비밀번호 변경 중 오류가 발생했습니다.');
        }
      } else {
        setError('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
            <Lock sx={{ fontSize: 28, color: 'primary.main', mr: 1 }} />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: 'primary.main' }}>
              비밀번호 변경
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.
          </Typography>
          {user && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
              {user.name} ({user.mobile})
            </Typography>
          )}
        </Box>

        {/* 비밀번호 변경 폼 */}
        <Box component="form" onSubmit={handleSubmit}>
          {/* 현재 비밀번호 */}
          <TextField
            fullWidth
            type={showCurrentPassword ? 'text' : 'password'}
            label="현재 비밀번호"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: <Lock sx={{ color: 'text.secondary', mr: 1 }} />,
              endAdornment: (
                <IconButton
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  edge="end"
                  size="small"
                >
                  {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          {/* 새 비밀번호 */}
          <TextField
            fullWidth
            type={showNewPassword ? 'text' : 'password'}
            label="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <Lock sx={{ color: 'text.secondary', mr: 1 }} />,
              endAdornment: (
                <IconButton
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  edge="end"
                  size="small"
                >
                  {showNewPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          {/* 비밀번호 강도 표시 */}
          {newPassword && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  비밀번호 강도
                </Typography>
                <Typography
                  variant="body2"
                  color={`${getPasswordStrengthColor(passwordStrength)}.main`}
                  sx={{ fontWeight: 600 }}
                >
                  {getPasswordStrengthLabel(passwordStrength)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={passwordStrength}
                color={getPasswordStrengthColor(passwordStrength) as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {/* 비밀번호 요구사항 */}
          {newPassword && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                비밀번호 요구사항:
              </Typography>
              <List dense sx={{ py: 0 }}>
                {passwordRequirements.map((requirement) => {
                  const isValid = requirement.test(newPassword);
                  return (
                    <ListItem key={requirement.id} sx={{ py: 0.5, px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {isValid ? (
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <Cancel sx={{ fontSize: 16, color: 'text.disabled' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={requirement.label}
                        primaryTypographyProps={{
                          variant: 'body2',
                          color: isValid ? 'success.main' : 'text.secondary'
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}

          {/* 비밀번호 확인 */}
          <TextField
            fullWidth
            type={showConfirmPassword ? 'text' : 'password'}
            label="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            error={confirmPassword !== '' && newPassword !== confirmPassword}
            helperText={
              confirmPassword !== '' && newPassword !== confirmPassword
                ? '비밀번호가 일치하지 않습니다'
                : ''
            }
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: <Lock sx={{ color: 'text.secondary', mr: 1 }} />,
              endAdornment: (
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  size="small"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 변경 버튼 */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || !isPasswordValid() || newPassword !== confirmPassword}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </Box>

        {/* 보안 안내 */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            💡 <strong>보안 팁:</strong> 정기적으로 비밀번호를 변경하고, 다른 사이트와 다른 비밀번호를 사용하세요.
          </Typography>
        </Box>
      </Paper>

      {/* 성공 메시지 스낵바 */}
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success" sx={{ width: '100%' }}>
          비밀번호가 성공적으로 변경되었습니다!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserChangePasswordPage;