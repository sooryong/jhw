/**
 * 파일 경로: /src/components/sms/SMSSendDialog.tsx
 * 주요 내용: SMS 발송 다이얼로그 컴포넌트 (기존 구조 기반)
 * 관련 데이터: useSms Hook 연동
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Send as SendIcon, Clear as ClearIcon } from '@mui/icons-material';
import type { SMSRecipient } from '../../types/sms';
import { useSms } from '../../hooks/useSMS';

interface SMSSendDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (messageId: string) => void;
  initialRecipients?: SMSRecipient[];
  initialMessage?: string;
  title?: string;
}

const SMSSendDialog: React.FC<SMSSendDialogProps> = ({
  open,
  onClose,
  onSuccess,
  initialRecipients = [],
  initialMessage = '',
  title = 'SMS 발송',
}) => {
  const { sendMessage, getMessageInfo, checkBalance, loading } = useSms();

  const [recipients, setRecipients] = useState<string[]>(
    initialRecipients.map(r => r.phoneNumber)
  );
  const [message, setMessage] = useState(initialMessage);
  const [phoneInput, setPhoneInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRecipients(initialRecipients.map(r => r.phoneNumber));
  }, [initialRecipients]);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  // 메시지 정보 계산
  const messageInfo = getMessageInfo(message);
  const balanceCheck = checkBalance(messageInfo, recipients.length);

  const addRecipient = () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;

    // 기본 전화번호 형식 검증
    const phoneRegex = /^01[0-9]{8,9}$/;
    const cleanPhone = trimmed.replace(/-/g, '');

    if (!phoneRegex.test(cleanPhone)) {
      setError('올바른 전화번호를 입력해주세요.');
      return;
    }

    if (recipients.includes(cleanPhone)) {
      setError('이미 추가된 전화번호입니다.');
      return;
    }

    setRecipients(prev => [...prev, cleanPhone]);
    setPhoneInput('');
    setError('');
  };

  const removeRecipient = (phoneNumber: string) => {
    setRecipients(prev => prev.filter(r => r !== phoneNumber));
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError('메시지를 입력해주세요.');
      return;
    }

    if (recipients.length === 0) {
      setError('받는 사람을 추가해주세요.');
      return;
    }

    if (!balanceCheck.sufficient) {
      setError(balanceCheck.message || '잔액이 부족합니다.');
      return;
    }

    try {
      const recipientData = recipients.map(phone => ({ phone, name: '고객' }));
      const result = await sendMessage(message.trim(), recipientData, { messageType: 'manual' });

      if (result.success) {
        onSuccess?.('success');
        handleClose();
      } else {
        setError(result.message || 'SMS 발송에 실패했습니다.');
      }
    } catch (error) {
      // Error handled silently
      setError('SMS 발송 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setRecipients([]);
    setMessage('');
    setPhoneInput('');
    setError('');
    onClose();
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      addRecipient();
    }
  };

  // 전화번호 포맷팅 헬퍼 함수
  const formatPhoneNumber = (phone: string): string => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    } else if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {/* 받는 사람 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              받는 사람 ({recipients.length}명)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="전화번호"
                value={phoneInput}
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
                  setPhoneInput(formatted);
                }}
                onKeyPress={handleKeyPress}
                placeholder="01012345678"
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <Button variant="outlined" onClick={addRecipient}>
                추가
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {recipients.map((recipient) => (
                <Chip
                  key={recipient}
                  label={formatPhoneNumber(recipient)}
                  onDelete={() => removeRecipient(recipient)}
                  deleteIcon={<ClearIcon />}
                  size="small"
                />
              ))}
            </Box>
          </Box>

          {/* 메시지 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              메시지 내용
            </Typography>
            <TextField
              multiline
              rows={6}
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              helperText={
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {messageInfo.bytes}바이트 ({messageInfo.type})
                  </span>
                  <span>
                    {messageInfo.cost * recipients.length}포인트
                  </span>
                </Box>
              }
            />
          </Box>

          {/* 잔액 체크 알림 */}
          {!balanceCheck.sufficient && (
            <Alert severity="error">
              {balanceCheck.message}
            </Alert>
          )}

          {balanceCheck.warning && (
            <Alert severity="warning">
              {balanceCheck.message}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          취소
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          disabled={
            loading ||
            !message.trim() ||
            recipients.length === 0 ||
            !balanceCheck.sufficient
          }
        >
          {loading ? '발송 중...' : '발송'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SMSSendDialog;