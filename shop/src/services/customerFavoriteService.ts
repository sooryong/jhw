/**
 * 파일 경로: /src/services/customerFavoriteService.ts
 * 작성 날짜: 2025-10-22
 * 주요 내용: 고객사 즐겨찾기 상품 서비스
 * 관련 데이터: customers/{customerId}/favoriteProducts 서브컬렉션
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  CustomerFavoriteProduct,
  CustomerFavoriteProductFormData,
  CustomerFavoriteReorderData,
  CustomerFavoriteListOptions
} from '../types/customerFavorite';
import { CustomerFavoriteServiceError, CUSTOMER_FAVORITE_ERROR_CODES } from '../types/customerFavorite';

class CustomerFavoriteService {
  /**
   * 서브컬렉션 참조 가져오기
   */
  private getFavoritesCollection(customerId: string) {
    return collection(db, `customers/${customerId}/favoriteProducts`);
  }

  /**
   * 즐겨찾기 상품 추가
   * @param customerId - 고객사 ID (사업자번호)
   * @param formData - 즐겨찾기 상품 데이터
   * @param userId - 추가한 사용자 UID
   * @returns 생성된 문서 ID (productId)
   */
  async addFavorite(
    customerId: string,
    formData: CustomerFavoriteProductFormData,
    userId?: string
  ): Promise<string> {
    try {
      // 1. 고객사 존재 확인
      const customerDoc = await getDoc(doc(db, 'customers', customerId));
      if (!customerDoc.exists()) {
        throw new CustomerFavoriteServiceError(
          '고객사를 찾을 수 없습니다.',
          CUSTOMER_FAVORITE_ERROR_CODES.CUSTOMER_NOT_FOUND
        );
      }

      // 2. 상품 존재 확인
      const productDoc = await getDoc(doc(db, 'products', formData.productId));
      if (!productDoc.exists()) {
        throw new CustomerFavoriteServiceError(
          '상품을 찾을 수 없습니다.',
          CUSTOMER_FAVORITE_ERROR_CODES.PRODUCT_NOT_FOUND
        );
      }

      // 3. 중복 확인
      const existingDoc = await getDoc(
        doc(this.getFavoritesCollection(customerId), formData.productId)
      );
      if (existingDoc.exists()) {
        throw new CustomerFavoriteServiceError(
          '이미 즐겨찾기에 등록된 상품입니다.',
          CUSTOMER_FAVORITE_ERROR_CODES.ALREADY_EXISTS
        );
      }

      // 4. displayOrder 계산 (미지정 시 마지막 순서로)
      let displayOrder = formData.displayOrder;
      if (displayOrder === undefined) {
        const favoritesQuery = query(
          this.getFavoritesCollection(customerId),
          orderBy('displayOrder', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(favoritesQuery);
        displayOrder = snapshot.empty ? 1 : (snapshot.docs[0].data().displayOrder + 1);
      }

      // 5. 즐겨찾기 데이터 생성
      const now = Timestamp.now();
      const favoriteData: CustomerFavoriteProduct = {
        productId: formData.productId,
        productName: formData.productName,
        productImage: formData.productImage,
        specification: formData.specification,
        displayOrder!,  // 이 시점에서 displayOrder는 항상 값이 있음
        isActive: formData.isActive ?? true,
        addedAt: now,
        updatedAt: now,
        addedBy: userId
      };

      // 6. 문서 ID를 productId로 지정하여 저장
      const docRef = doc(this.getFavoritesCollection(customerId), formData.productId);
      await setDoc(docRef, favoriteData);

      return formData.productId;
    } catch (error) {
      console.error('Error adding favorite:', error);
      if (error instanceof CustomerFavoriteServiceError) {
        throw error;
      }
      throw new CustomerFavoriteServiceError('즐겨찾기 추가 중 오류가 발생했습니다.');
    }
  }

  /**
   * 즐겨찾기 상품 제거
   * @param customerId - 고객사 ID
   * @param productId - 상품 ID
   */
  async removeFavorite(customerId: string, productId: string): Promise<void> {
    try {
      const docRef = doc(this.getFavoritesCollection(customerId), productId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new CustomerFavoriteServiceError(
          '즐겨찾기에 없는 상품입니다.',
          CUSTOMER_FAVORITE_ERROR_CODES.NOT_FOUND
        );
      }

      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error removing favorite:', error);
      if (error instanceof CustomerFavoriteServiceError) {
        throw error;
      }
      throw new CustomerFavoriteServiceError('즐겨찾기 제거 중 오류가 발생했습니다.');
    }
  }

  /**
   * 즐겨찾기 상품 업데이트
   * @param customerId - 고객사 ID
   * @param productId - 상품 ID
   * @param updates - 업데이트할 필드
   */
  async updateFavorite(
    customerId: string,
    productId: string,
    updates: Partial<Omit<CustomerFavoriteProduct, 'productId' | 'addedAt' | 'addedBy'>>
  ): Promise<void> {
    try {
      const docRef = doc(this.getFavoritesCollection(customerId), productId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new CustomerFavoriteServiceError(
          '즐겨찾기에 없는 상품입니다.',
          CUSTOMER_FAVORITE_ERROR_CODES.NOT_FOUND
        );
      }

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      } as Record<string, unknown>);
    } catch (error) {
      console.error('Error updating favorite:', error);
      if (error instanceof CustomerFavoriteServiceError) {
        throw error;
      }
      throw new CustomerFavoriteServiceError('즐겨찾기 업데이트 중 오류가 발생했습니다.');
    }
  }

  /**
   * 즐겨찾기 목록 조회
   * @param customerId - 고객사 ID
   * @param options - 조회 옵션
   * @returns 즐겨찾기 상품 목록
   */
  async listFavorites(
    customerId: string,
    options?: CustomerFavoriteListOptions
  ): Promise<CustomerFavoriteProduct[]> {
    try {
      const {
        activeOnly = false,
        orderBy: orderByField = 'displayOrder',
        limit: limitCount
      } = options || {};

      let q = query(
        this.getFavoritesCollection(customerId),
        orderBy(orderByField, 'asc')
      );

      if (activeOnly) {
        q = query(q, where('isActive', '==', true));
      }

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data() as CustomerFavoriteProduct,
        productId: doc.id
      }));
    } catch (error) {
      console.error('Error listing favorites:', error);
      throw new CustomerFavoriteServiceError('즐겨찾기 목록 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * 활성화된 즐겨찾기만 조회 (Shop용 최적화)
   * @param customerId - 고객사 ID
   * @returns 활성화된 즐겨찾기 상품 목록
   */
  async getActiveFavorites(customerId: string): Promise<CustomerFavoriteProduct[]> {
    return this.listFavorites(customerId, {
      activeOnly: true,
      orderBy: 'displayOrder'
    });
  }

  /**
   * 즐겨찾기 순서 변경
   * @param customerId - 고객사 ID
   * @param reorderData - 순서 변경 데이터 배열
   */
  async reorderFavorites(
    customerId: string,
    reorderData: CustomerFavoriteReorderData[]
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      for (const item of reorderData) {
        const docRef = doc(this.getFavoritesCollection(customerId), item.productId);
        batch.update(docRef, {
          displayOrder: item.newDisplayOrder,
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error reordering favorites:', error);
      throw new CustomerFavoriteServiceError('즐겨찾기 순서 변경 중 오류가 발생했습니다.');
    }
  }

  /**
   * 즐겨찾기 개수 조회
   * @param customerId - 고객사 ID
   * @param activeOnly - 활성화된 것만 카운트
   * @returns 즐겨찾기 개수
   */
  async countFavorites(customerId: string, activeOnly = false): Promise<number> {
    try {
      let q = query(this.getFavoritesCollection(customerId));

      if (activeOnly) {
        q = query(q, where('isActive', '==', true));
      }

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error counting favorites:', error);
      return 0;
    }
  }

  /**
   * 즐겨찾기 상품 토글 (있으면 제거, 없으면 추가)
   * @param customerId - 고객사 ID
   * @param formData - 즐겨찾기 상품 데이터
   * @param userId - 사용자 UID
   * @returns 추가되었으면 true, 제거되었으면 false
   */
  async toggleFavorite(
    customerId: string,
    formData: CustomerFavoriteProductFormData,
    userId?: string
  ): Promise<boolean> {
    try {
      const docRef = doc(this.getFavoritesCollection(customerId), formData.productId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await this.removeFavorite(customerId, formData.productId);
        return false;
      } else {
        await this.addFavorite(customerId, formData, userId);
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw new CustomerFavoriteServiceError('즐겨찾기 토글 중 오류가 발생했습니다.');
    }
  }

  /**
   * 특정 상품이 즐겨찾기에 있는지 확인
   * @param customerId - 고객사 ID
   * @param productId - 상품 ID
   * @returns 즐겨찾기 여부
   */
  async isFavorite(customerId: string, productId: string): Promise<boolean> {
    try {
      const docRef = doc(this.getFavoritesCollection(customerId), productId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() && docSnap.data()?.isActive === true;
    } catch (error) {
      console.error('Error checking favorite:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const customerFavoriteService = new CustomerFavoriteService();
export default customerFavoriteService;
