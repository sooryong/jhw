# JHW 플랫폼 관리 시스템 명세서

**버전**: v0.9.1
**작성일**: 2025-10-12
**최종 업데이트**: 2025-10-15
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
- **실시간 주문 관리**: 일일식품 확정 프로세스 자동화
- **시간 기반 주문 분류**: 확정 전/후 주문 자동 구분 (regular/additional)
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
  orderType: 'customer' | 'staff_proxy';     // 주문 출처
  orderPhase: 'regular' | 'additional';      // 주문 단계

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

  category: string;                          // 카테고리 (일일식품/냉동식품/공산품)
  confirmationStatus: 'regular' | 'additional';  // 확정 상태

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

#### 5.1.9 dailyOrderCycles (일일주문 사이클)
**문서 ID**: `YYMMDD` (날짜 기반)

```typescript
interface DailyOrderCycle {
  cycleDate: string;                         // YYMMDD

  // 상태
  isConfirmed: boolean;                      // 일일식품 확정 여부
  confirmedAt?: Timestamp;                   // 확정 시간
  confirmedBy?: string;                      // 확정자

  // 통계
  stats: {
    totalSaleOrders: number;                 // 총 매출주문 수
    totalPurchaseOrders: number;             // 총 매입주문 수
    totalAmount: number;                     // 총 주문 금액
  };

  createdAt: Timestamp;                      // 생성일시
  updatedAt: Timestamp;                      // 수정일시
}
```

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

### 7.1 일일주문 관리 프로세스

#### 7.1.1 주문 접수
1. **고객사 주문**: Shop 앱에서 직접 주문
   - `orderType: 'customer'`
   - `orderPhase`: 확정 전이면 'regular', 확정 후면 'additional'

2. **직원 대리 주문**: Admin 앱 대리 쇼핑 메뉴
   - `orderType: 'staff_proxy'`
   - `orderPhase`: 현재 확정 상태에 따라 자동 결정

#### 7.1.2 일일식품 확정
**경로**: 일일주문 확정 페이지 (`/orders/management`)

**처리 내용**:
1. 당일 `regular` 단계의 모든 `placed` 매출주문을 `confirmed` 상태로 변경
2. 공급사별/카테고리별로 주문 집계 (orderAggregations 생성)
3. 집계 결과를 바탕으로 매입주문 생성 (purchaseOrders)
4. 공급사에 발주서 SMS 발송
5. `dailyOrderCycles` 문서의 `isConfirmed` 플래그를 `true`로 설정

**확정 후**:
- 이후 접수되는 주문은 자동으로 `orderPhase: 'additional'`로 생성
- `additional` 주문은 즉시 `confirmed` 상태로 생성 (별도 확정 불필요)

#### 7.1.3 주문 상태 흐름
```
[Regular 주문 (일일식품 확정 전)]
placed → confirmed (일일확정 시) → completed (출하 완료 시)
                 ↘ pended (보류)
                 ↘ rejected (거부)
                 ↘ cancelled (취소)

[Additional 주문 (일일식품 확정 후)]
confirmed (생성 즉시) → completed (출하 완료 시)
                     ↘ cancelled (취소)
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

#### 8.2.1 일일주문 확정 페이지 (`/orders/management`)
**권한**: admin만 접근 가능

**UI 구성**: 4-Panel 시간 기반 워크플로우

**Panel 1: 매출주문 (placed)**
- 당일 접수된 미확정 주문 목록
- 필터: regular/additional, 고객사, 금액
- 액션: 확정, 보류, 거부
- 총계: 주문 수, 총 금액

**Panel 2: 주문 집계**
- 공급사별/카테고리별 집계 결과
- 상품별 수량 합산
- SMS 발송 대상 확인

**Panel 3: 매입주문 (생성)**
- 집계 결과 기반 매입주문 생성
- 공급사별 발주서 미리보기
- SMS 발송 상태 확인

**Panel 4: 확정 완료**
- 확정된 매출주문 목록
- 연결된 매입주문 확인
- 통계 요약

**일일식품 확정 버튼**:
- Panel 1의 모든 regular 주문을 confirmed로 변경
- Panel 2-3 자동 실행
- SMS 자동 발송
- dailyOrderCycles 업데이트

#### 8.2.2 일일주문 입고 페이지 (`/orders/inbound`)
**권한**: admin, staff 접근 가능

**기능**:
- 매입주문 목록 (status: 'confirmed')
- 입고 수량 입력
- 로트 생성 및 재고 반영
- 매입원장 자동 생성
- 입고 완료 처리

#### 8.2.3 고객사별 주문 조회 (`/orders/customer-orders`)
**기능**:
- 고객사 선택
- 기간별 주문 내역
- 주문 상세 보기
- 엑셀 내보내기

#### 8.2.4 상품별 집계 (`/orders/product-aggregation`)
**기능**:
- 일자 선택
- 상품별 주문 수량 집계
- 공급사별 그룹핑
- 인쇄 기능

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
├── 일일주문 확정
├── 일일주문 입고
├── 일일주문 출하 (미구현)
├── 원장 관리
│   ├── 매입 원장
│   └── 매출 원장 (미구현)
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
├── 일일주문 입고
├── 일일주문 출하 (미구현)
└── 원장 관리
    └── 매입 원장
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
- `dailyOrderCycle.ts`: 일일주문 사이클 타입
- `phoneNumber.ts`: 번호 정규화 타입
- `sms.ts`: SMS 관련 타입

### B. 주요 서비스 함수
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
- `dailyOrderCycleService.ts`: 일일주문 사이클
- `dailySaleOrderFlowService.ts`: 일일주문 확정 워크플로우
- `smsService.ts`: SMS 발송

### C. 참고 문서
- Firebase 공식 문서: https://firebase.google.com/docs
- React 공식 문서: https://react.dev
- Material-UI 문서: https://mui.com
- TypeScript 문서: https://www.typescriptlang.org/docs

---

**문서 버전**: v0.9.1
**마지막 업데이트**: 2025-10-15
**작성자**: Claude Code
**연락처**: 진현유통 관리자

## 변경 이력

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
