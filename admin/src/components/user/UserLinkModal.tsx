/**
 * 파일 경로: /src/components/user/UserLinkModal.tsx
 * 작성 날짜: 2025-10-15
 * 주요 내용: 고객사 담당자 연결 모달 컴포넌트 (customer role만 표시)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  Typography,
  Box,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { getAllUsers } from '../../services/userService';
import type { User } from '../../types/user';
import { formatMobile } from '../../utils/numberUtils';

interface UserLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (user: User) => void;
  title?: string;
  excludeUserIds?: string[]; // 제외할 사용자 ID 목록 (예: 이미 선택된 담당자)
  filterRole?: 'customer' | 'supplier'; // 필터링할 역할 (기본값: 'customer')
}

const UserLinkModal: React.FC<UserLinkModalProps> = ({
  open,
  onClose,
  onSelect,
  title = '담당자 연결',
  excludeUserIds = [],
  filterRole = 'customer',
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 모달이 열릴 때 사용자 목록 로드
  useEffect(() => {
    if (open) {
      loadUsers();
      setSearchQuery('');
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      setError('사용자 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('사용자 목록 로드 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  // 실시간 검색 필터링 (이름 또는 휴대폰번호) - 지정된 role만 표시, 최신순 정렬
  const filteredUsers = useMemo(() => {
    // 먼저 지정된 role만 필터링
    const roleFilteredUsers = users.filter(user => user.role === filterRole);

    let filtered: User[];

    if (!searchQuery.trim()) {
      filtered = roleFilteredUsers.filter(user => !excludeUserIds.includes(user.uid));
    } else {
      const query = searchQuery.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

      filtered = roleFilteredUsers.filter(user => {
        // 제외 목록에 있는 사용자는 필터링
        if (excludeUserIds.includes(user.uid)) {
          return false;
        }

        // 이름으로 검색
        const nameMatch = user.name.toLowerCase().includes(query);

        // 휴대폰번호로 검색 (하이픈 제거 후)
        const phoneNumber = user.mobile.replace(/[^0-9]/g, '');
        const phoneMatch = phoneNumber.includes(query);

        // 이메일로 검색
        const emailMatch = user.email?.toLowerCase().includes(query);

        return nameMatch || phoneMatch || emailMatch;
      });
    }

    // 최신순 정렬 (createdAt 기준 내림차순 - 최근 등록자가 상단)
    return filtered.sort((a, b) => {
      // createdAt이 Date 객체인 경우
      if (a.createdAt instanceof Date && b.createdAt instanceof Date) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }

      // Firestore Timestamp 객체인 경우
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;

      // 둘 다 0이면 (createdAt이 없으면) uid로 정렬
      if (aTime === 0 && bTime === 0) {
        return b.uid.localeCompare(a.uid);
      }

      // 최신순 정렬: 큰 타임스탬프(최신)가 먼저
      return bTime - aTime;
    });
  }, [users, searchQuery, excludeUserIds, filterRole]);

  // 사용자 클릭 시 바로 추가
  const handleUserClick = (user: User) => {
    onSelect(user);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '700px',
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6">{title}</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}>
        {/* 검색 필드 */}
        <TextField
          fullWidth
          placeholder="이름 또는 휴대폰번호로 검색 (예: 홍길동, 01012345678)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          autoFocus
        />

        {/* 검색 결과 안내 */}
        {!loading && (
          <Typography variant="body2" color="text.secondary">
            {filteredUsers.length}명의 사용자 찾음
          </Typography>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* 에러 상태 */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 사용자 목록 */}
        {!loading && !error && (
          <List
            sx={{
              flex: 1,
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            {filteredUsers.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {searchQuery
                    ? '검색 결과가 없습니다.'
                    : '등록된 사용자가 없습니다.'}
                </Typography>
                {!searchQuery && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                      ⚠️ 사용자를 먼저 등록해주세요
                    </Typography>
                    <Typography variant="body2">
                      • 시스템 설정 &gt; 사용자 관리에서 사용자를 먼저 등록해야 합니다.
                    </Typography>
                    <Typography variant="body2">
                      • 사용자 등록 시 역할(Role)을 {filterRole === 'customer' ? '고객사' : '공급사'}로 설정해주세요.
                    </Typography>
                  </Alert>
                )}
              </Box>
            ) : (
              filteredUsers.map((user) => (
                <ListItem
                  key={user.uid}
                  disablePadding
                  sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-child': {
                      borderBottom: 0,
                    },
                  }}
                >
                  <ListItemButton
                    onClick={() => handleUserClick(user)}
                    sx={{
                      py: 1,
                      px: 2,
                      '&:hover': {
                        bgcolor: 'primary.lighter',
                      },
                    }}
                  >
                    {/* 1줄 레이아웃: 휴대폰번호 | 이름 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      {/* 휴대폰번호 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                        <PhoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body1">
                          {formatMobile(user.mobile)}
                        </Typography>
                      </Box>

                      {/* 이름 */}
                      <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
                        {user.name}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        )}

        {/* 안내 메시지 */}
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
            💡 사용 안내
          </Typography>
          <Typography variant="body2">
            • 사용자가 없다면 시스템 설정 &gt; 사용자 관리에서 먼저 등록해주세요.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserLinkModal;
