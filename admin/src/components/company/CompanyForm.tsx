/**
 * 파일 경로: /src/components/company/CompanyForm.tsx
 * 작성 날짜: 2025-09-25
 * 업데이트: 2025-09-29 (번호 정규화 규칙 적용)
 * 주요 내용: 회사 정보 입력 폼 컴포넌트 (고객사/공급사 공통)
 * 관련 데이터: BaseCompany 인터페이스
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  TextField,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import type { SMSRecipient, CustomerSMSRecipients } from '../../types/company';
import {
  formatBusinessNumber,
  formatMobile,
  formatPhone
} from '../../utils/numberUtils';

interface CompanyFormProps {
  // 기본 회사 정보
  businessNumber: string;
  businessName: string;
  president: string;
  businessAddress: string;
  businessType?: string;
  businessItem?: string;

  // 연락처 정보 (새로운 개별 필드명)
  presidentMobile?: string;
  businessPhone?: string;
  businessEmail?: string;

  // SMS 수신자 (새로운 구조)
  smsRecipient: CustomerSMSRecipients;

  // 고객사 전용 필드 (선택적)
  customerType?: string;
  discountRate?: number;
  customerTypes?: string[];
  customerTypesLoading?: boolean;

  // 에러 상태
  errors: Record<string, string>;

  // 읽기 전용 모드
  readOnly?: boolean;

  // SMS 수신자 섹션 렌더링 여부
  renderSmsRecipient?: boolean;

  // 고객사 필드 렌더링 여부
  renderCustomerFields?: boolean;

  // 변경 핸들러
  onChange: (field: string, value: string | number | boolean | undefined) => void;
  onSMSRecipientUpdate: (person: 'person1' | 'person2', field: keyof SMSRecipient, value: string) => void;
}

const CompanyForm: React.FC<CompanyFormProps> = ({
  businessNumber,
  businessName,
  president,
  businessAddress,
  businessType = '',
  businessItem = '',
  presidentMobile = '',
  businessPhone = '',
  businessEmail = '',
  smsRecipient,
  customerType = '',
  discountRate = 0,
  customerTypes = [],
  customerTypesLoading = false,
  errors,
  readOnly = false,
  renderSmsRecipient = true,
  renderCustomerFields = false,
  onChange,
  onSMSRecipientUpdate,
}) => {
  // Daum 우편번호 서비스 로드 상태
  const [daumPostcodeLoaded, setDaumPostcodeLoaded] = useState(false);

  // 사업자번호 읽기전용 여부 (최초 값 기준으로 고정)
  const [isBusinessNumberReadOnly] = useState(() => {
    return !!(businessNumber && businessNumber.trim());
  });


  // Daum 우편번호 서비스 스크립트 로드
  useEffect(() => {
    const loadDaumPostcode = () => {
      if (!(window as any).daum) {
        const script = document.createElement('script');
        script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
        script.async = true;
        script.onload = () => setDaumPostcodeLoaded(true);
        script.onerror = () => {
          // Daum Postcode 스크립트 로드 실패 처리
        };
        document.head.appendChild(script);
      } else {
        setDaumPostcodeLoaded(true);
      }
    };

    loadDaumPostcode();
  }, []);

  // 주소 검색
  const handleAddressSearch = () => {
    if (!daumPostcodeLoaded) {
      alert('주소 검색 서비스를 로딩 중입니다. 잠시만 기다려주세요.');
      return;
    }

    new ((window as any).daum as any).Postcode({
      oncomplete: function (data: { address: string; addressType: string; bname: string; buildingName: string; }) {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
          if (data.bname !== '') {
            extraAddress += data.bname;
          }
          if (data.buildingName !== '') {
            extraAddress += (extraAddress !== '' ? ', ' + data.buildingName : data.buildingName);
          }
          if (extraAddress !== '') {
            fullAddress += ' (' + extraAddress + ')';
          }
        }

        onChange('businessAddress', fullAddress);
      }
    }).open();
  };

  return (
    <>
      {/* 기본 정보 */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            기본 정보
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {/* Row 1: 사업자등록번호*(50%), 대표자명*(50%) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Tooltip
              title={isBusinessNumberReadOnly || readOnly ? "사업자등록번호는 수정할 수 없습니다" : "사업자등록번호를 입력하세요"}
              placement="top"
              arrow
            >
              <TextField
                fullWidth
                label="사업자등록번호"
                value={businessNumber}
                onChange={(e) => {
                  // 입력 중에는 포맷팅된 형태로 표시
                  const formatted = formatBusinessNumber(e.target.value);
                  onChange('businessNumber', formatted);
                }}
                error={!!errors.businessNumber}
                helperText={errors.businessNumber}
                placeholder="예: 123-45-67890"
                InputProps={{
                  readOnly: isBusinessNumberReadOnly || readOnly,
                  sx: isBusinessNumberReadOnly || readOnly ? { bgcolor: 'grey.100' } : undefined
                }}
                required
              />
            </Tooltip>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="대표자명"
              value={president}
              onChange={(e) => onChange('president', e.target.value)}
              error={!!errors.president}
              helperText={errors.president}
              InputProps={{ readOnly }}
              required
            />
          </Grid>

          {/* Row 2: 상호명*, 대표자휴대폰 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="상호명"
              value={businessName}
              onChange={(e) => onChange('businessName', e.target.value)}
              error={!!errors.businessName}
              helperText={errors.businessName}
              InputProps={{ readOnly }}
              required
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="대표자 휴대폰"
              value={presidentMobile}
              onChange={(e) => {
                // 입력 중에는 포맷팅된 형태로 표시
                const formatted = formatMobile(e.target.value);
                onChange('presidentMobile', formatted);
              }}
              placeholder="010-1234-5678"
              InputProps={{ readOnly }}
            />
          </Grid>

          {/* Row 3: 사업장주소* + 검색버튼 */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="사업장 주소"
                value={businessAddress}
                onChange={(e) => onChange('businessAddress', e.target.value)}
                error={!!errors.businessAddress}
                helperText={errors.businessAddress}
                InputProps={{ readOnly }}
                placeholder="주소를 입력하거나 검색하세요"
                required
              />
              {!readOnly && (
                <Button
                  variant="outlined"
                  startIcon={<SearchIcon />}
                  sx={{ minWidth: 100, flexShrink: 0 }}
                  onClick={handleAddressSearch}
                >
                  검색
                </Button>
              )}
            </Box>
          </Grid>

          {/* Row 4: 업태, 종목 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="업태"
              value={businessType}
              onChange={(e) => onChange('businessType', e.target.value)}
              InputProps={{ readOnly }}
              placeholder="예: 도매업"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="종목"
              value={businessItem}
              onChange={(e) => onChange('businessItem', e.target.value)}
              InputProps={{ readOnly }}
              placeholder="예: 식품 도매"
            />
          </Grid>

          {/* Row 5: 회사전화번호, 회사이메일 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="회사 전화번호"
              value={businessPhone}
              onChange={(e) => {
                // 입력 중에는 포맷팅된 형태로 표시
                const formatted = formatPhone(e.target.value);
                onChange('businessPhone', formatted);
              }}
              placeholder="02-1234-5678"
              InputProps={{ readOnly }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="회사 이메일"
              type="email"
              value={businessEmail}
              onChange={(e) => onChange('businessEmail', e.target.value)}
              placeholder="company@example.com"
              InputProps={{ readOnly }}
            />
          </Grid>

          {/* Row 6: 고객사 유형, 기본 할인율 (고객사 전용, 조건부 렌더링) */}
          {renderCustomerFields && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.customerType} required>
                  <InputLabel>고객사 유형</InputLabel>
                  <Select
                    value={customerType}
                    label="고객사 유형"
                    onChange={(e) => onChange('customerType', e.target.value)}
                    disabled={customerTypesLoading || readOnly}
                  >
                    {customerTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.customerType}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="기본 할인율"
                  type="number"
                  value={discountRate}
                  onChange={(e) => onChange('discountRate', e.target.value)}
                  InputProps={{
                    endAdornment: '%',
                    readOnly
                  }}
                  inputProps={{
                    min: 0,
                    max: 100
                  }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* SMS 수신자 (조건부 렌더링) */}
      {renderSmsRecipient && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <MessageIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
              SMS 수신자
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="이름1"
                value={smsRecipient.person1?.name || ''}
                onChange={(e) => onSMSRecipientUpdate('person1', 'name', e.target.value)}
                error={!!errors.smsRecipient_person1_name}
                helperText={errors.smsRecipient_person1_name}
                InputProps={{ readOnly }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="휴대폰1"
                value={smsRecipient.person1?.mobile || ''}
                onChange={(e) => {
                  // 입력 중에는 포맷팅된 형태로 표시
                  const formatted = formatMobile(e.target.value);
                  onSMSRecipientUpdate('person1', 'mobile', formatted);
                }}
                error={!!errors.smsRecipient_person1_mobile}
                helperText={errors.smsRecipient_person1_mobile}
                placeholder="010-1234-5678"
                InputProps={{ readOnly }}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="이름2"
                value={smsRecipient.person2?.name || ''}
                onChange={(e) => onSMSRecipientUpdate('person2', 'name', e.target.value)}
                error={!!errors.smsRecipient_person2_name}
                helperText={errors.smsRecipient_person2_name}
                InputProps={{ readOnly }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="휴대폰2"
                value={smsRecipient.person2?.mobile || ''}
                onChange={(e) => {
                  // 입력 중에는 포맷팅된 형태로 표시
                  const formatted = formatMobile(e.target.value);
                  onSMSRecipientUpdate('person2', 'mobile', formatted);
                }}
                error={!!errors.smsRecipient_person2_mobile}
                helperText={errors.smsRecipient_person2_mobile}
                placeholder="010-1234-5678"
                InputProps={{ readOnly }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
    </>
  );
};

export default CompanyForm;