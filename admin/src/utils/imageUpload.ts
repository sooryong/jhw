/**
 * 파일 경로: /src/utils/imageUpload.ts
 * 주요 내용: 이미지 업로드 유틸리티 함수들
 * 관련 데이터: Firebase Storage
 */

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface ImageUploadResult {
  url: string;
  path: string;
  fileName: string;
}

/**
 * 이미지 파일 업로드
 * @param file - 업로드할 파일
 * @param path - 저장할 경로 (예: 'products/product-id/images')
 * @param onProgress - 업로드 진행률 콜백
 * @returns Promise<ImageUploadResult>
 */
export const uploadImage = async (
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<ImageUploadResult> => {
  return new Promise((resolve, reject) => {
    // 파일 유효성 검사
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 업로드할 수 있습니다.'));
      return;
    }

    // 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      reject(new Error('파일 크기는 5MB 이하여야 합니다.'));
      return;
    }

    // 고유한 파일명 생성
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;
    const fullPath = `${path}/${fileName}`;

    // Storage 레퍼런스 생성
    const storageRef = ref(storage, fullPath);

    // 파일 업로드 시작
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // 업로드 진행률 계산
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        if (onProgress) {
          onProgress({
            progress: Math.round(progress),
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
          });
        }
      },
      (error) => {
        // 업로드 에러 처리
        reject(error);
      },
      async () => {
        // 업로드 성공 시 다운로드 URL 가져오기
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url: downloadURL,
            path: fullPath,
            fileName: fileName,
          });
        } catch (error) {
      // Error handled silently
          reject(error);
        }
      }
    );
  });
};

/**
 * 이미지 파일 삭제
 * @param imagePath - 삭제할 이미지의 Storage 경로
 * @returns Promise<void>
 */
export const deleteImage = async (imagePath: string): Promise<void> => {
  const storageRef = ref(storage, imagePath);
  await deleteObject(storageRef);
};

/**
 * 이미지 파일 리사이즈 (클라이언트 사이드)
 * @param file - 리사이즈할 파일
 * @param maxWidth - 최대 너비
 * @param maxHeight - 최대 높이
 * @param quality - 압축 품질 (0.1 ~ 1.0)
 * @returns Promise<File>
 */
export const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 비율을 유지하면서 리사이즈 계산
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 이미지 그리기
      ctx?.drawImage(img, 0, 0, width, height);

      // Canvas를 Blob으로 변환
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('이미지 리사이즈에 실패했습니다.'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('이미지 로드에 실패했습니다.'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * 상품 이미지 업로드 (리사이즈 포함)
 * @param file - 업로드할 파일
 * @param productId - 상품 ID
 * @param onProgress - 업로드 진행률 콜백
 * @returns Promise<ImageUploadResult>
 */
export const uploadProductImage = async (
  file: File,
  productId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<ImageUploadResult> => {
  // 이미지 리사이즈 (최대 800x600)
  const resizedFile = await resizeImage(file, 800, 600, 0.8);

  // 상품 이미지 경로
  const imagePath = `products/${productId}/images`;

  // 업로드 실행
  return await uploadImage(resizedFile, imagePath, onProgress);
};

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열 (예: "2.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 이미지 URL이 유효한지 확인
 * @param url - 확인할 이미지 URL
 * @returns Promise<boolean>
 */
export const validateImageUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};