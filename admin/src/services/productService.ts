/**
 * 파일 경로: /src/services/productService.ts
 * 작성 날짜: 2025-09-26
 * 주요 내용: 상품 관리 서비스 로직
 * 관련 데이터: Firebase products 컬렉션
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryDocumentSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Product,
  ProductFormData,
  ProductFilter,
  ProductLot
} from '../types/product';
import { ProductServiceError } from '../types/product';

class ProductService {
  private collectionName = 'products';

  // 컬렉션 참조 가져오기
  private getCollection() {
    return collection(db, this.collectionName);
  }

  // 문서 참조 가져오기
  private getDocRef(productId: string) {
    return doc(db, this.collectionName, productId);
  }

  // Firestore 문서를 Product 타입으로 변환
  private docToProduct(doc: QueryDocumentSnapshot): Product {
    const data = doc.data();
    return {
      productId: doc.id,
      productCode: data.productCode || '',
      productName: data.productName,
      specification: data.specification,
      mainCategory: data.mainCategory,
      subCategory: data.subCategory,
      purchasePrice: data.purchasePrice,
      salePrices: data.salePrices,
      stockQuantity: data.stockQuantity,
      minimumStock: data.minimumStock,
      supplierId: data.supplierId,
      image: data.image,
      images: data.images,
      primaryImageIndex: data.primaryImageIndex,
      description: data.description,
      isActive: data.isActive,
      lots: data.lots || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  // 상품 목록 조회 (서버 사이드 페이지네이션 지원)
  async getProducts(filter: ProductFilter = {}): Promise<Product[]> {
    try {
      let q = query(this.getCollection());

      // 활성 상태 필터
      if (filter.isActive !== undefined) {
        q = query(q, where('isActive', '==', filter.isActive));
      }

      // 카테고리 필터
      if (filter.mainCategory) {
        q = query(q, where('mainCategory', '==', filter.mainCategory));
      }

      if (filter.subCategory) {
        q = query(q, where('subCategory', '==', filter.subCategory));
      }

      // 공급사 필터
      if (filter.supplierId) {
        q = query(q, where('supplierId', '==', filter.supplierId));
      }

      // 정렬: 최신순
      q = query(q, orderBy('createdAt', 'desc'));

      // 서버 사이드 페이지네이션 (검색어/재고 필터가 없을 때만)
      if (!filter.searchText && !filter.lowStock) {
        if (filter.limit) {
          q = query(q, limit(filter.limit));
        }

        // startAfter를 사용한 커서 기반 페이지네이션도 가능하지만
        // 여기서는 단순 limit만 적용
      }

      const snapshot = await getDocs(q);
      let products = snapshot.docs.map(doc => this.docToProduct(doc));

      // 텍스트 검색 (클라이언트 사이드)
      if (filter.searchText) {
        const searchText = filter.searchText.toLowerCase();
        products = products.filter(product =>
          product.productName.toLowerCase().includes(searchText) ||
          (product.specification && product.specification.toLowerCase().includes(searchText)) ||
          (product.description && product.description.toLowerCase().includes(searchText))
        );
      }

      // 재고 부족 필터
      if (filter.lowStock) {
        products = products.filter(product =>
          (product.stockQuantity ?? 0) <= (product.minimumStock || 0)
        );
      }

      // 클라이언트 사이드 페이지네이션 (검색어/재고 필터가 있을 때)
      if (filter.searchText || filter.lowStock) {
        if (filter.page !== undefined && filter.limit) {
          const startIndex = filter.page * filter.limit;
          products = products.slice(startIndex, startIndex + filter.limit);
        }
      }

      return products;
    } catch {
      throw new ProductServiceError('상품 목록을 불러올 수 없습니다.');
    }
  }

  // 단일 상품 조회
  async getProduct(productId: string): Promise<Product | null> {
    try {
      const docRef = this.getDocRef(productId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          productId: docSnap.id,
          productCode: data.productCode || '',
          productName: data.productName,
          specification: data.specification,
          mainCategory: data.mainCategory,
          subCategory: data.subCategory,
          purchasePrice: data.purchasePrice,
          salePrices: data.salePrices,
          stockQuantity: data.stockQuantity,
          minimumStock: data.minimumStock,
          supplierId: data.supplierId,
          image: data.image,
          images: data.images,
          primaryImageIndex: data.primaryImageIndex,
          description: data.description,
          isActive: data.isActive,
          lots: data.lots || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      }

      return null;
    } catch {
      throw new ProductServiceError('상품 정보를 불러올 수 없습니다.');
    }
  }

  // 상품 개수 조회
  async getProductCount(filter: ProductFilter = {}): Promise<number> {
    try {
      let q = query(collection(db, this.collectionName));

      // 필터 적용
      if (filter.searchText) {
        // 검색어가 있는 경우 모든 데이터를 가져와서 필터링
        const allDocs = await getDocs(q);
        const searchText = filter.searchText.toLowerCase();

        return allDocs.docs.filter(doc => {
          const data = doc.data();
          return (
            data.productName?.toLowerCase().includes(searchText) ||
            data.specification?.toLowerCase().includes(searchText) ||
            data.description?.toLowerCase().includes(searchText) ||
            data.mainCategory?.toLowerCase().includes(searchText) ||
            data.subCategory?.toLowerCase().includes(searchText)
          );
        }).length;
      }

      if (filter.isActive !== undefined) {
        q = query(q, where('isActive', '==', filter.isActive));
      }

      if (filter.mainCategory) {
        q = query(q, where('mainCategory', '==', filter.mainCategory));
      }

      if (filter.supplierId) {
        q = query(q, where('supplierId', '==', filter.supplierId));
      }

      if (filter.lowStock) {
        // 재고 부족 필터는 클라이언트 사이드에서 처리
        const allDocs = await getDocs(q);
        return allDocs.docs.filter(doc => {
          const data = doc.data();
          return data.stockQuantity <= data.minimumStock;
        }).length;
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch {
      // 오류 처리: 상품 개수 조회 실패
      throw new ProductServiceError('상품 개수를 불러올 수 없습니다.');
    }
  }

  // 상품 등록
  async createProduct(productData: ProductFormData): Promise<string> {
    try {
      // 중복 상품명 체크
      const existingProducts = await this.getProducts({
        isActive: true
      });

      const duplicateProduct = existingProducts.find(
        product => product.productName.toLowerCase() === productData.productName.toLowerCase()
      );

      if (duplicateProduct) {
        throw new ProductServiceError('이미 등록된 상품명입니다.');
      }

      // 현재 시간
      const now = Timestamp.now();

      // 상품 코드 생성 (P + 6자리 순차번호)
      const productCode = await this.generateProductCode();

      // 새 상품 데이터 (undefined 필드 제외)
      const newProduct: any = {
        productCode,
        productName: productData.productName,
        specification: productData.specification || '',
        mainCategory: productData.mainCategory || '',
        subCategory: productData.subCategory || '',
        salePrices: productData.salePrices,
        minimumStock: productData.minimumStock || 0,
        supplierId: productData.supplierId || '',
        image: productData.image || '',
        images: productData.images || [],
        primaryImageIndex: productData.primaryImageIndex ?? 0,
        description: productData.description || '',
        isActive: productData.isActive,
        lots: [], // 빈 로트 배열로 초기화
        createdAt: now,
        updatedAt: now
      };

      // 선택 필드는 값이 있을 때만 추가
      if (productData.purchasePrice !== undefined && productData.purchasePrice !== null) {
        newProduct.purchasePrice = productData.purchasePrice;
        newProduct.latestPurchasePrice = productData.purchasePrice; // 초기 매입가격
      }
      if (productData.stockQuantity !== undefined && productData.stockQuantity !== null) {
        newProduct.stockQuantity = productData.stockQuantity;
      }

      // Firestore에 추가
      const docRef = await addDoc(this.getCollection(), newProduct);

      return docRef.id;
    } catch (error) {
      console.error('상품 생성 오류 상세:', error);
      if (error instanceof ProductServiceError) {
        throw error;
      }
      throw new ProductServiceError('상품 등록 중 오류가 발생했습니다.');
    }
  }

  // 상품 수정
  async updateProduct(productId: string, productData: Partial<ProductFormData>): Promise<void> {
    try {
      // 기존 상품 존재 확인
      const existingProduct = await this.getProduct(productId);
      if (!existingProduct) {
        throw new ProductServiceError('수정할 상품을 찾을 수 없습니다.');
      }

      // 상품명 변경 시 중복 체크
      if (productData.productName && productData.productName !== existingProduct.productName) {
        const duplicateProducts = await this.getProducts({
          isActive: true
        });

        const duplicateProduct = duplicateProducts.find(
          product =>
            product.productId !== productId &&
            product.productName.toLowerCase() === (productData.productName ?? '').toLowerCase()
        );

        if (duplicateProduct) {
          throw new ProductServiceError('이미 등록된 상품명입니다.');
        }
      }

      // 업데이트할 데이터 준비
      const updateData: Record<string, unknown> = {
        updatedAt: Timestamp.now()
      };

      // 변경된 필드만 업데이트
      Object.keys(productData).forEach(key => {
        if (productData[key as keyof ProductFormData] !== undefined) {
          updateData[key] = productData[key as keyof ProductFormData];
        }
      });

      // Firestore 업데이트
      await updateDoc(this.getDocRef(productId), updateData as any);
    } catch {
      throw new ProductServiceError('상품 수정 중 오류가 발생했습니다.');
    }
  }

  // 상품 삭제
  async deleteProduct(productId: string): Promise<void> {
    try {
      // 상품 존재 확인
      const product = await this.getProduct(productId);
      if (!product) {
        throw new ProductServiceError('삭제할 상품을 찾을 수 없습니다.');
      }

      // TODO: 주문이나 재고 이력이 있는지 확인 (나중에 구현)

      // Firestore에서 삭제
      await deleteDoc(this.getDocRef(productId));
    } catch {
      throw new ProductServiceError('상품 삭제 중 오류가 발생했습니다.');
    }
  }

  // 재고 업데이트
  async updateStock(productId: string, newQuantity: number): Promise<void> {
    try {
      if (newQuantity < 0) {
        throw new ProductServiceError('재고 수량은 0 이상이어야 합니다.');
      }

      await updateDoc(this.getDocRef(productId), {
        stockQuantity: newQuantity,
        updatedAt: Timestamp.now()
      });
    } catch {
      throw new ProductServiceError('재고 업데이트 중 오류가 발생했습니다.');
    }
  }

  // 재고 부족 상품 조회
  async getLowStockProducts(): Promise<Product[]> {
    try {
      const products = await this.getProducts({ isActive: true });

      return products.filter(product =>
        (product.stockQuantity ?? 0) <= (product.minimumStock || 0)
      );
    } catch {
      throw new ProductServiceError('재고 부족 상품을 조회할 수 없습니다.');
    }
  }

  // 공급사별 상품 조회
  async getProductsBySupplier(supplierId: string): Promise<Product[]> {
    try {
      return await this.getProducts({
        supplierId,
        isActive: true
      });
    } catch {
      throw new ProductServiceError('공급사 상품을 조회할 수 없습니다.');
    }
  }

  // 카테고리별 상품 조회
  async getProductsByCategory(mainCategory: string, subCategory?: string): Promise<Product[]> {
    try {
      const filter: ProductFilter = {
        mainCategory,
        isActive: true
      };

      if (subCategory) {
        filter.subCategory = subCategory;
      }

      return await this.getProducts(filter);
    } catch {
      throw new ProductServiceError('카테고리 상품을 조회할 수 없습니다.');
    }
  }

  // 특정 ID 목록의 상품만 조회 (즐겨찾기용 - 속도 최적화)
  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    try {
      if (!productIds || productIds.length === 0) {
        return [];
      }

      // Firestore 'in' 쿼리는 최대 10개까지만 지원
      // 10개씩 나눠서 조회
      const chunks: string[][] = [];
      for (let i = 0; i < productIds.length; i += 10) {
        chunks.push(productIds.slice(i, i + 10));
      }

      const allProducts: Product[] = [];
      for (const chunk of chunks) {
        const q = query(
          this.getCollection(),
          where('__name__', 'in', chunk)
        );
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(doc => this.docToProduct(doc));
        allProducts.push(...products);
      }

      return allProducts;
    } catch (error) {
      console.error('상품 ID 목록 조회 실패:', error);
      throw new ProductServiceError('상품을 조회할 수 없습니다.');
    }
  }

  // 상품 통계 조회
  async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
  }> {
    try {
      const allProducts = await this.getProducts();
      const activeProducts = allProducts.filter(p => p.isActive);
      const inactiveProducts = allProducts.filter(p => !p.isActive);
      const lowStockProducts = await this.getLowStockProducts();

      return {
        total: allProducts.length,
        active: activeProducts.length,
        inactive: inactiveProducts.length,
        lowStock: lowStockProducts.length
      };
    } catch {
      throw new ProductServiceError('상품 통계를 조회할 수 없습니다.');
    }
  }

  // 다음 상품 코드 미리보기 (저장하지 않고 조회만)
  async getNextProductCode(): Promise<string> {
    try {
      const counterRef = doc(db, 'lastCounters', 'product');
      const counterDoc = await getDoc(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber || 0;
      }

      const nextNumber = currentNumber + 1;
      const formattedNumber = nextNumber.toString().padStart(6, '0');
      return `P${formattedNumber}`;
    } catch {
      throw new ProductServiceError('다음 상품 코드를 조회할 수 없습니다.');
    }
  }

  // 상품 코드 생성 (P + 6자리 순차번호)
  private async generateProductCode(): Promise<string> {
    const counterRef = doc(db, 'lastCounters', 'product');

    const newNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber || 0;
      }

      const nextNumber = currentNumber + 1;

      // Update counter
      transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });

      return nextNumber;
    });

    // Format as P + 6 digits
    const formattedNumber = newNumber.toString().padStart(6, '0');
    return `P${formattedNumber}`;
  }

  // 로트 추가
  async addLot(productId: string, lotData: { lotDate: string; quantity: number; price: number }): Promise<void> {
    try {
      const productRef = this.getDocRef(productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        throw new ProductServiceError('상품을 찾을 수 없습니다.');
      }

      const product = productDoc.data() as Product;
      const lots = product.lots || [];

      // 같은 날짜 로트가 있는지 확인
      const existingLotIndex = lots.findIndex(lot => lot.lotDate === lotData.lotDate);

      if (existingLotIndex >= 0) {
        // 기존 로트 업데이트
        lots[existingLotIndex].quantity += lotData.quantity;
        lots[existingLotIndex].stock += lotData.quantity;
        lots[existingLotIndex].price = lotData.price; // 최신 가격으로 업데이트
      } else {
        // 새 로트 추가
        lots.push({
          lotDate: lotData.lotDate,
          quantity: lotData.quantity,
          stock: lotData.quantity,
          price: lotData.price
        });
      }

      // 최근 매입가격 및 총 재고 계산
      const latestPurchasePrice = this.calculateLatestPurchasePrice(lots);
      const totalStock = this.calculateTotalStock(lots);

      await updateDoc(productRef, {
        lots,
        latestPurchasePrice,
        stockQuantity: totalStock,
        purchasePrice: latestPurchasePrice, // 기존 필드도 동기화
        updatedAt: Timestamp.now()
      });

    } catch {
      throw new ProductServiceError('로트 추가 중 오류가 발생했습니다.');
    }
  }

  // FIFO 원칙으로 재고 차감
  async updateStockFIFO(productId: string, outQuantity: number): Promise<void> {
    try {
      const productRef = this.getDocRef(productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        throw new ProductServiceError('상품을 찾을 수 없습니다.');
      }

      const product = productDoc.data() as Product;
      const lots = product.lots || [];

      // 총 재고 확인
      const totalStock = this.calculateTotalStock(lots);
      if (totalStock < outQuantity) {
        throw new ProductServiceError('재고가 부족합니다.');
      }

      // FIFO 원칙으로 재고 차감
      const sortedLots = lots.sort((a, b) => a.lotDate.localeCompare(b.lotDate));
      let remaining = outQuantity;

      for (const lot of sortedLots) {
        if (remaining <= 0) break;
        const consumed = Math.min(lot.stock, remaining);
        lot.stock -= consumed;
        remaining -= consumed;
      }

      // 재고가 0인 로트는 제거하지 않고 유지 (이력 보존)
      const newTotalStock = this.calculateTotalStock(lots);

      await updateDoc(productRef, {
        lots,
        stockQuantity: newTotalStock,
        updatedAt: Timestamp.now()
      });

    } catch {
      throw new ProductServiceError('재고 차감 중 오류가 발생했습니다.');
    }
  }

  // 최근 매입가격 계산
  private calculateLatestPurchasePrice(lots: ProductLot[]): number {
    const activeLots = lots.filter(lot => lot.stock > 0);
    if (activeLots.length === 0) return 0;

    const latestLot = activeLots.sort((a, b) => b.lotDate.localeCompare(a.lotDate))[0];
    return latestLot.price;
  }

  // 총 재고 계산
  private calculateTotalStock(lots: ProductLot[]): number {
    return lots.reduce((total, lot) => total + lot.stock, 0);
  }

  // 로트 이력 조회
  async getLotHistory(productId: string): Promise<ProductLot[]> {
    try {
      const productRef = this.getDocRef(productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        throw new ProductServiceError('상품을 찾을 수 없습니다.');
      }

      const product = productDoc.data() as Product;
      return (product.lots || []).sort((a, b) => b.lotDate.localeCompare(a.lotDate));

    } catch {
      throw new ProductServiceError('로트 이력을 조회할 수 없습니다.');
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const productService = new ProductService();

// 편의 함수 export (기존 코드 호환성)
export const getProducts = productService.getProducts.bind(productService);
export const getProductsByIds = productService.getProductsByIds.bind(productService);
export const getProductCount = productService.getProductCount.bind(productService);

export default productService;