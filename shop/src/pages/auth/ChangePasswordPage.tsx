/**
 * 파일 경로: /src/pages/auth/ChangePasswordPage.tsx
 * 작성 날짜: 2025-10-15
 * 주요 내용: 비밀번호 변경 페이지 (첫 로그인 시 강제 변경)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  CircularProgress,
  Container,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import JHWLogo from '../../assets/JHWLogo';

const ChangePasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return '비밀번호는 최소 8자 이상이어야 합니다.';
    }
    if (!/[A-Za-z]/.test(password)) {
      return '비밀번호에는 최소 1개의 영문자가 포함되어야 합니다.';
    }
    if (!/[0-9]/.test(password)) {
      return '비밀번호에는 최소 1개의 숫자가 포함되어야 합니다.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 새 비밀번호 유효성 검증
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 현재 비밀번호와 같은지 확인
    if (currentPassword === newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;
      if (!currentUser || !user) {
        throw new Error('로그인 상태를 확인할 수 없습니다.');
      }

      // 현재 비밀번호로 재인증 (보안 강화)
      const normalizedPhone = user.mobile.replace(/[^0-9]/g, '');
      const email = `${normalizedPhone}@jhw.local`;
      const credential = EmailAuthProvider.credential(email, currentPassword);

      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (authError:unknown) {
        if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
          throw new Error('현재 비밀번호가 올바르지 않습니다.');
        }
        throw authError;
      }

      // Firebase Auth 비밀번호 변경
      await updatePassword(currentUser, newPassword);

      // Firestore에 requiresPasswordChange를 false로 업데이트
      await updateDoc(doc(db, 'users', user.mobile), {
        requiresPasswordChange: false,
        passwordChangedAt: serverTimestamp(),
      });

      // 사용자 정보 새로고침
      await refreshUser();

      // 성공 후 고객사 선택 페이지로 이동
      navigate('/shop/select-customer', { replace: true });
    } catch (err:unknown) {
      if (err.code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인해주세요.');
      } else {
        setError(err instanceof Error ? err.message : '비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: { xs: 4, sm: 8 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: { xs: '100vh', sm: 'auto' },
          justifyContent: { xs: 'center', sm: 'flex-start' },
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <JHWLogo sx={{ width: { xs: 48, sm: 52 }, height: { xs: 48, sm: 52 }, mb: 1 }} />

          <Typography
            component="h1"
            variant="h5"
            gutterBottom
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              mb: 1,
              fontSize: { xs: '1.25rem', sm: '1.5rem' }
            }}
          >
            비밀번호 변경
          </Typography>

          <Alert severity="warning" sx={{ width: '100%', mb: 2 }}>
            보안을 위해 비밀번호를 변경해주세요.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              fullWidth
              name="currentPassword"
              label="현재 비밀번호"
              type={showCurrentPassword ? 'text' : 'password'}
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      edge="end"
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              margin="normal"
              fullWidth
              name="newPassword"
              label="새 비밀번호"
              type={showNewPassword ? 'text' : 'password'}
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              helperText="영문, 숫자 포함 8자 이상"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      edge="end"
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              margin="normal"
              fullWidth
              name="confirmPassword"
              label="새 비밀번호 확인"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
              sx={{
                mt: 3,
                mb: 2,
                minHeight: { xs: 48, sm: 52 },
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              진현유통 쇼핑몰 v0.9.0
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ChangePasswordPage;
