/**
 * 파일 경로: /src/pages/auth/LoginPage.tsx
 * 작성 날짜: 2025-10-12
 * 주요 내용: JHW 쇼핑몰 로그인 페이지
 * 관련 데이터: Firebase Auth, 휴대폰번호 로그인, 표준 UI/UX
 */

import React, { useState, useEffect } from 'react';
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
  Phone,
  Lock,
  Login as LoginIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import JHWLogo from '../../assets/JHWLogo';

const LoginPage: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  // 이미 로그인된 사용자는 고객사 선택 페이지로 리다이렉트
  useEffect(() => {
    if (user && !loading) {
      navigate('/shop/select-customer', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || !password) {
      setError('휴대폰번호와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setError('');
      await login(phoneNumber, password);
      navigate('/shop/select-customer', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length > 11) return phoneNumber;

    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
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
              mb: { xs: 2, sm: 3 },
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' }
            }}
          >
            JHW 쇼핑몰 로그인
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              fullWidth
              id="phoneNumber"
              label="ID(휴대폰번호)"
              placeholder="01012345678"
              value={phoneNumber}
              onChange={handlePhoneChange}
              disabled={loading}
              autoComplete="tel"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              margin="normal"
              fullWidth
              name="password"
              label="비밀번호"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
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
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
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
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
              sx={{
                mt: 3,
                mb: 2,
                minHeight: { xs: 48, sm: 52 },
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              진현유통 쇼핑몰 v2.1.0
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
