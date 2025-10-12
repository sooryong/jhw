/**
 * 파일 경로: /src/pages/auth/ChangePasswordPage.tsx
 * 작성 날짜: 2025-09-27
 * 주요 내용: 강제 비밀번호 변경 페이지
 * 관련 데이터: Firebase Auth, 비밀번호 보안 정책
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Container,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import JHWLogo from '../../assets/JHWLogo';

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

const ChangePasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // 신규 사용자 여부 확인
  const isNewUser = user?.requiresPasswordChange ?? false;

  const isPasswordValid = (): boolean => {
    return passwordRequirements.every(req => req.test(newPassword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 신규 사용자가 아닌 경우 현재 비밀번호 필수
    if (!isNewUser && !currentPassword) {
      setError('현재 비밀번호를 입력해주세요.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('새 비밀번호를 입력해주세요.');
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

    if (!isNewUser && currentPassword === newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const changePasswordFunction = httpsCallable(functions, 'changeUserPassword');
      const result = await changePasswordFunction({
        currentPassword: isNewUser ? undefined : currentPassword,
        newPassword
      });

      const data = result.data as { success: boolean; message?: string; error?: string };

      if (!data.success) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      }

      // 사용자 정보 새로고침하여 requiresPasswordChange 상태 업데이트
      await refreshUser();

      // 성공 시 대시보드로 이동
      navigate('/dashboard', { replace: true });

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

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper
        elevation={8}
        sx={{
          p: 4,
          width: '100%',
          borderRadius: 2,
        }}
      >
        {/* 헤더 */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <JHWLogo sx={{ width: 48, height: 48, mx: 'auto', mb: 2 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
            새 비밀번호 설정
          </Typography>
          <Typography variant="body2" color="text.secondary">
            보안을 위해 새 비밀번호를 설정해주세요.
          </Typography>
          {user && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
              {user.name} ({user.mobile})
            </Typography>
          )}
        </Box>

        {/* 비밀번호 변경 폼 */}
        <Box component="form" onSubmit={handleSubmit}>
          {/* 현재 비밀번호 - 기존 사용자만 표시 */}
          {!isNewUser && (
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
          )}

          {/* 새 비밀번호 */}
          <TextField
            fullWidth
            type={showNewPassword ? 'text' : 'password'}
            label="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            helperText="6자 이상 입력해주세요"
            sx={{ mb: 3 }}
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
            {loading ? '변경 중...' : '비밀번호 설정'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChangePasswordPage;