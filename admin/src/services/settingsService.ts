/**
 * 파일 경로: /src/services/settingsService.ts
 * 작성 날짜: 2025-09-25
 * 주요 내용: Firebase settings 컬렉션 관리 서비스
 * 관련 데이터: Firebase settings 컬렉션
 */

import {
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
// Define UserRole locally to avoid import issues
type UserRole = 'admin' | 'staff' | 'customer' | 'supplier';

export interface SettingsData {
  customerTypes: Record<string, string>; // {"0": "도매 고객", "1": "중도매 고객", ...}
  userRoles: Record<string, string>; // {"0": "관리자", "1": "직원", "2": "고객사", "3": "공급사"}
  productCategories: Record<string, string>; // {"0": "밀암 식품", "1": "냉동 식품", "2": "공산품"}
}

export class SettingsService {
  private collectionName = 'settings';

  // 메모리 캐시
  private settingsCache: SettingsData | null = null;
  private cacheTime: number = 0;
  private cacheTTL = 60 * 60 * 1000; // 1시간

  // Settings 컬렉션에서 전체 설정 데이터 가져오기 (캐싱 적용)
  async getSettings(): Promise<SettingsData | null> {
    try {
      // 캐시 확인 (1시간 이내면 캐시 사용)
      const age = Date.now() - this.cacheTime;
      if (this.settingsCache && age < this.cacheTTL) {
        return this.settingsCache;
      }

      // 캐시 없거나 만료됨 - Firestore 조회 (직접 문서 참조)
      const docRef = doc(db, this.collectionName, 'current');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const docData = docSnap.data() as SettingsData;

        // 캐시 저장
        this.settingsCache = docData;
        this.cacheTime = Date.now();

        return docData;
      }

      return null;
    } catch (error) {
      // Error handled silently
      console.error('Error fetching settings:', error);
      throw new Error('설정 정보를 불러올 수 없습니다.');
    }
  }

  // 캐시 무효화 (설정 변경 시 호출)
  clearCache(): void {
    this.settingsCache = null;
    this.cacheTime = 0;
  }

  // 사용자 역할 목록 가져오기 (드롭다운용)
  async getUserRoles(): Promise<{ code: string; name: string }[]> {
    // 기본 역할 정의 (항상 사용 - Firestore 데이터가 없거나 불완전할 때 사용)
    const defaultRoles = [
      { code: '0', name: '관리자' },
      { code: '1', name: '직원' },
      { code: '2', name: '고객사' },
      { code: '3', name: '공급사' }
    ];

    try {
      const settings = await this.getSettings();

      if (settings?.userRoles) {
        // Firestore에서 배열 형태로 저장되어 있는 경우 (잘못된 형태)
        if (Array.isArray(settings.userRoles)) {
          return defaultRoles;
        }

        // Record<string, string>을 배열로 변환
        // 인덱스 순서대로 정렬 (0, 1, 2, 3...)
        const sortedEntries = Object.entries(settings.userRoles)
          .sort(([a], [b]) => parseInt(a) - parseInt(b));

        const loadedRoles = sortedEntries.map(([code, name]) => ({ code, name }));

        // Firestore에서 로드한 역할이 4개 미만이면 기본값 사용 (공급사 누락 방지)
        if (loadedRoles.length < 4) {
          return defaultRoles;
        }

        // 각 역할의 name이 한글인지 확인 (영어면 잘못된 형태)
        const hasInvalidNames = loadedRoles.some(role =>
          ['admin', 'staff', 'customer', 'supplier'].includes(role.name)
        );

        if (hasInvalidNames) {
          return defaultRoles;
        }

        return loadedRoles;
      }

      return defaultRoles;
    } catch (error) {
      // Error handled silently
      console.error('Error loading user roles:', error);
      return defaultRoles;
    }
  }

  // 사용자 역할 코드를 실제 역할로 변환
  codeToUserRole(code: string): UserRole {
    // 기본 매핑: "0": admin, "1": staff, "2": customer, "3": supplier
    const mapping: Record<string, UserRole> = {
      '0': 'admin',
      '1': 'staff',
      '2': 'customer',
      '3': 'supplier'
    };
    return mapping[code] || 'staff';
  }

  // 실제 역할을 코드로 변환
  userRoleToCode(role: UserRole): string {
    const mapping: Record<UserRole, string> = {
      'admin': '0',
      'staff': '1',
      'customer': '2',
      'supplier': '3'
    };
    return mapping[role] || '1';
  }

  // 고객사 유형 목록 가져오기 (드롭다운용)
  async getCustomerTypes(): Promise<string[]> {
    try {
      const settings = await this.getSettings();

      if (settings?.customerTypes) {
        // Record<string, string>을 배열로 변환
        // 인덱스 순서대로 정렬 (0, 1, 2, 3...)
        const sortedEntries = Object.entries(settings.customerTypes)
          .sort(([a], [b]) => parseInt(a) - parseInt(b));

        return sortedEntries.map(([, value]) => value);
      }

      // 설정이 없을 경우 기본값 반환
      return ['도매 고객', '중도매 고객', '대형 고객', '소매 고객'];
    } catch (error) {
      // Error handled silently
      // 에러 시에도 기본값 반환
      return ['도매 고객', '중도매 고객', '대형 고객', '소매 고객'];
    }
  }

  // 상품 카테고리 목록 가져오기
  async getProductCategories(): Promise<string[]> {
    try {
      const settings = await this.getSettings();

      if (settings?.productCategories) {
        // Record<string, string>을 배열로 변환
        // 인덱스 순서대로 정렬 (0, 1, 2...)
        const sortedEntries = Object.entries(settings.productCategories)
          .sort(([a], [b]) => parseInt(a) - parseInt(b));

        return sortedEntries.map(([, value]) => value);
      }

      return [];
    } catch (error) {
      // Error handled silently
      console.error('Error loading product categories:', error);
      return [];
    }
  }
}

// 싱글톤 인스턴스
export const settingsService = new SettingsService();

// 편의 함수 export (기존 코드 호환성)
export const getSetting = settingsService.getSettings.bind(settingsService);

export default settingsService;