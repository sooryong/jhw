/**
 * 파일 경로: /src/components/sms/RecipientPanel.tsx
 * 주요 내용: SMS 수신자 관리 패널 - 저장된 수신자 관리 및 체크박스 선택
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  IconButton,
  Alert,
  Checkbox,
  Button,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import {
  getRecipients,
  addRecipient,
  deleteRecipient,
  type SMSRecipient
} from '../../services/recipientService';

interface Recipient {
  phone: string;
  name?: string;
  id: string;
}


interface RecipientPanelProps {
  recipients: Recipient[];
  onRecipientsChange: (recipients: Recipient[]) => void;
}


const RecipientPanel: React.FC<RecipientPanelProps> = ({
  recipients,
  onRecipientsChange
}) => {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [cloudRecipients, setCloudRecipients] = useState<SMSRecipient[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadRecipients();
  }, []);

  // 전화번호 유효성 검사
  const validatePhone = (phone: string) => {
    const phoneRegex = /^01[0-9]{8,9}$/;
    const cleanPhone = phone.replace(/-/g, '');
    return phoneRegex.test(cleanPhone);
  };

  // 휴대폰번호 실시간 포맷팅
  const handlePhoneChange = (value: string) => {
    // 숫자만 남기기
    const numbersOnly = value.replace(/[^0-9]/g, '');

    // 길이 제한 (11자리)
    const limitedNumbers = numbersOnly.slice(0, 11);

    // 포맷팅 적용
    let formatted = limitedNumbers;
    if (limitedNumbers.length >= 4) {
      if (limitedNumbers.length >= 8) {
        formatted = `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
      } else {
        formatted = `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
      }
    }

    setNewPhone(formatted);
  };



  // 데이터 로드 함수
  const loadRecipients = async () => {
    try {
      const data = await getRecipients();
      setCloudRecipients(data);
    } catch {
      // 에러 무시
    }
  };

  // 수신자 바로 추가 (컬렉션에 저장)
  const handleAddRecipient = async () => {
    // 이름과 휴대폰번호 모두 필수 입력 체크
    if (!newPhone.trim() || !newName.trim()) {
      return;
    }

    const cleanPhone = newPhone.replace(/-/g, '');
    if (!validatePhone(cleanPhone)) {
      return;
    }

    try {
      await addRecipient({
        phone: cleanPhone,
        name: newName.trim()
      });
      setNewPhone('');
      setNewName('');
      // 목록 새로고침
      await loadRecipients();
    } catch {
      // 에러 무시
    }
  };

  // 수신자 삭제 함수
  const handleRemoveRecipient = async (recipientId: string) => {
    if (!recipientId) return;

    setDeletingId(recipientId);
    try {
      await deleteRecipient(recipientId);
      // 목록 새로고침
      await loadRecipients();
    } catch {
      alert('수신자 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };





  // 전화번호 포맷팅
  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return phone;
  };


  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <GroupIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            수신자 선택
          </Typography>
        </Box>

        {/* 상단 입력 섹션: 이름 | 휴대폰번호 | + 버튼 */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.6fr 60px',
          gap: 1,
          mb: 2,
          pt: 1
        }}>
          <TextField
            size="small"
            label="이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="홍길동"
            onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '0.8rem'
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.8rem'
              }
            }}
          />
          <TextField
            size="small"
            label="휴대폰번호"
            value={newPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="010-1234-5678"
            onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '0.8rem'
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.8rem'
              }
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleAddRecipient}
            disabled={!newPhone.trim() || !newName.trim() || !validatePhone(newPhone.replace(/-/g, ''))}
            sx={{ fontSize: '0.75rem', px: 1 }}
          >
            추가
          </Button>
        </Box>

        {/* 연락처 리스트 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {cloudRecipients.length === 0 ? (
            <Alert severity="info">
              이름과 휴대폰번호를 모두 입력 후 추가 버튼을 눌러 연락처를 저장하세요
            </Alert>
          ) : (
            <Box>
              <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
                저장된 연락처
              </Typography>

              {/* 테이블 헤더 */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr 40px 40px',
                gap: 1,
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
                borderRadius: '4px 4px 0 0'
              }}>
                <Typography variant="caption" fontWeight="bold">이름</Typography>
                <Typography variant="caption" fontWeight="bold">휴대폰번호</Typography>
                <Typography variant="caption" fontWeight="bold" textAlign="center">삭제</Typography>
                <Typography variant="caption" fontWeight="bold" textAlign="center">선택</Typography>
              </Box>

              {/* 연락처 리스트 */}
              <Box sx={{ border: 1, borderColor: 'divider', borderTop: 0 }}>
                {cloudRecipients.map((contact, index) => (
                  <Box
                    key={contact.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.6fr 40px 40px',
                      gap: 1,
                      p: 1,
                      borderBottom: index === cloudRecipients.length - 1 ? 0 : 1,
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: recipients.some(r => r.phone === contact.phone) ? 'primary.50' : 'transparent',
                      alignItems: 'center'
                    }}
                  >
                    <Typography variant="body2" fontWeight="500">
                      {contact.name}
                    </Typography>
                    <Typography variant="body2">
                      {formatPhone(contact.phone)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => contact.id && handleRemoveRecipient(contact.id)}
                        disabled={deletingId === contact.id}
                        sx={{
                          color: deletingId === contact.id ? 'grey.400' : 'error.main',
                          opacity: deletingId === contact.id ? 0.6 : 1
                        }}
                      >
                        {deletingId === contact.id ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Checkbox
                        checked={recipients.some(r => r.phone === contact.phone)}
                        onChange={() => {
                          if (recipients.some(r => r.phone === contact.phone)) {
                            // 선택 해제 - 수신자 리스트에서 제거
                            onRecipientsChange(recipients.filter(r => r.phone !== contact.phone));
                          } else {
                            // 선택 - 수신자 리스트에 추가
                            const newRecipient: Recipient = {
                              id: Date.now().toString(),
                              phone: contact.phone,
                              name: contact.name
                            };
                            onRecipientsChange([...recipients, newRecipient]);
                          }
                        }}
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>

      </CardContent>
    </Card>
  );
};

export default RecipientPanel;