/**
 * 파일 경로: /src/pages/sms/SMSCenterPage.tsx
 * 주요 내용: SMS 센터 메인 페이지 - 새로운 3패널 레이아웃 (TypeScript 버전)
 * 관련 데이터: smsHistory, CoolSMS 잔액
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Chip,
  Collapse,
  Container
} from '@mui/material';
import {
  Message as MessageIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useSms } from '../../hooks/useSMS';
import RecipientPanel from '../../components/sms/RecipientPanel';
import MessagePanel from '../../components/sms/MessagePanel';
import BalanceGuidePanel from '../../components/sms/BalanceGuidePanel';

// 수신자 인터페이스 정의
interface Recipient {
  phone: string;
  name?: string;
  id: string;
}

const SMSCenterPage = () => {
  const {
    balance,
    stats,
    loading,
    balanceLoading,
    historyLoading,
    sendMessage,
    refreshBalance,
    refreshHistory,
    getMessageInfo,
    getFilteredHistory,
    checkBalance
  } = useSms();

  // 새로운 상태 관리
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(true);



  // LMS 다중 페이지 발송 진행 상태
  const [sendingProgress, setSendingProgress] = useState<{
    isMultiPageSending: boolean;
    currentPage: number;
    totalPages: number;
    message: string;
  }>({
    isMultiPageSending: false,
    currentPage: 0,
    totalPages: 0,
    message: ''
  });

  // 페이지네이션 상태
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 탭 기능 제거됨

  // 페이지 간 발송 딜레이 유틸리티
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 메시지 발송 처리
  const handleSendMessage = async (messageText: string, recipientList: Recipient[]) => {
    const messageInfo = getMessageInfo(messageText);

    // LMS 다중 페이지의 경우 모든 수신자에게 순차적으로 발송
    if (messageInfo.type === 'LMS' && messageInfo.pages > 1) {
      const recipientsFormatted = recipientList.map(r => ({
        phone: r.phone,
        name: r.name || '고객'
      }));

      try {
        let totalSuccess = 0;
        let totalFailed = 0;
        const results = [];

        // 발송 시작 - 진행 상태 초기화
        setSendingProgress({
          isMultiPageSending: true,
          currentPage: 0,
          totalPages: messageInfo.pages,
          message: '다중 페이지 발송을 시작합니다...'
        });

        // 각 페이지를 모든 수신자에게 순차적으로 발송
        for (let pageIndex = 0; pageIndex < messageInfo.pages; pageIndex++) {
          const pageText = messageInfo.pageContent[pageIndex];
          const currentPage = pageIndex + 1;
          const totalPages = messageInfo.pages;

          // 진행 상태 업데이트
          setSendingProgress({
            isMultiPageSending: true,
            currentPage,
            totalPages,
            message: `페이지 ${currentPage}/${totalPages} 발송 중... (${recipientList.length}명)`
          });


          const pageResult = await sendMessage(pageText, recipientsFormatted, {
            messageType: 'lms_multipage_sequential',
            currentPage,
            totalPages,
            originalMessage: messageText
          });

          if (pageResult.success) {
            totalSuccess++;
          } else {
            totalFailed++;
          }

          results.push(pageResult);

          // 마지막 페이지가 아닌 경우 발송 간격 적용
          if (pageIndex < messageInfo.pages - 1) {
            await delay(500);
          }
        }

        // 전체 발송 결과 종합
        const overallResult = {
          success: totalSuccess > 0,
          message: totalFailed === 0
            ? `모든 페이지(${messageInfo.pages}페이지) 발송 완료`
            : `${totalSuccess}/${messageInfo.pages} 페이지 발송 완료 (${totalFailed}페이지 실패)`,
          totalPages: messageInfo.pages,
          successPages: totalSuccess,
          failedPages: totalFailed,
          results
        };

        // 발송 완료 - 진행 상태 종료
        setSendingProgress({
          isMultiPageSending: false,
          currentPage: 0,
          totalPages: 0,
          message: ''
        });

        // 모든 페이지 발송 완료 후 초기화
        if (overallResult.success) {
          setMessage('');
          setRecipients([]);
        }

        return overallResult;

      } catch (error) {
      // Error handled silently

        // 에러 발생 시 진행 상태 정리
        setSendingProgress({
          isMultiPageSending: false,
          currentPage: 0,
          totalPages: 0,
          message: ''
        });

        return {
          success: false,
          message: error instanceof Error ? error.message : 'LMS 다중 페이지 발송 중 오류가 발생했습니다'
        };
      }
    } else {
      // 일반 SMS/단일 LMS 발송
      const recipientsFormatted = recipientList.map(r => ({
        phone: r.phone,
        name: r.name || '고객'
      }));

      const result = await sendMessage(messageText, recipientsFormatted, {
        messageType: 'normal_send'
      });

      if (result.success) {
        setMessage('');
      }

      return result;
    }
  };

  // 전체 이력
  const filteredHistory = getFilteredHistory('all');



  // 페이지네이션 핸들러
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };



  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <Container maxWidth={false} sx={{ width: '80%', px: 0, margin: '0 auto' }}>
        <Box sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#f8f9fa',
          overflow: 'auto'
        }}>
        {/* 헤더 */}
        <Box sx={{ p: 2, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <MessageIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main'
                  }
                }}
                onClick={() => {
                  refreshBalance();
                  refreshHistory();
                }}
              >
                SMS 센터
              </Typography>
            </Box>
          </Box>

        </Box>
      </Box>

      {/* 메인 컨텐츠 */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* 좌측: 수신자 관리 (50%) */}
          <Grid size={{ xs: 12, md: 12, lg: 6 }}>
            <RecipientPanel
              recipients={recipients}
              onRecipientsChange={setRecipients}
            />
          </Grid>

          {/* 우측: 메시지 작성 및 발송 (50%) */}
          <Grid size={{ xs: 12, md: 12, lg: 6 }}>
            <MessagePanel
              message={message}
              onMessageChange={setMessage}
              recipients={recipients}
              onSend={handleSendMessage}
              getMessageInfo={getMessageInfo}
              checkBalance={checkBalance}
              loading={loading}
              sendingProgress={sendingProgress}
            />
          </Grid>
        </Grid>

        {/* SMS 정보 패널 */}
        <Box sx={{ mb: 2 }}>
          <BalanceGuidePanel
            balance={balance}
            stats={stats}
            balanceLoading={balanceLoading}
            onRefreshBalance={refreshBalance}
          />
        </Box>


      </Box>

      {/* 발송 이력 (접을 수 있는 섹션) */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Card sx={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              p: 1,
              borderRadius: 1,
              mx: -1,
              mb: historyExpanded ? 2 : 0
            }}
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <HistoryIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              발송 이력 ({filteredHistory.length}건)
            </Typography>

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                refreshHistory();
              }}
              disabled={historyLoading}
              sx={{ mr: 1 }}
              title="새로고침"
            >
              {historyLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            </IconButton>


            {historyExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>

          <Collapse in={historyExpanded}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '400px', overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '20%' }}>수신자</TableCell>
                      <TableCell sx={{ flex: 1 }}>메시지</TableCell>
                      <TableCell align="center" sx={{ width: '12%' }}>타입</TableCell>
                      <TableCell align="center" sx={{ width: '12%' }}>상태</TableCell>
                      <TableCell sx={{ width: '15%' }}>발송일시</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            발송 이력이 없습니다
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item: { recipientName?: string; to: string; text?: string; type: string; status: string; createdAt?: number; } | unknown, index: number) => {
                          const historyItem = item as { recipientName?: string; to: string; text?: string; type: string; status: string; createdAt?: number; };
                          return (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {historyItem.recipientName || '고객'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {historyItem.to}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {historyItem.text?.substring(0, 60)}
                                {(historyItem.text?.length || 0) > 60 && '...'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={(() => {
                                  if (historyItem.type === 'SMS') return 'SMS';
                                  if (historyItem.type === 'LMS') {
                                    // LMS 다중 페이지인 경우 페이지 수 표시
                                    const messageLength = historyItem.text?.length || 0;
                                    const pages = Math.ceil(messageLength / 2000);
                                    return pages > 1 ? `LMS ${pages}P` : 'LMS';
                                  }
                                  if (historyItem.type === 'MMS') {
                                    return 'LMS 2P'; // MMS를 LMS 2P로 표시
                                  }
                                  return historyItem.type || 'SMS';
                                })()}
                                size="small"
                                color={historyItem.type === 'SMS' ? 'default' : 'primary'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {historyItem.status === 'sent' ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <ErrorIcon color="error" />
                              )}
                            </TableCell>
                            <TableCell>
                              {historyItem.createdAt ? (
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
                                    {new Date(historyItem.createdAt).toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }} color="text.secondary">
                                    {new Date(historyItem.createdAt).toLocaleTimeString('ko-KR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: false
                                    })}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption">-</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                        })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* 페이지네이션 */}
              {filteredHistory.length > 0 && (
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={filteredHistory.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="페이지당 행:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
                />
              )}
            </Box>
          </Collapse>
        </CardContent>
        </Card>

      </Box>
      </Box>
      </Container>
    </Box>
  );
};

export default SMSCenterPage;