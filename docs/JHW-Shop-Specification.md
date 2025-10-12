# JHW 쇼핑몰 시스템 명세서

**버전**: v2.1
**작성일**: 2025-10-12
**프로젝트명**: JHW Shop System
**Firebase 프로젝트**: jinhyun-wholesale
**배포 URL**: https://jinhyun-shop.web.app

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처](#2-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [사용자 및 권한](#4-사용자-및-권한)
5. [주요 기능](#5-주요-기능)
6. [페이지별 상세 기능](#6-페이지별-상세-기능)
7. [주문 프로세스](#7-주문-프로세스)
8. [상태 관리](#8-상태-관리)
9. [배포 및 운영](#9-배포-및-운영)

---

## 1. 시스템 개요

### 1.1 목적
JHW 쇼핑몰은 진현유통의 고객사가 상품을 주문할 수 있는 모바일 중심의 B2B 주문 시스템입니다. 직관적인 UI와 빠른 주문 프로세스로 일일 식품 주문을 간편하게 처리합니다.

### 1.2 주요 특징
- **모바일 우선 설계**: 스마트폰에 최적화된 UI/UX
- **고객사 전용**: customer 역할 사용자만 접근
- **빠른 주문**: 즐겨찾기, 장바구니, 원터치 주문
- **실시간 재고**: 상품 재고 실시간 확인
- **주문 내역**: 진행 중/완료 주문 조회
- **대리 주문 지원**: Admin 시스템에서 새 창으로 오픈
- **독립 세션**: Admin 앱과 독립된 인증 세션

### 1.3 사용 시나리오

#### 시나리오 1: 고객사 직접 주문
1. 고객사 담당자가 https://jinhyun-shop.web.app 접속
2. 휴대폰번호 + 비밀번호 로그인
3. 연결된 고객사 선택 (여러 고객사 담당 가능)
4. 상품 검색/즐겨찾기에서 상품 선택
5. 장바구니에 담기
6. 주문하기
7. 주문 내역 확인

#### 시나리오 2: 직원 대리 주문
1. Admin 시스템에서 "대리 쇼핑" 메뉴 선택
2. 고객사 선택
3. Shop 앱이 새 창으로 오픈 (URL 파라미터로 고객사 정보 전달)
4. 직원이 고객사를 대신해서 주문
5. `orderType: 'staff_proxy'`로 저장

---

## 2. 아키텍처

### 2.1 시스템 구성
```
┌───────────────────────────────────────────────────────────┐
│                   JHW Shop System v2.1                     │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────┐          │
│  │         Mobile-First Web Application        │          │
│  │            (localhost:5174)                 │          │
│  │                                             │          │
│  │  ┌─────────────────────────────────────┐   │          │
│  │  │      React Components               │   │          │
│  │  │  • ProductList                      │   │          │
│  │  │  • Cart                             │   │          │
│  │  │  • OrderHistory                     │   │          │
│  │  │  • ProductDetail                    │   │          │
│  │  └─────────────────────────────────────┘   │          │
│  │                                             │          │
│  │  ┌─────────────────────────────────────┐   │          │
│  │  │      Context API (State)            │   │          │
│  │  │  • CartContext                      │   │          │
│  │  │  • CustomerContext                  │   │          │
│  │  └─────────────────────────────────────┘   │          │
│  │                                             │          │
│  └────────────────────────────────────────────┘          │
│                       │                                    │
│                       ▼                                    │
│         ┌──────────────────────────────┐                  │
│         │    Firebase Services         │                  │
│         ├──────────────────────────────┤                  │
│         │  • Authentication            │                  │
│         │  • Firestore                 │                  │
│         │    - customers               │                  │
│         │    - products                │                  │
│         │    - saleOrders              │                  │
│         │    - dailyOrderCycles        │                  │
│         │  • Cloud Functions           │                  │
│         │  • Hosting                   │                  │
│         └──────────────────────────────┘                  │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Admin 앱과의 통합
```
┌─────────────────┐                    ┌─────────────────┐
│  Admin System   │                    │  Shop System    │
│                 │                    │                 │
│  대리 쇼핑 메뉴  │  window.open +    │  고객사 자동    │
│  고객사 선택    │  ──────────────>   │  선택 및 로그인 │
│                 │  URL 파라미터      │                 │
└─────────────────┘                    └─────────────────┘
       │                                       │
       └───────────────┬───────────────────────┘
                       │
                       ▼
              Shared Firestore
           (독립된 인증 세션 유지)
```

### 2.3 디렉토리 구조
```
/home/soo/jhw/shop/
├── src/
│   ├── components/          # 공통 컴포넌트
│   ├── pages/               # 페이지 컴포넌트 (7개)
│   │   ├── auth/            # 인증 페이지
│   │   │   └── LoginPage.tsx
│   │   └── shop/            # 쇼핑 페이지
│   │       ├── CustomerSelectionPage.tsx
│   │       ├── MobileProductList.tsx
│   │       ├── ProductDetailPage.tsx
│   │       ├── CartPage.tsx
│   │       ├── OrderHistoryPage.tsx
│   │       ├── OrderDetailPage.tsx
│   │       ├── ChangePasswordPage.tsx
│   │       └── FavoriteEditPage.tsx
│   ├── contexts/            # React Context
│   │   ├── CartContext.tsx
│   │   └── CustomerContext.tsx
│   ├── services/            # Firebase 서비스
│   │   ├── customerService.ts
│   │   ├── productService.ts
│   │   ├── saleOrderService.ts
│   │   └── userService.ts
│   ├── types/               # TypeScript 타입
│   ├── hooks/               # Custom Hooks
│   ├── utils/               # 유틸리티
│   ├── config/              # Firebase 설정
│   └── assets/              # 정적 리소스
├── package.json
└── vite.config.ts
```

---

## 3. 기술 스택

### 3.1 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.1.1 | UI 라이브러리 |
| TypeScript | 5.9.3 | 타입 안전성 |
| Material-UI (MUI) | 7.3.4 | UI 컴포넌트 |
| React Router | 7.9.4 | 라우팅 |
| Vite | 7.1.9 | 빌드 도구 |
| date-fns | 4.1.0 | 날짜 처리 |

### 3.2 상태 관리
- **Context API**: 전역 상태 관리
  - `CartContext`: 장바구니 상태
  - `CustomerContext`: 선택된 고객사 정보

### 3.3 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Firebase | 12.4.0 | BaaS 플랫폼 |
| Firestore | Native | 데이터베이스 |
| Firebase Auth | - | 인증 |

### 3.4 스타일링
- Material-UI `sx` prop
- 반응형 디자인 (Mobile-first)
- Custom 색상: primary.main (emerald-600)

---

## 4. 사용자 및 권한

### 4.1 사용자 유형
**역할**: customer

**권한**:
- 상품 조회
- 장바구니 관리
- 주문 생성
- 주문 내역 조회
- 비밀번호 변경

### 4.2 고객사 연결
- 한 명의 사용자(customer)는 여러 고객사에 연결 가능
- `linkedCustomers`: 배열로 사업자번호 저장
- 로그인 후 고객사 선택 화면 표시
- 선택된 고객사 정보는 `CustomerContext`에 저장

### 4.3 인증 방식
- **로그인 ID**: 휴대폰번호 (11자리 숫자)
- **비밀번호**: 초기 `password123!` (변경 필수)
- **세션**: Admin 앱과 독립된 Firebase Auth 인스턴스
- **자동 로그아웃**: 24시간 비활성 시

---

## 5. 주요 기능

### 5.1 상품 조회

#### 5.1.1 상품 목록
- **레이아웃**: 모바일 최적화 카드 뷰
- **정보 표시**:
  - 상품 이미지 (대표 이미지)
  - 상품명
  - 규격
  - 판매가 (고객사 유형별 차등 가격)
  - 재고 상태
- **필터링**:
  - 카테고리별 (대분류/소분류)
  - 검색 (상품명, 규격)
  - 재고 있는 상품만 보기
- **정렬**:
  - 최신순
  - 이름순
  - 가격순

#### 5.1.2 상품 상세
- 상품 이미지 갤러리 (최대 4개)
- 상세 정보
- 가격 정보 (할인율 표시)
- 재고 수량
- 수량 선택 (1-999)
- 장바구니 담기 버튼
- 바로 주문 버튼

#### 5.1.3 즐겨찾기
- 고객사별 즐겨찾기 상품 설정 (Admin에서 설정)
- 빠른 주문을 위한 전용 탭
- 원터치 장바구니 담기

### 5.2 장바구니

#### 5.2.1 장바구니 관리
- **추가**: 상품 상세에서 수량 선택 후 담기
- **수정**: 수량 변경 (+/- 버튼)
- **삭제**: 개별 삭제 또는 전체 삭제
- **유지**: Firestore에 저장 (24시간 자동 만료)
- **총계**: 총 금액 자동 계산

#### 5.2.2 장바구니 UI
```
┌─────────────────────────────────────┐
│  장바구니 (3)                       │
├─────────────────────────────────────┤
│  [이미지] 상품명 A                  │
│           규격: 1kg                 │
│           12,000원 x 5개 = 60,000원 │
│           [- 5 +] [삭제]            │
├─────────────────────────────────────┤
│  [이미지] 상품명 B                  │
│           규격: 500g                │
│           8,000원 x 3개 = 24,000원  │
│           [- 3 +] [삭제]            │
├─────────────────────────────────────┤
│  [이미지] 상품명 C                  │
│           규격: 2kg                 │
│           20,000원 x 2개 = 40,000원 │
│           [- 2 +] [삭제]            │
├─────────────────────────────────────┤
│                                     │
│  총 3품목                           │
│  총 주문금액: 124,000원             │
│                                     │
│  [전체 삭제]       [주문하기]       │
└─────────────────────────────────────┘
```

### 5.3 주문

#### 5.3.1 주문 생성
**처리 흐름**:
1. 장바구니에서 "주문하기" 버튼 클릭
2. 주문 확인 다이얼로그 표시
3. 확인 시 `saleOrders` 컬렉션에 문서 생성
4. 주문 번호 자동 생성 (SO-YYMMDD-001)
5. `orderType` 자동 설정:
   - 고객이 직접 주문: `'customer'`
   - 직원 대리 주문: `'staff_proxy'` (URL 파라미터로 판단)
6. `orderPhase` 자동 결정:
   - 일일식품 확정 전: `'regular'` → `status: 'placed'`
   - 일일식품 확정 후: `'additional'` → `status: 'confirmed'`
7. 장바구니 비우기
8. 주문 완료 메시지 표시
9. 주문 내역 페이지로 이동

#### 5.3.2 주문 시점 스냅샷
주문 생성 시 다음 정보를 스냅샷으로 저장:
- **고객사 정보**: 상호명, 사업자번호, 고객사 유형
- **상품 정보**: 상품명, 규격, 단가
- **주문 시점 가격**: 고객사 유형별 판매가 적용

### 5.4 주문 내역

#### 5.4.1 진행 중 주문
**표시 조건**: `status`가 `'placed'`, `'confirmed'`, `'pended'`인 주문

**표시 정보**:
- 주문번호
- 주문일시
- 주문 상태 (배지)
- 총 금액
- 품목 수
- 상세보기 버튼

**가능한 액션**:
- 주문 상세 보기
- 주문 취소 (placed 상태만)

#### 5.4.2 완료 주문
**표시 조건**: `status`가 `'completed'`, `'cancelled'`, `'rejected'`인 주문

**표시 정보**:
- 주문번호
- 주문일시
- 완료/취소/거부 일시
- 최종 상태
- 총 금액
- 품목 수

**가능한 액션**:
- 주문 상세 보기
- 재주문 (장바구니에 동일 상품 담기)

#### 5.4.3 주문 상세
**표시 정보**:
- 주문 기본 정보 (주문번호, 일시, 상태)
- 고객사 정보 (상호명, 고객사 유형)
- 주문 상품 목록 (상품명, 규격, 수량, 단가, 소계)
- 총 금액
- 주문 타임라인 (접수 → 확정 → 완료)

### 5.5 기타 기능

#### 5.5.1 비밀번호 변경
- 현재 비밀번호 확인
- 새 비밀번호 입력 (정책 검증)
- 변경 성공 시 재로그인

#### 5.5.2 즐겨찾기 편집
- 고객사별 즐겨찾기 상품 조회
- 표시 순서 변경 (Drag & Drop)
- 활성/비활성 토글
- Admin에서 관리하는 즐겨찾기 목록 반영

---

## 6. 페이지별 상세 기능

### 6.1 로그인 페이지 (`/login`)
**경로**: `/login`

**UI 구성**:
- JHW 로고
- 휴대폰번호 입력 (숫자만)
- 비밀번호 입력
- 로그인 버튼
- 오류 메시지 표시

**처리 로직**:
1. 입력 검증 (휴대폰번호 11자리, 비밀번호 8자 이상)
2. Firebase Auth 로그인 시도
3. 성공 시 `/shop/customer-selection`으로 이동
4. 실패 시 오류 메시지 표시

### 6.2 고객사 선택 페이지 (`/shop/customer-selection`)
**경로**: `/shop/customer-selection`

**권한**: customer 역할 사용자만

**UI 구성**:
- 사용자 이름 표시
- 연결된 고객사 목록 (카드 형태)
  - 상호명
  - 사업자번호
  - 고객사 유형
- 로그아웃 버튼

**처리 로직**:
1. 로그인한 사용자의 `linkedCustomers` 배열 조회
2. 각 사업자번호로 `customers` 컬렉션에서 고객사 정보 조회
3. 고객사 선택 시 `CustomerContext`에 저장
4. `/shop/products`로 이동

**대리 주문 모드**:
- URL에 `?customerId=xxx` 파라미터가 있으면 해당 고객사 자동 선택
- 선택 페이지 건너뛰고 바로 상품 목록으로 이동

### 6.3 상품 목록 페이지 (`/shop/products`)
**경로**: `/shop/products`

**UI 구성**:
```
┌─────────────────────────────────────┐
│  [로고] JHW 쇼핑몰      [메뉴] [로그아웃] │
├─────────────────────────────────────┤
│  고객사: ○○식품 (VIP고객)          │
├─────────────────────────────────────┤
│  [검색]                             │
├─────────────────────────────────────┤
│  [전체] [채소] [과일] [육류] [즐겨찾기] │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ [이미지]                      │  │
│  │ 상품명 A                      │  │
│  │ 규격: 1kg                     │  │
│  │ 12,000원 (10% 할인)           │  │
│  │ 재고: 50개                    │  │
│  │ [장바구니]                    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ [이미지]                      │  │
│  │ 상품명 B                      │  │
│  │ 규격: 500g                    │  │
│  │ 8,000원                       │  │
│  │ 재고: 30개                    │  │
│  │ [장바구니]                    │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  [홈] [주문내역] [장바구니(3)]      │
└─────────────────────────────────────┘
```

**기능**:
- 카테고리별 필터링
- 검색 (상품명, 규격)
- 즐겨찾기 탭
- 무한 스크롤 또는 페이지네이션
- 장바구니 버튼 클릭 시 수량 선택 다이얼로그
- 상품 카드 클릭 시 상세 페이지 이동

### 6.4 상품 상세 페이지 (`/shop/product/:productId`)
**경로**: `/shop/product/:productId`

**UI 구성**:
- 상품 이미지 갤러리 (슬라이더)
- 상품명, 규격
- 가격 (할인율 표시)
- 재고 수량
- 상품 설명
- 수량 선택 (1-999)
- 장바구니 담기 버튼
- 바로 주문 버튼

**기능**:
- 이미지 슬라이더 (좌우 스와이프)
- 수량 +/- 버튼
- 장바구니 담기: CartContext 업데이트 + Firestore 저장
- 바로 주문: 장바구니에 담고 즉시 주문 페이지 이동

### 6.5 장바구니 페이지 (`/shop/cart`)
**경로**: `/shop/cart`

**UI 구성**:
- 장바구니 상품 목록 (카드 형태)
  - 상품 이미지
  - 상품명, 규격
  - 단가 x 수량 = 소계
  - 수량 변경 버튼 (+/-)
  - 삭제 버튼
- 총 품목 수
- 총 주문 금액
- 전체 삭제 버튼
- 주문하기 버튼

**기능**:
- 수량 변경: CartContext + Firestore 실시간 업데이트
- 개별 삭제: 해당 상품만 제거
- 전체 삭제: 장바구니 비우기
- 주문하기: 주문 확인 → 주문 생성 → 완료

### 6.6 주문 내역 페이지 (`/shop/orders`)
**경로**: `/shop/orders`

**UI 구성**:
- 탭: [진행 중] [완료]
- 주문 목록 (카드 형태)
  - 주문번호
  - 주문일시
  - 주문 상태 배지 (색상 구분)
  - 총 금액
  - 품목 수
  - 상세보기 버튼
  - 취소 버튼 (placed만)

**기능**:
- 진행 중/완료 탭 전환
- 주문 상세 페이지 이동
- 주문 취소 (확인 다이얼로그)
- 재주문 (완료 주문만)

### 6.7 주문 상세 페이지 (`/shop/order/:orderId`)
**경로**: `/shop/order/:orderId`

**UI 구성**:
- 주문 기본 정보
  - 주문번호
  - 주문일시
  - 주문 상태 배지
- 고객사 정보
  - 상호명
  - 고객사 유형
- 주문 상품 목록
  - 상품명, 규격
  - 단가 x 수량 = 소계
- 총 금액
- 주문 타임라인
  - 접수 (placedAt)
  - 확정 (confirmedAt)
  - 완료 (completedAt)
- 액션 버튼
  - 주문 취소 (placed만)
  - 재주문 (completed만)

### 6.8 비밀번호 변경 페이지 (`/shop/change-password`)
**경로**: `/shop/change-password`

**UI 구성**:
- 현재 비밀번호 입력
- 새 비밀번호 입력
- 새 비밀번호 확인
- 변경하기 버튼

**기능**:
- 비밀번호 정책 검증
- `changeUserPassword` Cloud Function 호출
- 성공 시 로그아웃 → 재로그인

---

## 7. 주문 프로세스

### 7.1 주문 생성 프로세스

#### 7.1.1 일반 주문 (고객사 직접)
```
1. 고객사 로그인
   ↓
2. 고객사 선택
   ↓
3. 상품 검색/선택
   ↓
4. 장바구니 담기
   ↓
5. 수량 조정
   ↓
6. 주문하기 클릭
   ↓
7. 주문 확인 다이얼로그
   ↓
8. saleOrder 생성
   - orderType: 'customer'
   - orderPhase: 자동 결정 (regular/additional)
   - status: 자동 결정 (placed/confirmed)
   ↓
9. 장바구니 비우기
   ↓
10. 주문 완료 메시지
   ↓
11. 주문 내역 페이지 이동
```

#### 7.1.2 대리 주문 (직원)
```
1. Admin 앱에서 대리 쇼핑 메뉴 선택
   ↓
2. 고객사 선택
   ↓
3. Shop 앱 새 창 오픈
   URL: /shop/products?customerId=xxx&proxyMode=true
   ↓
4. 고객사 자동 선택 (선택 페이지 건너뛰기)
   ↓
5. 상품 선택 → 장바구니 → 주문 (동일)
   ↓
6. saleOrder 생성
   - orderType: 'staff_proxy'
   - createdBy: 로그인한 직원 UID
   ↓
7. 주문 완료
```

### 7.2 주문 단계 자동 결정

#### 7.2.1 일일식품 확정 전
```typescript
// dailyOrderCycles 조회
const cycle = await getDoc(doc(db, 'dailyOrderCycles', todayYYMMDD));

if (!cycle.exists() || !cycle.data().isConfirmed) {
  // 일일식품 확정 전
  orderPhase = 'regular';
  status = 'placed';  // 확정 대기
}
```

#### 7.2.2 일일식품 확정 후
```typescript
// dailyOrderCycles 조회
const cycle = await getDoc(doc(db, 'dailyOrderCycles', todayYYMMDD));

if (cycle.exists() && cycle.data().isConfirmed) {
  // 일일식품 확정 후
  orderPhase = 'additional';
  status = 'confirmed';  // 즉시 확정
}
```

### 7.3 주문 상태 변경

#### 7.3.1 Regular 주문 상태 흐름
```
placed (접수)
  ↓ (Admin에서 일일식품 확정)
confirmed (확정)
  ↓ (Admin에서 출하 완료)
completed (완료)

[예외 흐름]
placed → pended (보류)
placed → rejected (거부)
placed/confirmed → cancelled (취소)
```

#### 7.3.2 Additional 주문 상태 흐름
```
confirmed (생성 즉시 확정)
  ↓ (Admin에서 출하 완료)
completed (완료)

[예외 흐름]
confirmed → cancelled (취소)
```

### 7.4 주문 취소

**취소 가능 조건**:
- 주문 상태가 `'placed'` 또는 `'confirmed'`
- 고객사 본인 주문만 취소 가능

**취소 처리**:
1. 취소 확인 다이얼로그 표시
2. 확인 시 `saleOrderService.cancelOrder()` 호출
3. 주문 상태를 `'cancelled'`로 변경
4. `cancelledAt` 타임스탬프 기록
5. 재고 복구 (향후 구현)
6. 주문 내역 페이지로 이동

---

## 8. 상태 관리

### 8.1 CartContext

#### 8.1.1 상태
```typescript
interface CartContextValue {
  cartItems: CartItem[];         // 장바구니 상품 목록
  totalAmount: number;            // 총 금액
  itemCount: number;              // 품목 수
  loading: boolean;               // 로딩 상태
}
```

#### 8.1.2 액션
```typescript
interface CartActions {
  addToCart: (productId: string, quantity: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}
```

#### 8.1.3 Firestore 동기화
- 장바구니 변경 시 Firestore `carts` 컬렉션 업데이트
- 실시간 리스너로 다른 기기/탭과 동기화
- 24시간 후 자동 만료 (`expiresAt` 필드)

### 8.2 CustomerContext

#### 8.2.1 상태
```typescript
interface CustomerContextValue {
  selectedCustomer: Customer | null;  // 선택된 고객사
  loading: boolean;                   // 로딩 상태
}
```

#### 8.2.2 액션
```typescript
interface CustomerActions {
  selectCustomer: (customerId: string) => Promise<void>;
  clearCustomer: () => void;
}
```

#### 8.2.3 로컬 스토리지
- 선택된 고객사 ID를 로컬 스토리지에 저장
- 새로고침 시 자동 복원
- 로그아웃 시 삭제

---

## 9. 배포 및 운영

### 9.1 개발 환경
```bash
# Shop 앱 개발 서버 실행
cd /home/soo/jhw/shop
npm install
npm run dev
# http://localhost:5174
```

### 9.2 프로덕션 빌드
```bash
# Shop 앱 빌드
cd /home/soo/jhw/shop
npm run build
# 빌드 결과: shop/dist/
```

### 9.3 배포
```bash
# Firebase Hosting 배포
cd /home/soo/jhw
firebase deploy --only hosting:shop
```

**배포 URL**: https://jinhyun-shop.web.app

### 9.4 환경 변수
**파일**: `/shop/.env`

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

### 9.5 모바일 최적화

#### 9.5.1 반응형 디자인
- **Breakpoints**:
  - xs: 0-599px (모바일)
  - sm: 600-959px (태블릿)
  - md: 960px+ (데스크톱)
- **Mobile-First**: 모바일 화면 우선 설계
- **Touch-Friendly**: 버튼 크기 최소 44x44px

#### 9.5.2 성능 최적화
- **이미지 최적화**: WebP 포맷, 레이지 로딩
- **코드 스플리팅**: 페이지별 동적 임포트
- **캐싱**: Service Worker (향후 구현)
- **번들 크기**: 1.2MB (gzip: 345KB)

#### 9.5.3 PWA (향후 구현)
- Manifest.json
- Service Worker
- 오프라인 지원
- 홈 화면 추가

### 9.6 보안

#### 9.6.1 Firestore Rules
```javascript
// 고객사는 본인과 연결된 데이터만 조회
match /saleOrders/{orderId} {
  allow read: if request.auth.uid != null &&
    (request.auth.uid == resource.data.createdBy ||
     isAdmin() || isStaff());
  allow create: if request.auth.uid != null &&
    resource.data.createdBy == request.auth.uid;
  allow update, delete: if isAdmin() || isStaff();
}

// 장바구니는 본인만 접근
match /carts/{cartId} {
  allow read, write: if request.auth.uid == cartId;
}
```

#### 9.6.2 인증 보안
- 비밀번호 정책 강제
- 세션 타임아웃 (24시간)
- HTTPS 강제
- XSS/CSRF 방어

### 9.7 모니터링
- Firebase Console: 사용량, 오류, 성능
- Firestore 쿼리 통계
- 사용자 행동 분석 (향후 구현)

---

## 부록

### A. 주요 TypeScript 타입
Shop 앱은 Admin 앱과 동일한 타입 정의 사용:
- `/shop/src/types/product.ts`: 상품 타입
- `/shop/src/types/saleOrder.ts`: 주문 타입
- `/shop/src/types/company.ts`: 고객사 타입
- `/shop/src/types/user.ts`: 사용자 타입

### B. 주요 서비스 함수
- `productService.ts`: 상품 조회
- `saleOrderService.ts`: 주문 생성/조회/취소
- `customerService.ts`: 고객사 조회
- `userService.ts`: 사용자 관리

### C. UI 컴포넌트
- `ProductCard`: 상품 카드 컴포넌트
- `CartPanel`: 장바구니 패널
- `OrderCard`: 주문 카드
- `BottomNavigation`: 하단 네비게이션 바
- `ProductDetailPanel`: 상품 상세 패널

### D. 참고 문서
- Admin 시스템 명세서: `/docs/JHW-Platform-Admin-Specification.md`
- Firebase 공식 문서: https://firebase.google.com/docs
- React 공식 문서: https://react.dev
- Material-UI 문서: https://mui.com

---

**문서 버전**: v2.1
**마지막 업데이트**: 2025-10-12
**작성자**: Claude Code
**연락처**: 진현유통 관리자
