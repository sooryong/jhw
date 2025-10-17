/**
 * 파일 경로: /src/components/product/ProductForm.tsx
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 등록/수정 폼 컴포넌트
 * 관련 데이터: products 컬렉션, settings 컬렉션
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  LinearProgress,
  Alert,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Inventory as ProductIcon,
  Category as CategoryIcon,
  AttachMoney as PriceIcon,
  Business as SupplierIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ManageSearch as AdvancedSearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import type { SalePrices } from '../../types/product';
import { priceUtils } from '../../types/product';
import { settingsService } from '../../services/settingsService';
import { supplierService } from '../../services/supplierService';
import type { Supplier } from '../../types/company';
import { uploadProductImage, formatFileSize, type UploadProgress } from '../../utils/imageUpload';

// 숫자 포맷팅 유틸리티 함수들
const formatNumberWithCommas = (value: number | string): string => {
  if (!value && value !== 0) return '';
  return Number(value).toLocaleString('ko-KR');
};

const parseNumberFromString = (value: string): number => {
  return Number(value.replace(/,/g, ''));
};

interface ProductFormProps {
  // 폼 데이터
  productCode?: string;
  productName: string;
  specification?: string;
  mainCategory?: string;
  subCategory?: string;
  purchasePrice?: number; // 선택 필드
  salePrices: SalePrices;
  stockQuantity?: number; // 선택 필드
  minimumStock?: number; // 선택 필드
  supplierId?: string;
  image?: string;
  images?: string[];
  primaryImageIndex?: number;
  description?: string;
  isActive: boolean;

  // 이벤트 핸들러
  onChange: (field: string, value: string | number | boolean | SalePrices | string[] | undefined) => void;

  // 에러
  errors: Record<string, string>;

  // 읽기 전용 모드
  readOnly?: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({
  productCode = '',
  productName,
  specification = '',
  mainCategory = '',
  purchasePrice,
  salePrices,
  stockQuantity,
  minimumStock,
  supplierId = '',
  images = [],
  primaryImageIndex = 0,
  description = '',
  onChange,
  errors,
  readOnly = false
}) => {
  // 상태
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // 이미지 업로드 상태
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 모달 및 검색 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearchText, setModalSearchText] = useState('');

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 고객사 유형 로드
        const types = await settingsService.getCustomerTypes();
        setCustomerTypes(types);

        // 상품 카테고리 로드 (settings에서 관리)
        const categories = await settingsService.getProductCategories();
        setProductCategories(categories);

        // 활성 공급사 목록 로드
        const supplierList = await supplierService.getSuppliers({ isActive: true });
        setSuppliers(supplierList);

      } catch (error) {
      // Error handled silently
        // 데이터 로드 실패 처리
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // mainCategory 값 검증 (데이터 로딩 완료 후)
  useEffect(() => {
    if (!loading && mainCategory && productCategories.length > 0) {
      const isValidCategory = productCategories.includes(mainCategory);
      if (!isValidCategory && productCategories.length > 0) {
        // 잘못된 값은 빈 문자열로 초기화
        onChange('mainCategory', '');
      }
    }
  }, [loading, mainCategory, productCategories, onChange]);

  // 메인 카테고리 변경 시 서브 카테고리 초기화
  const handleMainCategoryChange = (category: string) => {
    onChange('mainCategory', category);
    onChange('subCategory', ''); // 서브 카테고리 초기화
  };

  // 판매가격 변경 핸들러
  const handleSalePriceChange = (type: 'standard' | string, value: number) => {
    const updatedSalePrices = { ...salePrices };

    if (type === 'standard') {
      updatedSalePrices.standard = value;
    } else {
      updatedSalePrices.customerTypes = {
        ...updatedSalePrices.customerTypes,
        [type]: value
      };
    }

    onChange('salePrices', updatedSalePrices);
  };

  // 선택된 공급사 객체 찾기
  const selectedSupplier = suppliers.find(s => s.businessNumber === supplierId) || null;

  // 모달 검색 필터링 (useMemo로 최적화)
  const filteredModalSuppliers = useMemo(() => {
    if (!modalSearchText.trim()) {
      return suppliers;
    }

    const searchText = modalSearchText.toLowerCase().trim();
    return suppliers.filter(supplier =>
      supplier.businessName.toLowerCase().includes(searchText) ||
      supplier.businessNumber.includes(searchText) ||
      supplier.president.toLowerCase().includes(searchText)
    );
  }, [modalSearchText, suppliers]);

  // 모달 열기
  const handleOpenModal = () => {
    setModalOpen(true);
    setModalSearchText('');
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalSearchText('');
  };

  // 모달에서 공급사 선택
  const handleModalSupplierSelect = (businessNumber: string) => {
    onChange('supplierId', businessNumber);
    handleCloseModal();
  };

  // DataGrid 컬럼 정의
  const supplierColumns: GridColDef[] = [
    {
      field: 'businessName',
      headerName: '공급사명',
      flex: 2,
      minWidth: 200
    },
    {
      field: 'businessNumber',
      headerName: '사업자등록번호',
      flex: 1.5,
      minWidth: 150
    },
    {
      field: 'president',
      headerName: '대표자',
      flex: 1,
      minWidth: 100
    },
    {
      field: 'businessType',
      headerName: '업태',
      flex: 1,
      minWidth: 100
    },
    {
      field: 'businessItem',
      headerName: '종목',
      flex: 1,
      minWidth: 100
    }
  ];


  if (loading) {
    return <Typography>데이터를 불러오는 중...</Typography>;
  }

  // 표시용 상품 코드 (등록 후에는 실제 저장된 값, 등록 전에는 다음 번호 미리보기 또는 로딩중)
  const displayProductCode = productCode || '코드 로딩 중...';

  // 이미지 파일 업로드 핸들러 (Firebase Storage) - 다중 이미지 지원
  const handleImageUpload = async (file: File, imageIndex: number) => {
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setImageUploading(true);
    setUploadingIndex(imageIndex);
    setUploadError(null);
    setUploadProgress(null);

    try {
      // 이미지 업로드용 상품 코드 사용 (인덱스 추가)
      const uploadProductCode = `${displayProductCode}_${imageIndex}`;

      // Firebase Storage에 이미지 업로드
      const result = await uploadProductImage(
        file,
        uploadProductCode,
        (progress: UploadProgress) => {
          setUploadProgress(progress);
        }
      );

      // 업로드 성공 시 URL을 images 배열에 설정
      const newImages = [...images];
      newImages[imageIndex] = result.url;
      onChange('images', newImages);

      // 하위 호환성: 첫 번째 이미지는 image 필드에도 저장
      if (imageIndex === 0) {
        onChange('image', result.url);
      }
    } catch (error) {
      // Error handled silently
      // 이미지 업로드 실패 처리
      setUploadError(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
      setUploadingIndex(null);
      setUploadProgress(null);
    }
  };

  // 파일 선택 핸들러 - 다중 이미지 지원
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, imageIndex: number) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleImageUpload(file, imageIndex);
    }
    // input을 초기화하여 같은 파일 재선택 가능
    event.target.value = '';
  };

  // 이미지 삭제 핸들러
  const handleImageDelete = (imageIndex: number) => {
    const newImages = [...images];
    newImages[imageIndex] = '';
    onChange('images', newImages);

    // 하위 호환성: 첫 번째 이미지 삭제시 image 필드도 초기화
    if (imageIndex === 0) {
      onChange('image', '');
    }

    // 삭제한 이미지가 대표 이미지였다면 첫 번째 이미지로 변경
    if (primaryImageIndex === imageIndex) {
      onChange('primaryImageIndex', 0);
    }
  };

  // 대표 이미지 설정 핸들러
  const handleSetPrimaryImage = (imageIndex: number) => {
    onChange('primaryImageIndex', imageIndex);
  };

  // 드래그 앤 드롭 핸들러 - 다중 이미지 지원
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent, imageIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      await handleImageUpload(imageFile, imageIndex);
    } else {
      setUploadError('이미지 파일을 드롭해주세요.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* 상단 좌우 2열 배치 */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 1
      }}>
        {/* 좌측: 상품 정보 (50%) */}
        <Paper sx={{ flex: 1, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <ProductIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">상품 정보</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 1. 상품 코드 (자동 생성) */}
            <Tooltip
              title="상품 코드는 수정할 수 없습니다"
              placement="top"
              arrow
              disableHoverListener={!productCode}
            >
              <TextField
                fullWidth
                required
                label="상품 코드"
                value={displayProductCode}
                InputProps={{
                  readOnly: true,
                  sx: { bgcolor: 'grey.100', '& input': { color: 'text.secondary' } }
                }}
              />
            </Tooltip>

            {/* 2. 상품명 */}
            <TextField
              fullWidth
              required
              label="상품명"
              value={productName}
              onChange={(e) => onChange('productName', e.target.value)}
              error={!!errors.productName}
              helperText={errors.productName}
              InputProps={{ readOnly }}
            />

            {/* 3. 상품 사양 */}
            <TextField
              fullWidth
              required
              label="상품 사양"
              value={specification}
              onChange={(e) => onChange('specification', e.target.value)}
              error={!!errors.specification}
              helperText={errors.specification}
              InputProps={{ readOnly }}
            />

            {/* 4. 대분류 */}
            <FormControl fullWidth required error={!!errors.mainCategory}>
              <InputLabel>대분류</InputLabel>
              <Select
                value={productCategories.some(cat => cat === mainCategory) ? mainCategory : ''}
                label="대분류"
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                disabled={readOnly}
              >
                <MenuItem value="">선택해주세요</MenuItem>
                {productCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.mainCategory}</FormHelperText>
            </FormControl>

            {/* 6, 7. 최소 재고 | 현재 재고 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="최소 재고"
                type="text"
                value={minimumStock !== undefined && minimumStock !== null ? minimumStock.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'}
                onChange={(e) => {
                  const value = e.target.value.replace(/,/g, '');
                  if (value === '' || value === '0') {
                    onChange('minimumStock', 0);
                  } else if (/^\d+$/.test(value)) {
                    onChange('minimumStock', parseInt(value, 10));
                  }
                }}
                error={!!errors.minimumStock}
                helperText={errors.minimumStock}
                InputProps={{ readOnly }}
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
              />
              <TextField
                label="현재 재고"
                type="text"
                value={stockQuantity !== undefined && stockQuantity !== null ? stockQuantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'}
                onChange={(e) => {
                  const value = e.target.value.replace(/,/g, '');
                  if (value === '' || value === '0') {
                    onChange('stockQuantity', 0);
                  } else if (/^\d+$/.test(value)) {
                    onChange('stockQuantity', parseInt(value, 10));
                  }
                }}
                error={!!errors.stockQuantity}
                helperText={errors.stockQuantity}
                InputProps={{ readOnly }}
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
              />
            </Box>
          </Box>
        </Paper>

        {/* 우측: 가격 정보 (50%) */}
        <Paper sx={{ flex: 1, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <PriceIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">가격 정보 [원]</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 1줄: 표준 판매가격 | 매입가격 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                required
                label="표준 판매가격"
                type="text"
                value={formatNumberWithCommas(salePrices.standard || '')}
                onChange={(e) => {
                  const numericValue = parseNumberFromString(e.target.value);
                  if (!isNaN(numericValue)) {
                    handleSalePriceChange('standard', numericValue);
                  }
                }}
                error={!!errors.standardPrice}
                helperText={errors.standardPrice}
                InputProps={{
                  style: { textAlign: 'right' }
                }}
                inputProps={{
                  style: { textAlign: 'right' },
                  inputMode: 'numeric',
                  pattern: '[0-9,]*'
                }}
              />
              <TextField
                label="매입가격"
                type="text"
                value={purchasePrice !== undefined && purchasePrice !== null ? formatNumberWithCommas(purchasePrice) : '0'}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (value === '' || value === '0') {
                    onChange('purchasePrice', 0);
                  } else {
                    const numericValue = parseNumberFromString(value);
                    if (!isNaN(numericValue)) {
                      onChange('purchasePrice', numericValue);
                    }
                  }
                }}
                error={!!errors.purchasePrice}
                helperText={errors.purchasePrice}
                InputProps={{
                  style: { textAlign: 'right' }
                }}
                inputProps={{
                  style: { textAlign: 'right' },
                  inputMode: 'numeric',
                  pattern: '[0-9,]*'
                }}
              />
            </Box>

            {/* 고객사 유형별 가격 - 2줄: 가격 | 할인율 */}
            {customerTypes.map((customerType) => {
              const price = salePrices.customerTypes[customerType] || 0;
              const discountRate = priceUtils.calculateDiscountRate(salePrices.standard, price);
              const discountText = priceUtils.formatDiscountRate(discountRate);

              return (
                <Box key={customerType} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField
                    required
                    label={`${customerType} 가격`}
                    type="text"
                    value={formatNumberWithCommas(price || '')}
                    onChange={(e) => {
                      const numericValue = parseNumberFromString(e.target.value);
                      if (!isNaN(numericValue)) {
                        handleSalePriceChange(customerType, numericValue);
                      }
                    }}
                    error={!!errors[`customerPrice_${customerType}`]}
                    InputProps={{
                      readOnly,
                      style: { textAlign: 'right' }
                    }}
                    inputProps={{
                      style: { textAlign: 'right' },
                      inputMode: 'numeric',
                      pattern: '[0-9,]*'
                    }}
                  />
                  <TextField
                    label="할인율"
                    type="text"
                    value={discountText ? `${discountText}` : '0%'}
                    InputProps={{
                      readOnly: true,
                      style: { textAlign: 'right' }
                    }}
                    inputProps={{
                      style: { textAlign: 'right' }
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        bgcolor: 'grey.100'
                      },
                      '& .MuiInputBase-input': {
                        color: discountRate > 0 ? 'primary.main' : discountRate < 0 ? 'error.main' : 'text.secondary'
                      }
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Box>

      {/* 공급사 정보 패널 (100% 너비) */}
      <Paper sx={{ width: '100%', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SupplierIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">공급사 정보</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '75% 25%', gap: 2, alignItems: 'start' }}>
          <Autocomplete
            value={selectedSupplier}
            onChange={(event, newValue) => {
              onChange('supplierId', newValue ? newValue.businessNumber : '');
            }}
            options={suppliers}
            getOptionLabel={(option) => option.businessName}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Box>
                    <Typography variant="body1">{option.businessName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.businessNumber} | {option.president}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="공급사"
                required
                error={!!errors.supplierId}
                helperText={errors.supplierId}
                placeholder="공급사명 또는 사업자번호로 검색"
              />
            )}
            isOptionEqualToValue={(option, value) => option.businessNumber === value.businessNumber}
            noOptionsText="검색 결과가 없습니다"
            disabled={readOnly}
            fullWidth
          />

          <Button
            variant="outlined"
            startIcon={<AdvancedSearchIcon />}
            onClick={handleOpenModal}
            disabled={readOnly}
            sx={{ height: '56px' }}
          >
            상세 검색
          </Button>
        </Box>
      </Paper>

      {/* 공급사 상세 검색 모달 */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SupplierIcon color="primary" />
            <Typography variant="h6">공급사 상세 검색</Typography>
          </Box>
          <IconButton onClick={handleCloseModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* 검색 필드 */}
          <TextField
            fullWidth
            placeholder="공급사명, 사업자번호, 대표자로 검색"
            value={modalSearchText}
            onChange={(e) => setModalSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: modalSearchText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setModalSearchText('')}>
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />

          {/* DataGrid */}
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={filteredModalSuppliers}
              columns={supplierColumns}
              getRowId={(row) => row.businessNumber}
              onRowClick={(params) => handleModalSupplierSelect(params.row.businessNumber)}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10 }
                }
              }}
              disableRowSelectionOnClick={false}
              sx={{
                '& .MuiDataGrid-row': {
                  cursor: 'pointer'
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseModal} variant="outlined">
            취소
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상품 이미지 패널 (100% 너비) - 최대 4개 이미지 */}
      <Paper sx={{ width: '100%', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <CategoryIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">상품 이미지 (최대 4개)</Typography>
          <Chip
            label={`${images.filter(img => img).length}/4`}
            size="small"
            color="primary"
            sx={{ ml: 2 }}
          />
        </Box>

        {/* 이미지 그리드 (2x2) */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3
        }}>
          {[0, 1, 2, 3].map((index) => {
            const imageUrl = images[index] || '';
            const isPrimary = primaryImageIndex === index;
            const isUploading = uploadingIndex === index;

            return (
              <Box
                key={index}
                sx={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  border: isDragging && !readOnly ? '2px dashed #1976d2' : imageUrl ? '2px solid #e0e0e0' : '2px dashed #ccc',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isDragging && !readOnly ? 'action.hover' : 'grey.50',
                  cursor: readOnly || imageUploading ? 'default' : 'pointer',
                  pointerEvents: readOnly || isUploading ? 'none' : 'auto',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: readOnly || imageUploading ? undefined : '#1976d2',
                    bgcolor: readOnly || imageUploading ? undefined : 'action.hover'
                  },
                  ...(isPrimary && imageUrl ? {
                    border: '3px solid #1976d2',
                    boxShadow: '0 0 8px rgba(25, 118, 210, 0.3)'
                  } : {})
                }}
                onDragOver={(e) => {
                  if (readOnly || imageUploading) return;
                  handleDragOver(e);
                }}
                onDragLeave={(e) => {
                  if (readOnly || imageUploading) return;
                  handleDragLeave(e);
                }}
                onDrop={(e) => {
                  if (readOnly || imageUploading) return;
                  handleDrop(e, index);
                }}
                onClick={() => !readOnly && !imageUploading && !imageUrl && document.getElementById(`image-file-input-${index}`)?.click()}
              >
                {/* 이미지 번호 표시 */}
                <Chip
                  label={`#${index + 1}`}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 1,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white'
                  }}
                />

                {/* 대표 이미지 표시 */}
                {isPrimary && imageUrl && (
                  <Chip
                    icon={<StarIcon sx={{ color: '#ffd700 !important' }} />}
                    label="대표"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      bgcolor: 'rgba(0,0,0,0.7)',
                      color: '#ffd700',
                      fontWeight: 'bold'
                    }}
                  />
                )}

                {imageUrl ? (
                  <>
                    {/* 이미지 표시 */}
                    <img
                      src={imageUrl}
                      alt={`상품 이미지 ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        borderRadius: 8
                      }}
                    />

                    {/* 액션 버튼들 */}
                    {!readOnly && (
                      <Box sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        display: 'flex',
                        gap: 1,
                        zIndex: 1
                      }}>
                        {/* 대표 이미지 설정 버튼 */}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimaryImage(index);
                          }}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.9)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                          }}
                        >
                          {isPrimary ? <StarIcon sx={{ color: '#ffd700' }} /> : <StarBorderIcon />}
                        </IconButton>

                        {/* 삭제 버튼 */}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageDelete(index);
                          }}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.9)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', color: 'text.secondary', p: 2 }}>
                    <UploadIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2">
                      {isDragging ? '이미지 드롭' : `이미지 ${index + 1}`}
                    </Typography>
                    <Typography variant="caption">
                      클릭 또는 드롭
                    </Typography>
                  </Box>
                )}

                {/* 업로드 중 오버레이 */}
                {isUploading && uploadProgress && (
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}>
                    <Box sx={{ width: '80%', textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
                        업로드 중...
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress.progress}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          mb: 1,
                          bgcolor: 'rgba(255, 255, 255, 0.3)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: '#4caf50'
                          }
                        }}
                      />
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {uploadProgress.progress}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {formatFileSize(uploadProgress.bytesTransferred)} / {formatFileSize(uploadProgress.totalBytes)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* 숨겨진 파일 입력 */}
                <input
                  id={`image-file-input-${index}`}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e, index)}
                />
              </Box>
            );
          })}
        </Box>

        {/* 업로드 에러 */}
        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
            {uploadError}
          </Alert>
        )}

        {/* 안내 메시지 */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            • 권장 크기: 4:3 비율 (예: 800x600px)
            <br />
            • 지원 형식: JPG, PNG, GIF
            <br />
            • 최대 파일 크기: 5MB
            <br />
            • 별 아이콘을 클릭하여 대표 이미지를 설정할 수 있습니다 (기본: 이미지 1)
          </Typography>
        </Alert>
      </Paper>

      {/* 상품 상세 설명 패널 (100% 너비) */}
      <Paper sx={{ width: '100%', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <CategoryIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">상품 상세 설명</Typography>
        </Box>

        <TextField
          fullWidth
          multiline
          label="상품에 대한 상세한 설명을 입력해주세요"
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          InputProps={{
            readOnly,
            sx: { alignItems: 'flex-start' }
          }}
          sx={{
            '& .MuiInputBase-root': {
              minHeight: '200px',
              alignItems: 'flex-start'
            }
          }}
          placeholder="상품의 특징, 사용법, 주의사항 등을 상세히 기술해주세요."
          helperText="고객이 상품을 이해할 수 있도록 자세히 작성해주세요"
        />
      </Paper>
    </Box>
  );
};

export default ProductForm;