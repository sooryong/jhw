/**
 * 파일 경로: /src/components/common/SubPageHeader.tsx
 * 작성 날짜: 2025-10-18
 * 주요 내용: 서브 페이지 공통 헤더 컴포넌트
 * - 좌측: 돌아가기 버튼
 * - 중앙: 페이지 제목 (아이콘 없음)
 * - 우측: 새로고침 버튼
 * - 표준 여백: pb: 3
 */

import { Box, Button, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface SubPageHeaderProps {
  /** 페이지 제목 */
  title: string;
  /** 돌아가기 버튼 클릭 핸들러 */
  onBack: () => void;
  /** 새로고침 버튼 클릭 핸들러 */
  onRefresh: () => void;
  /** 새로고침 버튼 로딩 상태 (선택사항) */
  loading?: boolean;
  /** 추가 액션 버튼 (새로고침 버튼 앞에 표시) */
  actionButtons?: React.ReactNode;
}

const SubPageHeader = ({ title, onBack, onRefresh, loading = false, actionButtons }: SubPageHeaderProps) => {
  return (
    <Box sx={{ p: 2, pb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              돌아가기
            </Box>
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actionButtons}
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              새로고침
            </Box>
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SubPageHeader;
