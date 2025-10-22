# JHW 플랫폼 관리 시스템 명세서

**버전**: v0.9.5
**작성일**: 2025-10-12
**최종 업데이트**: 2025-10-22
**프로젝트명**: JHW Platform Admin System
**Firebase 프로젝트**: jinhyun-wholesale
**배포 URL**: https://jinhyun-admin.web.app

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처](#2-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [사용자 권한 체계](#4-사용자-권한-체계)
5. [데이터 모델](#5-데이터-모델)
6. [Cloud Functions](#6-cloud-functions)
7. [주요 기능](#7-주요-기능)
8. [페이지별 상세 기능](#8-페이지별-상세-기능)
9. [메뉴 구조](#9-메뉴-구조)
10. [배포 및 운영](#10-배포-및-운영)

---

## 1. 시스템 개요

### 1.1 목적
JHW 플랫폼 관리 시스템은 진현유통의 B2B 식품 도매 업무를 디지털화한 통합 관리 시스템입니다. 일일 주문 접수부터 매입, 입고, 출하, 정산까지의 전체 업무 프로세스를 관리합니다.

### 1.2 주요 특징
- **역할 기반 접근 제어**: admin, staff, customer, supplier 역할별 차별화된 기능 제공
- **실시간 주문 관리**: 신선식품(Fresh Food) 집계 프로세스 자동화
- **신선식품 집계 관리**: 집계 기간 기반 regular/additional 자동 구분
- **실시간 재고 비교**: 모든 주문을 실시간으로 집계하고 현재고와 비교
- **SMS 통합**: 발주서 전송, 알림 등 자동 SMS 발송
- **매입/매출 원장 관리**: 거래 내역 자동 전표화 및 정산
- **대리 쇼핑 지원**: 직원이 고객사 대신 주문 가능
- **사용자 기반 담당자 관리**: 고객사/공급사 담당자를 users 컬렉션과 연동

### 1.3 사용자
- **관리자 (admin)**: 시스템 전체 관리, 사용자/고객사/공급사/상품 관리
- **직원 (staff)**: 주문 처리, 입고 관리, 원장 조회
- **고객사 (customer)**: 제한적 조회 권한, 고객사 담당자로 등록 가능
- **공급사 (supplier)**: 공급사 담당자로 등록 가능 (로그인 제한)

---

## 2. 아키텍처

### 2.1 시스템 구성
```
┌─────────────────────────────────────────────────────────────┐
│                    JHW Platform v0.9                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │   Admin System   │              │   Shop System    │    │
│  │  (localhost:5173)│              │ (localhost:5174) │    │
│  │                  │              │                  │    │
│  │  - 관리자/직원용  │              │   - 고객사 전용   │    │
│  │  - 독립 세션     │◄────────────►│   - 독립 세션    │    │
│  │  - 대리 쇼핑 지원│   Window.open │   - 모바일 우선  │    │
│  └──────────────────┘              └──────────────────┘    │
│           │                                  │              │
│           └──────────────┬───────────────────┘              │
│                          ▼                                  │
│              ┌─────────────────────┐                        │
│              │  Firebase Services  │                        │
│              ├─────────────────────┤                        │
│              │ • Authentication    │                        │
│              │ • Firestore         │                        │
│              │ • Cloud Functions   │                        │
│              │ • Hosting           │                        │
│              │ • Storage           │                        │
│              └─────────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Firebase 설정
- **프로젝트 ID**: jinhyun-wholesale
- **Region**: asia-northeast3 (서울)
- **인증**: Firebase Authentication (휴대폰번호 기반)
- **데이터베이스**: Firestore (Native Mode)
- **Functions**: Cloud Functions v2
- **호스팅**: Firebase Hosting (Multi-site)

### 2.3 디렉토리 구조
```
/home/soo/jhw/
├── admin/                    # 관리 시스템
│   ├── src/
│   │   ├── components/       # 공통 컴포넌트
│   │   ├── contexts/         # React Context (전역 상태 관리)
│   │   │   ├── AuthContextProvider.tsx
│   │   │   └── SaleOrderContext.tsx    # 매출주문 전역 상태
│   │   ├── pages/            # 페이지 컴포넌트 (25개)
│   │   ├── services/         # Firebase 서비스 레이어
│   │   ├── types/            # TypeScript 타입 정의
│   │   ├── hooks/            # Custom React Hooks
│   │   ├── utils/            # 유틸리티 함수
│   │   ├── config/           # Firebase 설정
│   │   └── assets/           # 정적 리소스
│   ├── package.json
│   └── vite.config.ts
├── shop/                     # 쇼핑몰 시스템
├── functions/                # Cloud Functions
│   ├── src/
│   │   ├── user/             # 사용자 관리 Functions
│   │   ├── sms/              # SMS Functions
│   │   ├── kakao/            # 카카오톡 Functions
│   │   ├── voice/            # 음성 전화 Functions
│   │   └── rcs/              # RCS Functions
│   └── package.json
├── docs/                     # 문서
├── firebase.json             # Firebase 설정
├── firestore.rules           # Firestore 보안 규칙
├── firestore.indexes.json    # Firestore 인덱스
└── storage.rules             # Storage 보안 규칙
```

### 2.4 전역 상태 관리

JHW 플랫폼은 React Context API를 활용한 전역 상태 관리를 통해 컴포넌트 간 효율적인 데이터 공유를 구현합니다.

#### 2.4.1 SaleOrderContext

**목적**: 매출주문 데이터를 전역으로 관리하여 중복 쿼리를 제거하고 실시간 동기화를 보장합니다.

**파일 경로**: `/admin/src/contexts/SaleOrderContext.tsx`

**제공 데이터**:
```typescript
interface SaleOrderContextValue {
  orders: SaleOrder[];           // 현재 집계 기간의 모든 매출주문
  orderStats: {                  // 주문 통계
    orderCount: number;          // 주문 건수
    productTypes: number;        // 상품 종류
    productCount: number;        // 상품 수량
    totalAmount: number;         // 총 금액
  };
  cutoffInfo: {                  // 일일식품 마감 정보
    status: 'open' | 'closed';
    openedAt: Timestamp | null;
    closedAt: Timestamp | null;
  };
  loading: boolean;              // 로딩 상태
  refreshData: () => Promise<void>;  // 수동 새로고침
}
```

**사용 방법**:
```typescript
import { useSaleOrderContext } from '../../contexts/SaleOrderContext';

const MyComponent = () => {
  const { orders, orderStats, cutoffInfo, loading } = useSaleOrderContext();

  // orders 데이터 활용
  const regularOrders = orders.filter(o => o.dailyFoodOrderType === 'regular');

  return (
    <div>
      <p>주문 건수: {orderStats.orderCount}</p>
      <p>총 금액: {orderStats.totalAmount.toLocaleString()}</p>
    </div>
  );
};
```

**아키텍처 장점**:
1. **단일 Firestore 쿼리**:
   - 모든 페이지가 하나의 실시간 리스너를 공유
   - 불필요한 중복 쿼리 제거로 Firestore 읽기 비용 절감

2. **실시간 동기화**:
   - Firestore `onSnapshot` 리스너로 모든 컴포넌트가 자동 업데이트
   - 데이터 불일치 문제 해결

3. **성능 최적화**:
   - 한 번의 쿼리로 여러 컴포넌트에 데이터 전달
   - 통계 데이터 중복 계산 방지

4. **코드 간소화**:
   - 각 페이지에서 개별 쿼리 작성 불필요
   - 일관된 데이터 접근 패턴

**사용 페이지**:
- SaleOrderManagementPage (`/orders/sale-order-management`)
- SaleOrderListPage (`/orders/sale-orders`)
- DailyFoodOrderPage (`/orders/daily-food-order`)

**실시간 리스너 구조**:
```typescript
// SaleOrderContext 내부 구현
useEffect(() => {
  const q = query(
    collection(db, 'saleOrders'),
    where('status', '==', 'confirmed'),
    where('dailyFoodOrderType', 'in', ['regular', 'additional'])
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const ordersData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setOrders(ordersData);

    // 통계 자동 계산
    const stats = calculateOrderStats(ordersData);
    setOrderStats(stats);
  });

  return () => unsubscribe();
}, []);
```

#### 2.4.2 AuthContextProvider

**목적**: 사용자 인증 상태 및 권한 관리

**파일 경로**: `/admin/src/contexts/AuthContextProvider.tsx`

**제공 기능**:
- Firebase Authentication 통합
- 사용자 역할 기반 접근 제어
- 로그인/로그아웃 관리
- 세션 유지 및 자동 갱신

---

## 3. 기술 스택

### 3.1 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.1.1 | UI 라이브러리 |
| TypeScript | 5.9.3 | 타입 안전성 |
| Material-UI (MUI) | 7.3.4 | UI 컴포넌트 라이브러리 |
| React Router | 7.9.4 | 라우팅 |
| Vite | 7.1.9 | 빌드 도구 |
| date-fns | 4.1.0 | 날짜 처리 |

### 3.2 Admin 전용 라이브러리
| 라이브러리 | 용도 |
|-----------|------|
| MUI X Data Grid | 데이터 테이블 (무료 버전) |
| MUI X Date Pickers | 날짜 선택 컴포넌트 |
| Recharts | 차트 및 대시보드 |
| XLSX | 엑셀 내보내기 |

### 3.3 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Firebase | 12.4.0 | BaaS 플랫폼 |
| Cloud Functions | v2 | 서버리스 백엔드 |
| Firestore | Native | NoSQL 데이터베이스 |
| Firebase Auth | - | 인증 시스템 |
| Firebase Storage | - | 파일 저장소 |

### 3.4 외부 API
- **NCP SENS**: SMS, 카카오톡, 음성전화, RCS 발송

---

## 4. 사용자 권한 체계

### 4.1 역할 정의

#### 4.1.1 관리자 (admin)
- **권한**: 시스템 전체 관리
- **주요 기능**:
  - 일일주문 확정/취소
  - 사용자 관리 (생성/수정/삭제)
  - 고객사/공급사 관리
  - 상품 관리
  - 시스템 설정
  - SMS 센터
  - 모든 원장 조회

#### 4.1.2 직원 (staff)
- **권한**: 업무 처리 및 조회
- **주요 기능**:
  - 일일주문 입고 처리
  - 매입 원장 조회
  - 대리 쇼핑
  - 고객사/공급사 조회
  - 상품 조회

#### 4.1.3 고객사 (customer)
- **권한**: 제한적 조회 및 고객사 담당자 역할
- **주요 기능**:
  - 대시보드 조회
  - 본인 주문 내역 조회
  - 고객사 담당자로 등록 시 SMS 수신

#### 4.1.4 공급사 (supplier)
- **권한**: 공급사 담당자 역할 (로그인 제한)
- **주요 기능**:
  - 공급사 담당자로 등록 시 SMS 수신
  - 향후 공급사 포털 접근 예정
- **로그인 제한**: 현재 Admin 앱 로그인 불가 (향후 확장)

### 4.2 인증 방식
- **로그인 ID**: 휴대폰번호 (하이픈 제거, 11자리 숫자)
- **비밀번호**: 초기 비밀번호 `password123!` (최초 로그인 시 변경 필수)
- **세션 관리**: Firebase Authentication 토큰 기반
- **비밀번호 정책**:
  - 최소 8자 이상
  - 영문 대소문자, 숫자, 특수문자 포함

### 4.3 로그인 규칙

#### 4.3.1 플랫폼 로그인 허용 역할
JHW 플랫폼 관리 시스템은 **관리자(admin)** 및 **직원(staff)** 역할만 로그인할 수 있습니다.

**허용되는 역할 조합**:
- ✅ `admin` (단일 역할)
- ✅ `staff` (단일 역할)
- ✅ `admin` + `customer` (다중 역할)
- ✅ `admin` + `supplier` (다중 역할)
- ✅ `staff` + `customer` (다중 역할)
- ✅ `staff` + `supplier` (다중 역할)
- ✅ `admin` + `staff` + `customer` + `supplier` (모든 역할)

**차단되는 역할 조합**:
- ❌ `customer` (단일 역할) → "이 플랫폼은 관리자 및 직원 전용입니다. 고객 로그인은 쇼핑몰을 이용해주세요."
- ❌ `supplier` (단일 역할) → "공급사 담당자는 현재 로그인이 제한되어 있습니다. 문의사항은 관리자에게 연락해주세요."
- ❌ `customer` + `supplier` (admin/staff 없음) → 차단

**검증 로직** (`admin/src/contexts/AuthContextProvider.tsx:185-202`):
```typescript
// admin 또는 staff 역할이 하나라도 있는지 확인
const hasAdminOrStaffRole = jwsUser.roles.includes('admin')
  || jwsUser.roles.includes('staff');

// customer만 있는 경우 차단
const hasOnlyCustomerRole = jwsUser.roles.includes('customer')
  && !hasAdminOrStaffRole
  && !jwsUser.roles.includes('supplier');

// supplier만 있는 경우 차단
const hasOnlySupplierRole = jwsUser.roles.includes('supplier')
  && !hasAdminOrStaffRole
  && !jwsUser.roles.includes('customer');

if (hasOnlyCustomerRole || hasOnlySupplierRole) {
  await signOut(auth);
  throw new Error(...);
}
```

#### 4.3.2 다중 역할 우선순위
한 사용자가 여러 역할을 가진 경우, 다음 우선순위에 따라 **주 역할(Primary Role)**을 결정합니다:

**우선순위**: `admin` > `staff` > `customer` > `supplier`

**예시**:
- 사용자 A: `['admin', 'customer']` → 주 역할: `admin`
- 사용자 B: `['staff', 'supplier']` → 주 역할: `staff`
- 사용자 C: `['customer', 'supplier']` → 주 역할: `customer` (플랫폼 로그인 불가)

**주 역할 계산 함수** (각 컴포넌트에서 로컬 헬퍼로 사용):
```typescript
const getPrimaryRole = (roles: UserRole[]): UserRole => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('staff')) return 'staff';
  if (roles.includes('customer')) return 'customer';
  if (roles.includes('supplier')) return 'supplier';
  return 'staff'; // 기본값
};
```

**주의사항**:
- 주 역할은 UI 표시용으로만 사용되며, **저장되지 않습니다**.
- 권한 검증은 항상 `roles` 배열 전체를 확인합니다 (`roles.includes('admin')`).
- 주 역할은 컴포넌트마다 필요시 on-the-fly로 계산합니다.

#### 4.3.3 로그인 플로우
```
1. 사용자 로그인 시도
   ↓
2. Firebase Authentication (휴대폰번호 → 이메일 변환)
   ↓
3. Firestore 사용자 정보 조회 (authUid 기반)
   ↓
4. 계정 상태 확인 (isActive)
   ↓
5. 역할 검증
   - admin ✓ 또는 staff ✓ 있음 → 로그인 성공
   - customer만 있음 → 차단 (쇼핑몰 안내)
   - supplier만 있음 → 차단 (로그인 제한 안내)
   ↓
6. 마지막 로그인 시간 업데이트
   ↓
7. 역할별 대시보드로 리다이렉트
```

#### 4.3.4 세션 관리
- **독립 세션**: Admin 앱과 Shop 앱은 독립된 Firebase Auth 세션 유지
- **LocalStorage 캐싱**: 사용자 정보 24시간 캐싱 (빠른 초기 로딩)
- **자동 로그아웃**: 비활성 상태 지속 시 세션 만료
- **세션 공유 불가**: Admin에서 로그인해도 Shop에서는 별도 로그인 필요

---

## 5. 데이터 모델

### 5.1 Firestore 컬렉션 구조

#### 5.1.1 users (사용자)
**문서 ID**: 휴대폰번호 (정규화, 11자리 숫자)

```typescript
interface JWSUser {
  uid: string;                                      // 문서 ID와 동일
  authUid?: string;                                 // Firebase Auth UID
  name: string;                                     // 이름
  mobile: NormalizedMobile;                         // 휴대폰번호 (11자리)
  role: 'admin' | 'staff' | 'customer' | 'supplier'; // 역할
  email?: string;                                   // 이메일 (선택)

  // customer 역할 전용
  linkedCustomers?: NormalizedBusinessNumber[];     // 연결된 고객사 목록
  smsRecipientInfo?: SMSRecipientInfo;              // SMS 수신자 정보

  // supplier 역할 전용
  linkedSuppliers?: NormalizedBusinessNumber[];     // 연결된 공급사 목록

  isActive: boolean;                                // 활성 상태
  createdAt: Timestamp;                             // 생성일시
  lastLogin?: Timestamp;                            // 마지막 로그인
  requiresPasswordChange: boolean;                  // 비밀번호 변경 필요
  passwordChangedAt?: Timestamp;                    // 비밀번호 변경일시
}
```

#### 5.1.2 customers (고객사)
**문서 ID**: 사업자등록번호 (정규화, 10자리 숫자)

```typescript
interface ContactInfo {
  userId?: string;                           // users 컬렉션 문서 ID (연결된 경우)
  name: string;                              // 이름
  mobile: NormalizedMobile;                  // 휴대폰번호
  email?: string;                            // 이메일 (선택)
}

interface Customer {
  businessNumber: NormalizedBusinessNumber;  // 사업자번호
  businessName: string;                      // 상호명
  president: string;                         // 대표자명
  businessAddress: string;                   // 주소
  businessType?: string;                     // 업태
  businessItem?: string;                     // 종목

  // 연락처
  presidentMobile?: NormalizedMobile;        // 대표 휴대폰
  businessPhone?: NormalizedPhone;           // 회사 전화
  businessEmail?: string;                    // 이메일

  // 주문 담당자 (users 연동)
  primaryContact: ContactInfo;               // 담당자1 (필수)
  secondaryContact?: ContactInfo;            // 담당자2 (선택)

  // 고객사 정보
  customerType: string;                      // 고객사 유형 (Settings 연동)
  discountRate: number;                      // 기본 할인율 (%)
  currentBalance: number;                    // 현재 미수금

  // 특가/즐겨찾기
  specialPrices: SpecialPrice[];             // 고객사별 특가
  favoriteProducts: FavoriteProduct[];       // 즐겨찾기 상품

  isActive: boolean;                         // 활성 상태
  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
}
```

#### 5.1.3 suppliers (공급사)
**문서 ID**: 사업자등록번호 (정규화, 10자리 숫자)

```typescript
interface Supplier {
  businessNumber: NormalizedBusinessNumber;  // 사업자번호
  businessName: string;                      // 상호명
  president: string;                         // 대표자명
  businessAddress: string;                   // 주소
  businessType?: string;                     // 업태
  businessItem?: string;                     // 종목

  // 연락처
  presidentMobile?: NormalizedMobile;        // 대표 휴대폰
  businessPhone?: NormalizedPhone;           // 회사 전화
  businessEmail?: string;                    // 이메일

  // 매입주문서 SMS 수신자 (users 연동)
  primaryContact: ContactInfo;               // 담당자1 (필수)
  secondaryContact?: ContactInfo;            // 담당자2 (선택)

  supplierType?: string;                     // 공급사 유형

  isActive: boolean;                         // 활성 상태
  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
}
```

#### 5.1.4 products (상품)
**문서 ID**: Firestore 자동 생성

```typescript
interface Product {
  productId?: string;                        // 문서 ID
  productCode: string;                       // 상품 코드 (P12345678)
  productName: string;                       // 상품명
  specification?: string;                    // 규격/사양

  // 분류 (Settings 연동)
  mainCategory?: string;                     // 대분류
  subCategory?: string;                      // 소분류

  // 가격
  purchasePrice?: number;                    // 매입가
  salePrices: {
    standard: number;                        // 표준가
    customerTypes: {                         // 고객사 유형별 가격
      [customerType: string]: number;
    };
  };

  // 재고
  stockQuantity?: number;                    // 현재 재고
  minimumStock?: number;                     // 최소 재고
  lots: ProductLot[];                        // 로트 정보
  latestPurchasePrice?: number;              // 최근 매입가

  // 미디어
  image?: string;                            // 메인 이미지 URL
  images?: string[];                         // 추가 이미지 (최대 4개)
  primaryImageIndex?: number;                // 대표 이미지 인덱스
  description?: string;                      // 상품 설명

  // 유통기한
  expirationDate?: string;                   // 유통기한
  shelfLife?: string;                        // 보관기간

  supplierId?: string;                       // 공급사 ID
  isActive: boolean;                         // 활성 상태
  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
}
```

#### 5.1.5 saleOrders (매출주문)
**문서 ID**: Firestore 자동 생성
**주문번호**: SO-YYMMDD-001

```typescript
interface SaleOrder {
  saleOrderNumber: string;                   // 매출주문번호
  customerId: string;                        // 고객사 ID
  customerInfo: {                            // 고객사 스냅샷
    businessName: string;
    businessNumber?: string;
    customerType: string;
  };

  orderItems: OrderItem[];                   // 주문 상품
  finalAmount: number;                       // 최종 금액
  itemCount: number;                         // 품목 수

  // 상태 관리
  status: 'placed' | 'confirmed' | 'pended' | 'rejected' | 'completed' | 'cancelled';

  // 일일식품 주문 타입 (주문 생성 시점에 확정, 이후 불변)
  dailyFoodOrderType?: 'regular' | 'additional' | 'none';
  // regular: 마감 시간 내 주문 (정규 집계, 전량 공급 보장)
  // additional: 마감 시간 후 주문 (여유분 재고로 처리)
  // none: 일일식품 미포함 주문

  placedAt: Timestamp;                       // 접수일시
  confirmedAt?: Timestamp;                   // 확정일시
  completedAt?: Timestamp;                   // 완료일시
  cancelledAt?: Timestamp;                   // 취소일시
  rejectedAt?: Timestamp;                    // 거부일시

  // pended 상태
  pendedReason?: string;                     // 보류 사유
  validationErrors?: ValidationError[];      // 검증 오류
  processedBy?: string;                      // 처리자
  pendedAt?: Timestamp;                      // 보류일시

  // 연동
  purchaseOrderNumber?: string;              // 매입주문번호
  saleLedgerId?: string;                     // 매출전표 ID

  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
  createdBy: string;                         // 생성자
}
```

**주문 생성 규칙:**
- 모든 SO는 `placed` 상태로 시작
- 일일식품(mainCategory='일일식품') 포함 여부 확인:
  - **일일식품 포함 시**: dailyFoodOrderType 필드 설정 (주문 생성 시점에 확정, 이후 불변)
    - status.status='open' → `dailyFoodOrderType='regular'`
    - status.status='closed' → `dailyFoodOrderType='additional'`
  - **일일식품 미포함 시**: `dailyFoodOrderType='none'`

**주문 삭제 규칙:**
- **접수 기간 중**(status='open'): 모든 SO 삭제 가능
- **접수 마감 후**(status='closed'):
  - `dailyFoodOrderType='regular'` SO: **삭제 불가** (정규 집계 완료됨)
  - `dailyFoodOrderType='additional'` SO: 삭제 가능
  - `dailyFoodOrderType='none'` SO: 삭제 가능

#### 5.1.6 purchaseOrders (매입주문)
**문서 ID**: Firestore 자동 생성
**주문번호**: PO-YYMMDD-001

```typescript
interface PurchaseOrder {
  purchaseOrderNumber: string;               // 매입주문번호
  supplierId: string;                        // 공급사 ID
  supplierInfo: {                            // 공급사 스냅샷
    businessName: string;
    smsRecipients: SMSRecipient[];
  };

  orderItems: PurchaseOrderItem[];           // 주문 상품
  itemCount: number;                         // 품목 수

  category: string;                          // 카테고리 (신선식품/냉동식품/공산품)

  status: 'placed' | 'confirmed' | 'pended' | 'cancelled' | 'completed';
  placedAt: Timestamp;                       // 발주일시
  confirmedAt?: Timestamp;                   // 확인일시
  pendedAt?: Timestamp;                      // 보류일시
  pendedReason?: string;                     // 보류 사유
  cancelledAt?: Timestamp;                   // 취소일시
  completedAt?: Timestamp;                   // 입고완료일시

  purchaseLedgerId?: string;                 // 매입전표 ID

  // SMS 발송 정보
  lastSmsSentAt?: Timestamp;                 // 마지막 SMS 발송
  smsSuccess?: boolean;                      // SMS 발송 성공

  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
  createdBy: string;                         // 생성자
}
```

#### 5.1.7 orderAggregations (주문 집계)
**문서 ID**: `YYMMDD` (날짜 기반)

```typescript
interface OrderAggregation {
  aggregationDate: string;                   // YYMMDD
  category: string;                          // 일일식품/냉동식품/공산품

  items: AggregatedItem[];                   // 집계 상품
  totalQuantity: number;                     // 총 수량
  totalItemCount: number;                    // 품목 수

  // 공급사별 분류
  supplierGroups: {
    [supplierId: string]: {
      supplierName: string;
      items: AggregatedItem[];
      totalQuantity: number;
      smsRecipients: SMSRecipient[];
    };
  };

  status: 'pending' | 'sent' | 'confirmed';  // 상태
  lastSmsSentAt?: Timestamp;                 // 마지막 SMS 발송

  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
}
```

#### 5.1.8 purchaseLedgers (매입원장)
**문서 ID**: Firestore 자동 생성

```typescript
interface PurchaseLedger {
  ledgerId: string;                          // 전표 ID
  ledgerNumber: string;                      // 전표번호 (PL-YYMMDD-001)

  purchaseOrderId: string;                   // 매입주문 ID
  purchaseOrderNumber: string;               // 매입주문번호

  supplierId: string;                        // 공급사 ID
  supplierName: string;                      // 공급사명

  items: PurchaseLedgerItem[];               // 상품 명세
  totalAmount: number;                       // 총 매입액
  itemCount: number;                         // 품목 수

  transactionDate: Timestamp;                // 거래일자
  settlementDate?: Timestamp;                // 정산일자
  settlementStatus: 'pending' | 'settled';   // 정산 상태

  createdAt: Timestamp;                      // 생성일시
  createdBy: string;                         // 생성자
}
```

#### 5.1.9 freshFoodStatus (신선식품 집계 상태)
**문서 ID**: `current` (고정)

```typescript
interface FreshFoodStatus {
  startAt: Timestamp;           // 집계 시작 시간
  endAt?: Timestamp;            // 집계 마감 시간 (마감 전엔 null)
  onFreshfood: boolean;         // true: 집계 중, false: 마감됨
  confirmedBy?: string;         // 마감 처리자 ID
  confirmedByName?: string;     // 마감 처리자 이름
}
```

**설명:**
신선식품 집계 기간 상태를 관리하는 단일 문서입니다.

**상태 관리:**
- `status='open'`: 접수 중, 신규 SO는 `dailyFoodOrderType='regular'`
- `status='closed'`: 접수 마감, 신규 SO는 `dailyFoodOrderType='additional'`

**접수 시작:**
1. 관리자가 "일일식품 접수 시작" 버튼 클릭
2. `status='open'`로 설정
3. `openedAt=현재시간`, `closedAt=null`

**접수 마감:**
1. 관리자가 "일일식품 접수 마감" 버튼 클릭
2. `dailyFoodOrderType='regular'`인 SO의 일일식품 품목만 집계
3. 매입주문 생성 + SMS 발송
4. `status='closed'`로 설정
5. `closedAt=현재시간`

#### 5.1.10 settings (시스템 설정)
**문서 ID**: `current`

```typescript
interface SystemSettings {
  // 고객사 유형
  customerTypes: string[];                   // ["일반고객", "VIP고객", ...]

  // 상품 카테고리
  productCategories: {
    [mainCategory: string]: string[];        // { "채소": ["잎채소", "근채류"], ... }
  };

  // 업무 설정
  businessSettings: {
    dailyFoodCutoffTime: string;             // 일일식품 마감 시간 (HH:mm)
    orderExpirationHours: number;            // 주문 만료 시간 (시간)
  };

  updatedAt: Timestamp;                      // 수정일시
  updatedBy: string;                         // 수정자
}
```

### 5.2 번호 정규화 규칙
- **휴대폰번호**: 11자리 숫자만 (예: `01012345678`)
- **사업자번호**: 10자리 숫자만 (예: `1234567890`)
- **회사 전화번호**: 지역번호 포함 숫자만 (예: `0212345678`)

### 5.3 Firestore 인덱스
주요 복합 인덱스:
- `saleOrders`: `customerId` + `status` + `placedAt DESC`
- `saleOrders`: `status` + `confirmationStatus` + `placedAt DESC`
- `purchaseOrders`: `supplierId` + `status` + `placedAt DESC`
- `purchaseOrders`: `category` + `status` + `placedAt DESC`

---

## 6. Cloud Functions

### 6.1 사용자 관리 Functions

#### 6.1.1 createUserAccount (onRequest)
**용도**: 새 사용자 계정 생성 (Firebase Auth + Firestore)

**입력**:
```typescript
{
  mobile: string;          // 휴대폰번호
  name: string;            // 이름
  role: UserRole;          // 역할
  linkedCustomers?: string[];  // 연결 고객사
}
```

**출력**:
```typescript
{
  success: boolean;
  uid: string;             // 생성된 사용자 ID
  defaultPassword: string; // 초기 비밀번호
}
```

**인증**: Bearer 토큰 필요 (admin만 호출 가능)
**CORS**: 설정됨

#### 6.1.2 changeUserPassword (onCall)
**용도**: 사용자 비밀번호 변경

**입력**:
```typescript
{
  currentPassword: string;
  newPassword: string;
}
```

**출력**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### 6.1.3 resetUserPassword (onCall)
**용도**: 관리자가 사용자 비밀번호 초기화

**입력**:
```typescript
{
  uid: string;  // 대상 사용자 ID
}
```

**출력**:
```typescript
{
  success: boolean;
  message: string;
  newPassword: string;  // 새 초기 비밀번호
}
```

#### 6.1.4 deleteUserAccount (onCall)
**용도**: 사용자 계정 완전 삭제 (Auth + Firestore)

**입력**:
```typescript
{
  uid: string;
}
```

**출력**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 6.2 SMS Functions

#### 6.2.1 sendSms (onCall)
**용도**: 단일 SMS 발송

**입력**:
```typescript
{
  to: string;      // 수신자 번호
  content: string; // 메시지 내용
}
```

**출력**:
```typescript
{
  success: boolean;
  messageId: string;
  statusCode: string;
}
```

**제공자**: NCP SENS

#### 6.2.2 sendBulkSms (onCall)
**용도**: 대량 SMS 발송 (발주서 전송)

**입력**:
```typescript
{
  recipients: Array<{
    to: string;
    content: string;
  }>;
}
```

**출력**:
```typescript
{
  success: boolean;
  results: Array<{
    to: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}
```

#### 6.2.3 getBalance (onCall)
**용도**: SMS 잔액 조회

**출력**:
```typescript
{
  success: boolean;
  balance: number;
}
```

#### 6.2.4 getStatistics (onCall)
**용도**: SMS 발송 통계 조회

**출력**:
```typescript
{
  success: boolean;
  statistics: {
    totalSent: number;
    successRate: number;
    // ...
  };
}
```

### 6.3 기타 Functions

#### 6.3.1 sendAlimtalk (onCall)
**용도**: 카카오 알림톡 발송 (향후 구현)

#### 6.3.2 sendFriendtalk (onCall)
**용도**: 카카오 친구톡 발송 (향후 구현)

#### 6.3.3 sendVoice (onCall)
**용도**: 음성 전화 발송 (향후 구현)

#### 6.3.4 sendRcs (onCall)
**용도**: RCS 메시지 발송 (향후 구현)

---

## 7. 주요 기능

### 7.1 신선식품(Fresh Food) 집계 프로세스

#### 7.1.1 업무 흐름

**고객 주문 생성:**
1. 고객이 Shop 앱 또는 직원이 대리 쇼핑으로 주문 생성
2. 매출주문(SO) 생성 (`status='placed'`)
3. 일일식품 포함 여부 확인 (주문 생성 시점에 확정, 이후 불변):
   - **일일식품 포함** (`mainCategory='일일식품'`): dailyFoodOrderType 필드 설정
     - `status='open'` → `dailyFoodOrderType='regular'`
     - `status='closed'` → `dailyFoodOrderType='additional'`
   - **일일식품 미포함**: `dailyFoodOrderType='none'`
4. 자동 검사 (초기: 모두 합격)
5. SO 확정 (`status='confirmed'`)

**실시간 집계:**
- 모든 SO는 실시간으로 집계/조회 가능
- 카테고리별 집계
- 현재고와 비교

#### 7.1.2 신선식품 집계 시작
**경로**: 신선식품 확정 페이지 (`/orders/fresh-food-confirmation`)
**권한**: admin만 가능

**처리 내용:**
1. cutoff 업데이트:
   - `status='open'`
   - `openedAt=현재시간`
   - `closedAt=null`
2. 이후 생성되는 SO는 `dailyFoodOrderType='regular'`

#### 7.1.3 일일식품 접수 마감
**버튼**: "일일식품 접수 마감 (매입주문 생성)"

**처리 내용:**
1. `dailyFoodOrderType='regular'`인 SO 조회
2. 일일식품 품목만 추출하여 집계
3. 공급사별 그룹핑
4. 매입주문(PO) 생성 (+ 여유분)
5. 공급사에 발주서 SMS 발송
6. cutoff 업데이트:
   - `status='closed'`
   - `closedAt=현재시간`
7. 이후 생성되는 SO는 `dailyFoodOrderType='additional'`

**접수 마감 후:**
- `dailyFoodOrderType='regular'` SO는 삭제 불가
- 여유분 재고로 `dailyFoodOrderType='additional'` 주문 처리
- 언제든 다시 접수 시작 가능

#### 7.1.4 주문 상태 흐름
```
[모든 매출주문]
placed → confirmed → completed → 매출원장
      ↘ pended (보류)
      ↘ rejected (거부)
      ↘ cancelled (취소)

[집계 구분 - 신선식품 포함 시만]
- regular: 집계 기간 중 주문 (정규 집계 원천, 전량 공급 보장)
- additional: 집계 마감 후 주문 (여유분 재고로 처리)
```

### 7.2 입고 관리

#### 7.2.1 입고 검수
**경로**: 일일주문 입고 페이지 (`/orders/inbound`)

**처리 내용**:
1. 매입주문 목록 조회 (`status: 'confirmed'`)
2. 입고 수량 입력 및 검수
3. 상품별 로트 생성 및 재고 업데이트
4. 매입주문 상태를 `completed`로 변경
5. 매입원장 생성 (purchaseLedgers)

#### 7.2.2 매입 원장
**경로**: 매입 원장 페이지 (`/ledgers/purchase`)

**조회 기능**:
- 공급사별 매입 내역
- 기간별 매입 통계
- 정산 상태 관리
- 엑셀 내보내기

### 7.3 상품 관리

#### 7.3.1 상품 등록
**경로**: 상품 추가 페이지 (`/products/add`)

**입력 항목**:
- 기본 정보: 상품명, 규격, 카테고리
- 가격: 매입가, 표준가, 고객사 유형별 판매가
- 재고: 현재 재고, 최소 재고
- 미디어: 이미지(최대 4개), 대표 이미지 설정, 설명
- 유통기한: 유통기한, 보관기간
- 공급사 연결

**상품 코드 생성**: 자동 생성 (P + 8자리 숫자)

#### 7.3.2 로트 관리
- **로트 ID**: YYYYMMDD (입고일 기준)
- **로트 정보**: 입고수량, 잔여수량, 매입가격
- **FIFO 방식**: 선입선출 원칙으로 재고 소진

### 7.4 고객사/공급사 관리

#### 7.4.1 공통 기능
- **문서 ID**: 사업자등록번호 (10자리 숫자)
- **담당자 관리**: users 컬렉션과 연동 (userId 기반)
  - 담당자1 (필수), 담당자2 (선택)
  - 사용자 등록 후 연결 (UserLinkModal 사용)
  - 양방향 연결: users.linkedCustomers/linkedSuppliers ↔ company.primaryContact/secondaryContact
- **검색**: 상호명, 사업자번호, 대표자명
- **필터**: 활성/비활성, 고객사 유형

#### 7.4.2 고객사 전용 기능
- **할인율 설정**: 기본 할인율 + 고객사 유형별 가격
- **특가 상품**: 고객사별 개별 특가 설정
- **즐겨찾기 상품**: 쇼핑몰에서 빠른 주문용
- **미수금 관리**: 현재 미수금 조회 및 정산
- **담당자 역할**: customer role 사용자를 담당자로 연결

#### 7.4.3 공급사 전용 기능
- **매입주문서 SMS 수신**: 담당자에게 자동 발송
- **담당자 역할**: supplier role 사용자를 담당자로 연결
- **향후 확장**: 공급사 포털 접근 권한

### 7.5 SMS 센터

#### 7.5.1 SMS 발송
**경로**: SMS 센터 페이지 (`/sms`)

**기능**:
- 단일 SMS 발송
- 대량 SMS 발송 (엑셀 업로드)
- 발주서 자동 발송
- 잔액 조회
- 발송 내역 조회

#### 7.5.2 템플릿 관리
- 발주서 템플릿
- 배송 알림 템플릿
- 주문 확인 템플릿
- 사용자 정의 템플릿

---

## 8. 페이지별 상세 기능

### 8.1 인증 페이지

#### 8.1.1 로그인 페이지 (`/login`)
- 휴대폰번호 + 비밀번호 로그인
- 로그인 실패 시 오류 메시지
- 자동 리다이렉트 (역할별 대시보드)

#### 8.1.2 비밀번호 변경 페이지 (`/change-my-password`)
- 현재 비밀번호 확인
- 새 비밀번호 입력 (정책 검증)
- 변경 완료 후 재로그인

### 8.2 주문 관리 페이지

#### 8.2.1 신선식품 확정 페이지 (`/orders/fresh-food-confirmation`)
**권한**: admin만 접근 가능

**UI 구성**: 2-Panel 레이아웃

**상태 표시:**
- 🟢 **신선식품 집계 중** (`onFreshfood=true`)
  - 시작 시간: YYYY-MM-DD HH:mm
- 🔴 **신선식품 집계 마감됨** (`onFreshfood=false`)
  - 마감 시간: YYYY-MM-DD HH:mm

**Panel 1: 매출주문 합계**
- `dailyFoodOrderType='regular'`인 모든 SO 표시
- 필터: 고객사, 금액, 상태
- 총계: 주문 수, 총 금액, 품목 수

**Panel 2: 신선식품 집계**
- 신선식품 카테고리만 집계
- 공급사별 그룹핑
- 상품별 수량 합산
- 현재고 비교
- SMS 발송 대상 확인

**토글 버튼:**
- **집계 마감 상태** (`onFreshfood=false`)
  - 버튼: "신선식품 집계 시작"
  - 동작: `start()` 호출 → `onFreshfood=true`

- **집계 중 상태** (`onFreshfood=true`)
  - 버튼: "신선식품 집계 마감 (매입주문 생성)"
  - 동작: `close()` 호출 → 집계 + PO 생성 + SMS 발송 → `onFreshfood=false`

#### 8.2.2 입고 관리 페이지 (`/orders/inbound`)
**권한**: admin, staff 접근 가능

**기능**:
- 매입주문 목록 조회 (`status: 'confirmed'`)
- 입고 수량 입력 및 검수
- 로트 생성 및 재고 반영
- 매입가격 결정 (로트별)
- 매입원장 자동 생성
- 입고 완료 처리 (`status: 'completed'`)

#### 8.2.3 매출주문 접수 (`/orders/sale-orders`)
**권한**: admin, staff 접근 가능
**페이지명**: SaleOrderListPage
**페이지 제목**: "매출주문 접수"

**UI 구성**: SubPageHeader + 탭 필터 + 통계 패널 + 일괄 확정 버튼 + DataGrid + 다이얼로그

**탭 필터**:
- 전체: 모든 주문 표시 (placed + confirmed)
- 접수: placed 상태 주문만 표시 (체크박스 활성화)
- 확정: confirmed 상태 주문만 표시

**통계 패널** (4-Card 레이아웃):
- 주문 건수: 현재 탭의 주문 수
- 상품 종류: 고유 상품 종류 수
- 상품 수량: 전체 상품 수량
- 금액: 총 주문 금액

**일괄 확정 버튼**:
- 접수 탭에서만 표시: "일괄 확정 (N)" (N = 선택된 주문 수)
- 동작: `batchConfirmSaleOrders()` 호출
- 효과: 선택된 모든 placed 주문을 confirmed로 변경
- 재고 확인: 일괄 확정 시 재고 부족 경고 표시 (StockWarningDialog)
- 재고 부족 시: 개별 확정 권장 메시지 표시

**DataGrid 컬럼**:
- 체크박스: 접수 탭에서만 활성화 (일괄 확정용)
- 주문번호: 매출주문 코드
- 주문일시: 주문 접수 시간 (YY-MM-DD HH:mm)
- 고객사: 고객사명
- 상품수량: 주문 상품 총 수량
- 금액: 주문 금액
- 상태: Chip으로 표시 (접수/확정/완료)
- 처리: IconButton (EditIcon) - 상세 다이얼로그 열기

**SaleOrderDetailDialog (개별 주문 확정)**:
- 주문 기본 정보 표시
- 상태 변경 RadioGroup: 확정/보류/거절
- placed → confirmed 전환 시:
  - 자동 재고 확인 (`confirmSaleOrder()` 호출)
  - 재고 부족 시 StockWarningDialog 표시
  - 강제 확정 옵션 제공 (재고 확인 우회)
- 주문 상품 목록 DataGrid

**재고 검증 로직**:
- 개별 확정: `confirmSaleOrder(saleOrderNumber)`
  - 재고 확인 → 부족 시 경고 → 강제 확정 가능
- 일괄 확정: `batchConfirmSaleOrders(saleOrderNumbers[])`
  - 각 주문별 재고 확인 → 부족 건 집계 → 경고 표시 → 개별 확정 권장

**StockWarningDialog**:
- 재고 부족 상품 목록 테이블
- 컬럼: 상품명, 주문 수량, 현재 재고, 부족 수량
- 버튼: 취소, 그래도 확정

**기능**:
- 주문 목록 실시간 조회
- 탭별 필터링 (전체/접수/확정)
- 체크박스 선택 (접수 탭만)
- 개별 확정: 상세 다이얼로그에서 상태 변경
- 일괄 확정: 여러 주문 동시 확정
- 재고 검증 및 경고
- 정렬 및 페이징 (10/20/30건)
- 새로고침 버튼

**데이터 소스**:
- `SaleOrderContext` (전역 상태 관리)
  - `orders`: cutoffOpenedAt 이후의 모든 매출주문 (placed + confirmed)
  - `orderStats`: 주문 통계 (confirmed 주문만 집계)
  - `cutoffInfo`: 일일식품 마감 정보

**통계 집계 규칙**:
- SaleOrderContext.orderStats는 **confirmed 상태 주문만** 집계
- 페이지 내부 통계는 현재 탭에 표시된 주문 기준

**서비스 함수**:
- `checkStockAvailability(orderItems)`: 재고 확인
- `confirmSaleOrder(saleOrderNumber)`: 개별 주문 확정 (재고 검증 포함)
- `batchConfirmSaleOrders(saleOrderNumbers[])`: 일괄 주문 확정
- `updateSaleOrderStatus(saleOrderNumber, status)`: 상태 변경 (재고 검증 없음)

**명명 규칙**:
- Service 레이어: `batch` 접두사 (예: `batchConfirmSaleOrders`)
- UI 핸들러: `All` 접미사 (예: `handleConfirmAllOrders`)
- 버튼 레이블: "일괄" (한글)

**메뉴 연결**:
- 메인 메뉴: "매출주문 접수" (단일 페이지, 서브 메뉴 없음)

#### 8.2.4 일일식품 발주 현황 (`/orders/daily-food-order`)
**권한**: admin, staff 접근 가능
**페이지 제목**: "일일식품 발주 현황"

**UI 구성**: SubPageHeader + 집계 시간 정보 + 통계 패널 + 마감 버튼 + DataGrid

**집계 시간 정보 패널** (3-Card 레이아웃):
- 시작 시간: 일일식품 집계 시작 시간
- 현재 시간: 실시간 시계
- 마감 시간: 마감 시간 표시 (마감 후)

**통계 패널** (4-Card 레이아웃):
- 정규 주문: `dailyFoodOrderType='regular'` 주문 수
- 추가 주문: `dailyFoodOrderType='additional'` 주문 수
- 상품 수량: 총 상품 수량
- 금액: 총 주문 금액

**마감 버튼**:
- 접수 중 상태: "일일식품 마감 (마감만)" 버튼
  - 동작: `dailyCutoffService.closeOnly()` 호출
  - 효과: cutoff status만 'closed'로 변경, PO 생성 없음
  - 안내: "마감 후 매입 집계 페이지에서 매입주문을 생성해주세요."
- 마감 상태: "일일식품 접수 재시작" 버튼
  - 동작: `dailyCutoffService.open()` 호출

**DataGrid**:
- dailyFoodOrderType='regular' 주문 목록 표시
- 컬럼: 주문번호, 고객사, 상품수량, 금액, 상태
- Firestore 실시간 리스너

**메뉴 연결**:
- 메인 메뉴: "일일식품 발주"
- 서브 메뉴: "발주 현황" (이 페이지)

**특징**:
- 3-Stage 수동 프로세스의 첫 번째 단계
- 마감 버튼 클릭 시 PO 생성 없이 상태만 변경
- 마감 후 매입 집계 페이지로 이동 안내

#### 8.2.7 일일식품 매입 집계 (`/orders/daily-food-aggregation`)
**권한**: admin, staff 접근 가능
**페이지 제목**: "일일식품 매입 집계"

**UI 구성**: SubPageHeader + 통계 패널 + 일괄 생성 버튼 + DataGrid

**통계 패널** (4-Card 레이아웃):
- 공급사 수: 집계된 공급사 수
- 상품 종류: 집계된 상품 종류 수
- 상품 수량: 총 상품 수량
- 매입 금액: 총 매입 금액

**일괄 생성 버튼**:
- "매입주문 일괄 생성 (N개 공급사)"
- 동작: `dailyFoodPurchaseOrderService.createBatchFromAggregation()`
- 효과: 모든 공급사에 대해 PO 생성 (status='placed')
- 완료 후: 자동으로 매입 발주 페이지로 이동

**DataGrid - 공급사별 목록**:
- 컬럼:
  - 공급사: 공급사명
  - 상품 종류: 해당 공급사의 상품 종류 수
  - 총 수량: 해당 공급사의 총 주문 수량
  - 총 금액: 해당 공급사의 총 금액
  - 생성: 개별 생성 버튼 (AddIcon)
- 개별 생성 버튼 클릭:
  - 동작: `dailyFoodPurchaseOrderService.createFromAggregation(supplier, 'placed')`
  - 효과: 해당 공급사에 대해서만 PO 생성
  - 완료 후: 해당 공급사 행 제거

**데이터 소스**:
- `orderAggregationService.aggregateDailyFoodOrders()`
- `dailyFoodOrderType='regular'` 주문만 집계
- 공급사별 그룹핑

**실시간 갱신**:
- saleOrders 컬렉션 Firestore 실시간 리스너
- 주문 변경 시 자동 재집계

**메뉴 연결**:
- 메인 메뉴: "일일식품 발주"
- 서브 메뉴: "매입 집계" (이 페이지)

**특징**:
- 3-Stage 수동 프로세스의 두 번째 단계
- 일괄 생성 + 개별 생성 모두 지원
- PO 생성 후 매입 발주 페이지로 자동 이동

#### 8.2.5 일일식품 매입 발주 (`/orders/daily-food-purchase-order-list`)
**권한**: admin, staff 접근 가능
**페이지 제목**: "일일식품 매입 발주"

**UI 구성**: SubPageHeader + 통계 패널 + 일괄 SMS 버튼 + DataGrid

**통계 패널** (4-Card 레이아웃):
- 발주 건수: 오늘 생성된 PO 수
- 상품 종류: 총 상품 종류 수
- 상품 수량: 총 상품 수량
- 매입 금액: 총 매입 금액

**일괄 SMS 발송 버튼**:
- "SMS 일괄 발송 및 확정 (N건 대기)"
- 대상: `status='placed'`인 PO만
- 동작:
  1. `dailyFoodPurchaseOrderService.sendBatchSms()` 호출
  2. SMS 성공한 PO는 `status='confirmed'`로 변경
- 완료 후: 성공/실패 건수 표시

**DataGrid - PO 목록**:
- 필터: `category='일일식품'`, `placedAt >= 오늘 00:00`
- 컬럼:
  - PO번호: 매입주문 코드
  - 공급사: 공급사명
  - 품목수: 주문 품목 수
  - 금액: 총 금액
  - 상태: Chip (대기/확정)
  - SMS 발송: 개별 발송 버튼 (SendIcon)
- 개별 발송 버튼:
  - 대상: `status='placed'`인 PO만 활성화
  - 동작:
    1. SMS 발송
    2. 성공 시 `status='confirmed'`로 변경
  - 완료 상태: CheckCircleIcon (비활성)

**데이터 소스**:
- `dailyFoodPurchaseOrderService.getTodayOrders()`
- Firestore 실시간 리스너

**메뉴 연결**:
- 메인 메뉴: "일일식품 발주"
- 서브 메뉴: "매입 발주" (이 페이지)

**특징**:
- 3-Stage 수동 프로세스의 세 번째 단계
- 일괄 SMS + 개별 SMS 모두 지원
- SMS 발송 후 자동으로 PO 상태 confirmed로 변경

### 8.3 기준정보 관리 페이지

#### 8.3.1 고객사 관리 (`/customers`)
**기능**:
- 고객사 목록 (DataGrid)
- 검색/필터
- 고객사 추가
- 고객사 상세 보기/수정
- 활성/비활성 토글
- **담당자 관리**:
  - UserLinkModal로 customer role 사용자 연결
  - 담당자1 (필수), 담당자2 (선택)
  - 담당자1 제거 시 담당자2 자동 승격
  - 1줄 컴팩트 카드 UI (Chip | Phone | Name | Delete)

#### 8.3.2 공급사 관리 (`/suppliers`)
**기능**:
- 공급사 목록
- 검색/필터
- 공급사 추가
- 공급사 상세 보기/수정
- 활성/비활성 토글
- **담당자 관리**:
  - UserLinkModal로 supplier role 사용자 연결
  - 담당자1 (필수), 담당자2 (선택)
  - 담당자1 제거 시 담당자2 자동 승격
  - 1줄 컴팩트 카드 UI (Chip | Phone | Name | Delete)

#### 8.3.3 상품 관리 (`/products`)
**기능**:
- 상품 목록 (DataGrid)
- 검색/필터 (카테고리, 공급사)
- 상품 추가
- 상품 상세 보기/수정
- 이미지 관리 (최대 4개)
- 로트 내역 조회
- 재고 부족 상품 필터

### 8.4 원장 관리 페이지

#### 8.4.1 매입 원장 (`/ledgers/purchase`)
**권한**: admin, staff 접근 가능

**기능**:
- 매입 전표 목록
- 공급사별 조회
- 기간별 조회
- 정산 상태 관리
- 상세 내역 보기
- 엑셀 내보내기

#### 8.4.2 매출 원장 (`/ledgers/sales`)
**구현 예정**

### 8.5 시스템 설정 페이지

#### 8.5.1 사용자 설정 (`/users`)
**권한**: admin만 접근 가능

**기능**:
- 사용자 목록 (DataGrid)
- 사용자 추가 (휴대폰번호, 이름, 역할)
  - 역할: admin, staff, customer, supplier
- 사용자 수정
- 사용자 삭제 (연결된 회사가 없을 때만 가능)
- 비밀번호 초기화
- **역할별 연결 관리**:
  - customer: linkedCustomers (고객사 목록)
  - supplier: linkedSuppliers (공급사 목록)
- 활성/비활성 토글

**사용자 정보 수정 모달 UI**:
- **기본 정보 패널** (3칼럼 레이아웃):
  - 휴대폰번호(ID): 30% 너비
  - 이름: 30% 너비
  - 역할: 40% 너비 (다중 역할 Chip 표시)
  - 계정 상태: 패널 하단에 배치 (Switch + Chip + 설명)
- **비밀번호 관리**: supplier 단독 역할은 제외
- **위험 구역 (삭제)**:
  - 인라인 확인 방식 (별도 모달 없음)
  - 삭제 버튼 클릭 → [취소] [삭제 확인] 버튼으로 변경
  - 간결한 안내 문구 유지

**초기 비밀번호**: `password123!` (첫 로그인 시 변경 필수)

**로그인 제한**:
- supplier role은 Admin 앱 로그인 불가 (AuthContextProvider에서 차단)

#### 8.5.2 SMS 센터 (`/sms`)
**권한**: admin만 접근 가능

**기능**:
- 단일 SMS 발송
- 대량 SMS 발송
- 발송 내역 조회
- 잔액 조회
- 템플릿 관리

### 8.6 기타 페이지

#### 8.6.1 대시보드 (`/dashboard`)
**기능**:
- 당일 주문 통계
- 일일식품 확정 상태
- 최근 주문 목록
- 매출/매입 요약
- 차트 (Recharts)

#### 8.6.2 대리 쇼핑 (`/proxy-shopping`)
**권한**: admin, staff 접근 가능

**기능**:
- 고객사 선택
- Shop 앱 새 창 오픈 (window.open)
- URL 파라미터로 고객사 정보 전달
- 독립된 세션 유지

---

## 9. 메뉴 구조

### 9.1 Admin 역할 메뉴
```
├── 대시보드
├── 매출주문 접수
├── 일일식품 발주
│   ├── 발주 현황
│   ├── 매입 집계
│   └── 매입 발주
├── 입고 관리
├── 출하 관리
├── 매입원장 관리
├── 매출원장 관리
├── 기준정보 관리
│   ├── 고객사 관리
│   ├── 공급사 관리
│   └── 상품 관리
└── 시스템 설정
    ├── 사용자 설정
    └── SMS 센터
```

### 9.2 Staff 역할 메뉴
```
├── 대시보드
├── 매출주문 접수
├── 일일식품 발주
│   ├── 발주 현황
│   ├── 매입 집계
│   └── 매입 발주
├── 입고 관리
├── 출하 관리
├── 매입원장 관리
├── 매출원장 관리
└── 시스템 설정
    └── SMS 센터
```

### 9.3 Customer 역할 메뉴
```
└── 대시보드
```

---

## 10. 배포 및 운영

### 10.1 개발 환경
```bash
# Admin 앱 개발 서버 실행
cd /home/soo/jhw/admin
npm install
npm run dev
# http://localhost:5173

# Functions 에뮬레이터 (선택)
firebase emulators:start
```

### 10.2 프로덕션 빌드
```bash
# Admin 앱 빌드
cd /home/soo/jhw/admin
npm run build
# 빌드 결과: admin/dist/

# Shop 앱 빌드
cd /home/soo/jhw/shop
npm run build
# 빌드 결과: shop/dist/
```

### 10.3 배포
```bash
# Firebase Hosting 배포
cd /home/soo/jhw
firebase deploy --only hosting

# Functions 배포
firebase deploy --only functions

# 전체 배포
firebase deploy
```

**배포 URL**:
- Admin: https://jinhyun-admin.web.app
- Shop: https://jinhyun-shop.web.app

### 10.4 환경 변수
**파일**: `/admin/.env`

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=jinhyun-wholesale
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# 에뮬레이터 사용 여부 (선택)
VITE_USE_FIREBASE_EMULATOR=false
```

### 10.5 보안 규칙

#### Firestore Rules
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근
    match /{document=**} {
      allow read, write: if request.auth != null;
    }

    // 역할 기반 접근 제어
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isStaff() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'staff';
    }

    // 사용자는 본인 정보만 수정 가능
    match /users/{userId} {
      allow read: if request.auth.uid != null;
      allow update: if request.auth.uid == userId || isAdmin();
      allow delete: if isAdmin();
    }

    // 고객사/공급사는 admin/staff만 수정 가능
    match /customers/{customerId} {
      allow read: if request.auth.uid != null;
      allow write: if isAdmin() || isStaff();
    }

    match /suppliers/{supplierId} {
      allow read: if request.auth.uid != null;
      allow write: if isAdmin() || isStaff();
    }
  }
}
```

### 10.6 모니터링
- Firebase Console: https://console.firebase.google.com/project/jinhyun-wholesale
- Functions 로그: Logs Explorer
- Hosting 사용량: Hosting Dashboard
- Firestore 사용량: Firestore Dashboard

### 10.7 백업
- Firestore 자동 백업 (매일 실행)
- Cloud Storage에 백업 저장
- 7일 간 백업 유지

---

## 부록

### A. 주요 TypeScript 타입
상세 타입 정의는 `/admin/src/types/` 디렉토리 참조:
- `user.ts`: 사용자 관련 타입
- `company.ts`: 고객사/공급사 타입
- `product.ts`: 상품 타입
- `saleOrder.ts`: 매출주문 타입
- `purchaseOrder.ts`: 매입주문 타입
- `purchaseLedger.ts`: 매입원장 타입
- `orderAggregation.ts`: 주문 집계 타입
- `freshFoodStatus.ts`: 신선식품 집계 상태 타입
- `phoneNumber.ts`: 번호 정규화 타입
- `sms.ts`: SMS 관련 타입

### B. 주요 공통 컴포넌트

#### B.1 SubPageHeader
**경로**: `/admin/src/components/common/SubPageHeader.tsx`

**용도**: 서브 페이지의 표준 헤더 컴포넌트

**Props**:
```typescript
interface SubPageHeaderProps {
  title: string;              // 페이지 제목
  onBack: () => void;         // 돌아가기 버튼 클릭 핸들러
  onRefresh: () => void;      // 새로고침 버튼 클릭 핸들러
  loading?: boolean;          // 새로고침 버튼 로딩 상태 (선택)
}
```

**UI 구조**:
- **좌측**: 돌아가기 버튼 (ArrowBackIcon) + 페이지 제목
  - 간격: gap: 2 (16px)
  - 돌아가기 버튼 텍스트: 모바일에서 숨김, 데스크톱에서 표시
- **우측**: 새로고침 버튼 (RefreshIcon)
  - 새로고침 버튼 텍스트: 모바일에서 숨김, 데스크톱에서 표시
- **여백**: p: 2, pb: 3

**반응형**:
- **모바일 (< 600px)**: 아이콘만 표시
- **데스크톱 (≥ 600px)**: 아이콘 + 텍스트 표시

**사용 페이지**:
- SaleOrderListPage
- ProductAggregationPage
- 기타 서브 페이지

### C. 주요 Contexts 및 서비스

#### C.1 Contexts (전역 상태 관리)

**SaleOrderContext** (`/admin/src/contexts/SaleOrderContext.tsx`):
- **목적**: 매출주문 데이터 전역 관리
- **제공 Hook**: `useSaleOrderContext()`
- **제공 값**:
  - `orders: SaleOrder[]` - 현재 집계 기간의 모든 매출주문
  - `orderStats` - 주문 통계 (주문 건수, 상품 종류, 상품 수량, 총 금액)
  - `cutoffInfo` - 일일식품 마감 정보 (status, openedAt, closedAt)
  - `loading: boolean` - 로딩 상태
  - `refreshData: () => Promise<void>` - 수동 새로고침 함수
- **특징**:
  - 단일 Firestore 쿼리로 모든 컴포넌트에 데이터 제공
  - Firestore 실시간 리스너로 자동 동기화
  - 중복 쿼리 제거로 비용 절감
- **사용 페이지**:
  - SaleOrderManagementPage (`/orders/sale-order-management`)
  - SaleOrderListPage (`/orders/sale-orders`)
  - DailyFoodOrderPage (`/orders/daily-food-order`)

**AuthContextProvider** (`/admin/src/contexts/AuthContextProvider.tsx`):
- **목적**: 사용자 인증 및 권한 관리
- **제공 Hook**: `useAuth()`
- **제공 값**:
  - `user: JWSUser | null` - 현재 로그인 사용자
  - `login()` - 로그인 함수
  - `logout()` - 로그아웃 함수
  - `loading: boolean` - 로딩 상태

#### C.2 주요 서비스 함수
상세 서비스 구현은 `/admin/src/services/` 디렉토리 참조:
- `userService.ts`: 사용자 관리
  - `addCustomerToUser()`: 사용자에 고객사 연결
  - `removeCustomerFromUser()`: 사용자에서 고객사 연결 해제
  - `addSupplierToUser()`: 사용자에 공급사 연결
  - `removeSupplierFromUser()`: 사용자에서 공급사 연결 해제
  - `getUsersByCustomer()`: 고객사에 연결된 사용자 목록
  - `getUsersBySupplier()`: 공급사에 연결된 사용자 목록
- `contactService.ts`: 담당자 연결 관리 (공통)
  - `linkContactToCustomer()`: 고객사에 사용자 담당자 연결
  - `unlinkContactFromCustomer()`: 고객사에서 사용자 연결 해제
  - `linkContactToSupplier()`: 공급사에 사용자 담당자 연결
  - `unlinkContactFromSupplier()`: 공급사에서 사용자 연결 해제
- `customerService.ts`: 고객사 관리
- `supplierService.ts`: 공급사 관리
- `productService.ts`: 상품 관리
- `saleOrderService.ts`: 매출주문 관리
- `purchaseOrderService.ts`: 매입주문 관리
- `purchaseLedgerService.ts`: 매입원장 관리
- `orderAggregationService.ts`: 주문 집계
- `freshFoodStatusService.ts`: 신선식품 집계 상태 관리
  - `getStatus()`: 현재 집계 상태 조회
  - `start()`: 집계 시작 (onFreshfood=true)
  - `close()`: 집계 마감 (집계 + PO 생성)
  - `initialize()`: 초기화
- `saleOrderService.ts`: 매출주문 관리
  - SO 생성 시 dailyFoodOrderType 필드 자동 설정 (주문 생성 시점에 확정, 이후 불변)
  - SO 삭제 시 규칙 검증
- `smsService.ts`: SMS 발송

### C. 참고 문서
- Firebase 공식 문서: https://firebase.google.com/docs
- React 공식 문서: https://react.dev
- Material-UI 문서: https://mui.com
- TypeScript 문서: https://www.typescriptlang.org/docs

---

**문서 버전**: v0.9.9
**마지막 업데이트**: 2025-10-19
**작성자**: Claude Code
**연락처**: 진현유통 관리자

## 변경 이력

### v0.9.9 (2025-10-19)
- **메뉴 구조 개편**:
  - 메뉴명 변경: "매출주문 접수관리" → "매출주문 접수집계"
  - "일일식품 매입발주" 메뉴 신규 추가 (3-stage 수동 프로세스)
  - 하이브리드 메뉴 패턴 확장: 일일식품 매입발주 (접수 현황, 매입 집계, 매입 발주)
- **일일식품 매입발주 3-Stage 수동 프로세스**:
  - **Stage 1: 접수 현황** (`/orders/daily-food-order`)
    - 마감 버튼 클릭 시 PO 생성 없이 cutoff status만 변경
    - `dailyCutoffService.closeOnly()` 신규 메서드 추가
    - 마감 후 매입 집계 페이지로 이동 안내
  - **Stage 2: 매입 집계** (`/orders/daily-food-aggregation`)
    - 공급사별 일일식품 집계 표시
    - 일괄 생성 버튼: 모든 공급사에 대해 PO 생성
    - 개별 생성 버튼: 공급사별 PO 개별 생성
    - PO 생성 후 자동으로 매입 발주 페이지로 이동
  - **Stage 3: 매입 발주** (`/orders/daily-food-purchase-order-list`)
    - 오늘 생성된 일일식품 PO 목록 표시
    - 일괄 SMS 발송: 모든 'placed' PO에 SMS 발송 + 'confirmed'로 상태 변경
    - 개별 SMS 발송: PO별 SMS 발송 + 'confirmed'로 상태 변경
- **서비스 레이어 개선**:
  - `dailyCutoffService.closeOnly()`: cutoff status만 변경, PO 생성 없음
  - `dailyFoodPurchaseOrderService.createBatchFromAggregation()`: 일괄 PO 생성
  - `dailyFoodPurchaseOrderService.createFromAggregation()`: 개별 PO 생성
  - `dailyFoodPurchaseOrderService.getTodayOrders()`: 오늘 일일식품 PO 조회
  - `dailyFoodPurchaseOrderService.sendBatchSms()`: 일괄 SMS 발송
- **페이지 신규 추가**:
  - `DailyFoodAggregationPage.tsx`: 일일식품 매입 집계 페이지
  - `DailyFoodPurchaseOrderListPage.tsx`: 일일식품 매입 발주 페이지
- **기존 페이지 수정**:
  - `DailyFoodOrderPage.tsx`: 마감 버튼 기능 변경 (PO 생성 제거)
- **라우팅 업데이트**:
  - `/orders/daily-food-aggregation`: 매입 집계 페이지
  - `/orders/daily-food-purchase-order-list`: 매입 발주 페이지
- **Sidebar 메뉴 업데이트**:
  - "일일식품 발주" → "일일식품 매입발주" (3개 서브 메뉴)

### v0.9.8 (2025-10-19)
- **전역 상태 관리 시스템 도입**:
  - SaleOrderContext 구현으로 매출주문 데이터 전역 관리
  - React Context API 활용하여 컴포넌트 간 효율적인 데이터 공유
  - 단일 Firestore 쿼리로 모든 페이지가 데이터 공유 (중복 쿼리 제거)
  - Firestore 실시간 리스너로 자동 동기화 및 데이터 일관성 보장
- **아키텍처 개선**:
  - SaleOrderManagementPage: SaleOrderContext 사용으로 전환
  - CustomerOrderListPage: SaleOrderContext 사용으로 전환
  - DailyFoodOrderPage: SaleOrderContext 사용으로 전환
  - 성능 최적화: 통계 데이터 중복 계산 방지
- **용어 통일**:
  - 라우터 경로 변경: daily-fresh → daily-food
  - 코드 전반에 걸쳐 "daily-food" 용어로 통일
  - JSDoc 주석 업데이트 (daily fresh product → daily food product)
- **메뉴 구조 개편**:
  - 하이브리드 메뉴 패턴 적용 (메인 메뉴 + 서브 메뉴)
  - 메인 메뉴명 변경: "매출주문 접수" → "매출주문 접수관리"
  - 서브 메뉴 추가: "접수 현황", "주문 목록", "상품 집계"
  - 페이지명 통일: CustomerOrderListPage → SaleOrderListPage
  - 라우트 경로 변경: /orders/customer-orders → /orders/sale-orders
  - 페이지 제목 변경: "매출주문 접수" → "매출주문 접수 현황"
  - UI 개선: 상세보기 버튼을 심플한 텍스트 스타일로 변경 ("상세보기 →")
- **문서 업데이트**:
  - 섹션 2.3: contexts/ 디렉토리 추가
  - 섹션 2.4 신규 추가: "전역 상태 관리" (SaleOrderContext 상세 문서)
  - 섹션 8.2.3, 8.2.4, 8.2.5: 메뉴 연결 정보 추가, 데이터 소스를 SaleOrderContext로 업데이트
  - 섹션 9.1, 9.2: 메뉴 구조 업데이트 (하이브리드 패턴 반영)
  - 부록 C: Contexts 섹션 추가 (useSaleOrderContext 훅 문서화)

### v0.9.7 (2025-10-19)
- **일일식품 주문 타입 시스템 개선**:
  - 주문 타입 필드 변경: `aggregation` → `dailyFoodOrderType`
  - 타입 값 변경: `regular` / `additional` / `none` (일일식품 미포함 시)
  - **불변성 원칙**: 주문 생성 시점에 타입 확정, 이후 절대 변경 불가
  - 시간 기반 재계산 제거 → 필드 기반 쿼리로 전환 (데이터 무결성 보장)
  - cutoff 컬렉션 사용 (단일 문서 'current' 관리)
  - status: 'open' (접수 중) / 'closed' (마감됨)
- **주요 변경사항**:
  - **Shop 앱**: saleOrderService에서 주문 생성 시 dailyFoodOrderType 설정
  - **Admin 앱**: 모든 페이지에서 필드 기반 쿼리 적용
  - orderAggregationService: 시간 기반 필터링 제거
  - DailyFoodOrderPage, DailyFoodOrderListPage, DailyFoodPurchaseOrderPage: 필드 기반 쿼리
- **비즈니스 규칙**:
  - 마감 시간(closedAt)은 관리자가 수동 설정 (자동 15:00 아님)
  - 마감 후에도 추가 주문 가능 (dailyFoodOrderType='additional')
  - 마감 전 주문(regular)은 마감 후 삭제 불가
  - 마감 기간은 유연하게 설정 (공휴일 대응 가능)

### v0.9.6 (2025-10-18)
- **신선식품 집계 시스템 재설계**:
  - 용어 변경: 일일식품 → 신선식품 (Fresh Food)
  - freshFoodStatus 컬렉션 신규 생성 (단일 문서 `current` 관리)
  - SO.orderType 필드 제거 (createdBy로 충분)
  - SO.orderPhase → SO.aggregation으로 변경
  - 매출주문 단순화: 모든 SO는 `placed`로 시작
  - 신선식품 집계 기간 기반 aggregation 자동 설정
  - SO 삭제 규칙 추가 (집계 완료 후 `aggregation='regular'` SO 삭제 불가)
- **페이지 개편**:
  - 일일주문 확정 → 신선식품 확정 페이지
  - 경로: `/orders/management` → `/orders/fresh-food-confirmation`
  - 2-Panel UI 구조로 단순화
  - 토글 버튼 방식: 집계 시작 ↔ 집계 마감
- **실시간 집계**:
  - 모든 SO 실시간 집계/조회
  - 카테고리별 집계
  - 현재고 비교 기능
- **데이터 모델**:
  - freshFoodStatus 타입 추가
  - SaleOrder 타입에서 orderType, orderPhase 제거, aggregation 추가
  - PurchaseOrder 타입에서 confirmationStatus 제거
- **서비스 레이어**:
  - `freshFoodStatusService.ts` 신규 (start, close, getStatus, initialize)
  - `dailyOrderCycleService.ts`, `dailySaleOrderFlowService.ts` 제거 예정
  - saleOrderService에 SO 생성/삭제 규칙 로직 추가

### v0.9.1 (2025-10-15)
- **사용자 역할 추가**: supplier role 추가
- **담당자 관리 개선**:
  - 고객사/공급사 담당자를 users 컬렉션과 연동 (userId 기반)
  - ContactInfo 인터페이스에 userId 필드 추가
  - 양방향 연결: users.linkedCustomers/linkedSuppliers ↔ company.primaryContact/secondaryContact
- **서비스 레이어 확장**:
  - contactService.ts 추가 (담당자 연결 공통 로직)
  - userService에 supplier 연결 함수 추가
- **UI 개선**:
  - UserLinkModal에 role 필터링 추가
  - 고객사/공급사 담당자 UI를 컴팩트 카드 레이아웃으로 변경
  - 담당자 자동 승격 로직 구현 (담당자1 제거 시 담당자2 → 담당자1)
- **로그인 제한**: supplier role은 Admin 앱 로그인 차단

### v0.9.0 (2025-10-12)
- 초기 버전
