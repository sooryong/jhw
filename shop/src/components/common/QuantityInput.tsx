/**
 * 파일 경로: /src/components/common/QuantityInput.tsx
 * 작성 날짜: 2025-10-01
 * 주요 내용: 수량 입력 컴포넌트 (직접 입력 + 증감 버튼)
 * 특징: 엑셀 스타일의 빠른 입력 지원
 */

import React, { useState, useEffect } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 9999,
  size = 'small',
  disabled = false,
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleIncrement = () => {
    const newValue = Math.min(value + 1, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - 1, min);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // 숫자만 허용
    if (/^\d*$/.test(inputValue)) {
      setLocalValue(inputValue);
    }
  };

  const handleBlur = () => {
    let numValue = parseInt(localValue) || 0;
    numValue = Math.max(min, Math.min(numValue, max));
    onChange(numValue);
    setLocalValue(numValue.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      // Enter 키 시 다음 입력 필드로 포커스 이동
      const form = e.currentTarget.form;
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input[type="text"]'));
        const currentIndex = inputs.indexOf(e.currentTarget);
        if (currentIndex < inputs.length - 1) {
          (inputs[currentIndex + 1] as HTMLInputElement).focus();
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  };

  const buttonSize = size === 'small' ? 'small' : 'medium';
  const inputWidth = size === 'small' ? 60 : 80;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
      }}
    >
      <IconButton
        size={buttonSize}
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        sx={{
          minWidth: { xs: 36, sm: 40 },
          minHeight: { xs: 36, sm: 40 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>

      <TextField
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        size={size}
        inputProps={{
          min,
          max,
          style: {
            textAlign: 'center',
            fontWeight: value > 0 ? 600 : 400,
            fontSize: size === 'small' ? '0.95rem' : '1rem',
          },
        }}
        sx={{
          width: inputWidth,
          '& input': {
            py: size === 'small' ? 1 : 1.5,
            color: value > 0 ? 'primary.main' : 'text.secondary',
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: value > 0 ? 'primary.main' : 'divider',
              borderWidth: value > 0 ? 2 : 1,
            },
            '&:hover fieldset': {
              borderColor: value > 0 ? 'primary.dark' : 'text.secondary',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'primary.main',
            },
          },
        }}
      />

      <IconButton
        size={buttonSize}
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        sx={{
          minWidth: { xs: 36, sm: 40 },
          minHeight: { xs: 36, sm: 40 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default QuantityInput;
