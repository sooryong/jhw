/**
 * 파일 경로: /src/components/sms/MessagePanel.tsx
 * 주요 내용: SMS 메시지 작성 패널 - 메시지 입력 및 발송
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import {
  Send as SendIcon,
  Clear as ClearIcon,
  ArticleOutlined as TemplateIcon,
  BusinessCenter as BusinessIcon,
  LocalShipping as ShippingIcon,
  CreditCard as PaymentIcon,
  Pages as PagesIcon
} from '@mui/icons-material';

interface Recipient {
  phone: string;
  name?: string;
  id: string;
}

interface MessageInfo {
  bytes: number;
  type: 'SMS' | 'LMS' | 'MMS';
  pages: number;
  pageContent: string[];
  cost: number;
}

interface BalanceCheck {
  sufficient: boolean;
  warning?: boolean;
  message?: string;
}

interface SendingProgress {
  isMultiPageSending: boolean;
  currentPage: number;
  totalPages: number;
  message: string;
}

interface MessagePanelProps {
  message: string;
  onMessageChange: (message: string) => void;
  recipients: Recipient[];
  onSend: (message: string, recipients: Recipient[]) => Promise<{ success: boolean; message?: string }>;
  getMessageInfo: (text: string) => MessageInfo;
  checkBalance: (messageInfo: MessageInfo, recipientCount: number) => BalanceCheck;
  loading: boolean;
  customSendButton?: React.ReactNode;
  sendingProgress?: SendingProgress;
}

const MessagePanel: React.FC<MessagePanelProps> = ({
  message,
  onMessageChange,
  recipients,
  onSend,
  getMessageInfo,
  checkBalance,
  loading,
  customSendButton,
  sendingProgress
}) => {
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  // 메시지 정보 계산
  const messageInfo = getMessageInfo(message);
  const balanceCheck = checkBalance(messageInfo, recipients.length);

  // 메시지 템플릿
  const messageTemplates = [
    {
      id: 'business',
      icon: <BusinessIcon />,
      title: '비즈니스 안내',
      content: '[JHW] 안녕하세요. 비즈니스 관련 안내드립니다.'
    },
    {
      id: 'shipping',
      icon: <ShippingIcon />,
      title: '배송 알림',
      content: '[JHW] 고객님의 상품이 출하되었습니다. 운송장번호: '
    },
    {
      id: 'payment',
      icon: <PaymentIcon />,
      title: '결제 확인',
      content: '[JHW] 결제가 완료되었습니다. 결제금액: '
    }
  ];

  // 발송 처리
  const handleSend = async () => {
    if (!message.trim() || recipients.length === 0 || !balanceCheck.sufficient || loading) {
      return;
    }
    await onSend(message, recipients);
  };

  // 템플릿 적용
  const handleTemplateSelect = (template: typeof messageTemplates[0]) => {
    onMessageChange(template.content);
    setTemplateMenuAnchor(null);
  };

  // 메시지 클리어
  const handleClearMessage = () => {
    onMessageChange('');
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SendIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            메시지 작성
          </Typography>

          {/* 템플릿 버튼 */}
          <IconButton
            size="small"
            onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
            sx={{ mr: 1 }}
          >
            <TemplateIcon />
          </IconButton>

          {/* 클리어 버튼 */}
          {message && (
            <IconButton size="small" onClick={handleClearMessage}>
              <ClearIcon />
            </IconButton>
          )}
        </Box>

        {/* 메시지 입력 - 고정 높이와 스크롤 */}
        <TextField
          fullWidth
          multiline
          label="메시지 내용"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="메시지를 입력하세요..."
          sx={{
            height: '370px',
            mb: 2,
            '& .MuiOutlinedInput-root': {
              height: '100%',
              alignItems: 'flex-start'
            },
            '& .MuiInputBase-input': {
              height: '100% !important',
              overflowY: 'scroll !important',
              resize: 'none',
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.5)'
                }
              }
            }
          }}
        />

        {/* 메시지 타입 정보 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {messageInfo.bytes}바이트
          </Typography>
          <Typography variant="caption" color={messageInfo.type === 'SMS' ? 'primary.main' : 'warning.main'} sx={{ fontWeight: 600 }}>
            {messageInfo.type === 'SMS' ? 'SMS' : `LMS ${messageInfo.pages}페이지`}
          </Typography>
        </Box>

        {/* LMS 페이지 분할 표시 */}
        {messageInfo.type === 'LMS' && messageInfo.pages > 1 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <PagesIcon sx={{ mr: 1, color: 'warning.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'warning.main' }}>
                LMS 다중 페이지 ({messageInfo.pages}페이지)
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 2, py: 1 }}>
              <Typography variant="caption">
                <strong>순차적 다중 페이지 발송:</strong> 각 페이지를 모든 수신자에게 순차적으로 발송합니다.
                발송 완료 후 메시지와 수신자 목록이 자동으로 초기화됩니다.
              </Typography>
            </Alert>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {messageInfo.pageContent.map((_pageText, index) => (
                <Chip
                  key={index}
                  label={`LMS ${index + 1}p`}
                  variant="outlined"
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {/* 다중 페이지 발송 진행 상태 */}
        {sendingProgress?.isMultiPageSending && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CircularProgress size={20} sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                다중 페이지 발송 진행 중
              </Typography>
            </Box>
            <Typography variant="body2" color="primary.main">
              {sendingProgress.message}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Typography variant="caption" sx={{ mr: 1 }}>
                진행률:
              </Typography>
              <Box sx={{
                width: '100%',
                height: 8,
                bgcolor: 'primary.100',
                borderRadius: 1,
                position: 'relative'
              }}>
                <Box sx={{
                  width: `${(sendingProgress.currentPage / sendingProgress.totalPages) * 100}%`,
                  height: '100%',
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  transition: 'width 0.3s ease'
                }} />
              </Box>
              <Typography variant="caption" sx={{ ml: 1, minWidth: 40 }}>
                {Math.round((sendingProgress.currentPage / sendingProgress.totalPages) * 100)}%
              </Typography>
            </Box>
          </Paper>
        )}

        {/* 발송 버튼 */}
        {customSendButton || (
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSend}
            disabled={
              loading ||
              !message.trim() ||
              recipients.length === 0 ||
              !balanceCheck.sufficient
            }
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            sx={{
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 600,
              mt: 'auto',
              ...(messageInfo.type === 'LMS' && messageInfo.pages > 1 && {
                bgcolor: 'warning.main',
                '&:hover': { bgcolor: 'warning.dark' }
              })
            }}
          >
            {loading ? '발송 중...' :
              messageInfo.type === 'LMS' && messageInfo.pages > 1
                ? `${recipients.length}명에게 다중 페이지 발송 (${messageInfo.pages}페이지)`
                : `${recipients.length}명에게 발송`
            }
          </Button>
        )}
      </CardContent>

      {/* 템플릿 메뉴 */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        {messageTemplates.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => handleTemplateSelect(template)}
          >
            <ListItemIcon>{template.icon}</ListItemIcon>
            <ListItemText
              primary={template.title}
              secondary={template.content.substring(0, 30) + '...'}
            />
          </MenuItem>
        ))}
      </Menu>
    </Card>
  );
};

export default MessagePanel;