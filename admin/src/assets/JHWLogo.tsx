/**
 * 파일 경로: /src/assets/JHWLogo.tsx
 * 작성 날짜: 2025-09-22
 * 주요 내용: JHW 플랫폼 로고 컴포넌트
 * 관련 데이터: SVG 로고, 브랜드 아이덴티티
 */

import React from 'react';
import { SvgIcon } from '@mui/material';
import { JHW_BRAND_COLORS } from '../styles/theme';

interface JHWLogoProps {
  variant?: 'icon' | 'full';
  sx?: React.ComponentProps<typeof SvgIcon>['sx'];
  fontSize?: 'inherit' | 'large' | 'medium' | 'small';
}

const JHWLogo: React.FC<JHWLogoProps> = ({ variant = 'icon', ...props }) => {
  if (variant === 'full') {
    // 전체 로고 (J + HW)
    return (
      <SvgIcon {...props} viewBox="0 0 120 40">
        {/* 배경 원형 */}
        <circle
          cx="20"
          cy="20"
          r="18"
          fill={JHW_BRAND_COLORS.green}
          stroke={JHW_BRAND_COLORS.greenDark}
          strokeWidth="1"
        />
        {/* J 글자 */}
        <text
          x="20"
          y="28"
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill="white"
          fontFamily="Arial, sans-serif"
        >
          J
        </text>
        {/* HW 텍스트 */}
        <text
          x="50"
          y="18"
          fontSize="16"
          fontWeight="600"
          fill={JHW_BRAND_COLORS.green}
          fontFamily="Arial, sans-serif"
        >
          HW
        </text>
        <text
          x="50"
          y="32"
          fontSize="10"
          fontWeight="400"
          fill={JHW_BRAND_COLORS.greenDark}
          fontFamily="Arial, sans-serif"
        >
          Platform
        </text>
      </SvgIcon>
    );
  }

  // 아이콘만 (JH)
  return (
    <SvgIcon {...props} viewBox="0 0 32 32">
      {/* 배경 사각형 (둥근 모서리) */}
      <rect
        width="32"
        height="32"
        rx="4"
        fill={JHW_BRAND_COLORS.green}
      />
      {/* JH 글자 */}
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        JH
      </text>
    </SvgIcon>
  );
};

export default JHWLogo;