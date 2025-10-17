# 공급사 담당자 구조 개선 작업 계획서

**작성일**: 2025-10-14
**상태**: 계획 수립 완료, 실행 대기
**담당**: Claude Code

---

## 📋 목차
1. [배경 및 문제점](#배경-및-문제점)
2. [목표](#목표)
3. [설계안: 통합 Contact 구조](#설계안-통합-contact-구조)
4. [작업 단계](#작업-단계)
5. [수정 파일 목록](#수정-파일-목록)
6. [마이그레이션 계획](#마이그레이션-계획)
7. [테스트 계획](#테스트-계획)

---

## 배경 및 문제점

### 현재 상황
- **고객사(Customer)**: 담당자를 `users` 컬렉션에 사용자로 등록 → 쇼핑몰 로그인 가능
- **공급사(Supplier)**: 담당자를 사용자로 등록하지 않고, 매입주문서 SMS 수신자로만 사용해야 함

### 문제점
현재 `supplierService.ts`의 `processOrderContacts()` 메서드가 고객사와 **동일한 로직**을 사용:
- ❌ 공급사 담당자도 `createCustomerUser()` 호출하여 users 컬렉션에 등록
- ❌ 공급사 담당자도 Firebase Authentication 계정 생성
- ❌ 공급사 담당자도 linkedCustomers 배열에 추가
- ❌ 결과: 공급사 담당자가 쇼핑몰에 로그인 가능 (잘못된 동작)

### 코드 증거
```typescript
// supplierService.ts Line 62
const result = await createCustomerUser(
  { name: orderContacts.primary.name, mobile: primaryMobile },
  [businessNumber]
);
```

---

## 목표

### 주요 목표
1. ✅ **고객사**: 담당자를 users 컬렉션에 등록 (현재 동작 유지)
2. ✅ **공급사**: 담당자를 users 컬렉션에 등록하지 않음 (SMS 수신만)
3. ✅ **미래 확장성**: 공급사도 나중에 로그인 기능 추가 가능하도록 유연한 구조

### 설계 원칙
- 고객사와 공급사의 필드 구조를 최대한 동일하게 유지
- `userId` 필드의 유무로 users 등록 여부 판단
- 타입 안정성 확보

---

## 설계안: 통합 Contact 구조

### 핵심 아이디어
담당자 정보를 **"userId 유무"로 사용자 등록 여부를 판단**하는 유연한 구조:

```typescript
interface ContactInfo {
  userId?: string;              // Optional: users 등록 시에만 존재
  name: string;                 // Required: 담당자 이름
  mobile: NormalizedMobile;     // Required: 담당자 휴대폰
  email?: string;               // Optional: 이메일 (향후 확장)
  position?: string;            // Optional: 직책 (향후 확장)
}
```

### 완전한 타입 정의

```typescript
// /admin/src/types/company.ts

// 담당자 정보 구조 (고객사/공급사 공통)
export interface ContactInfo {
  userId?: string;              // Optional: users 컬렉션 문서 ID
  name: string;                 // Required: 담당자 이름
  mobile: NormalizedMobile;     // Required: 담당자 휴대폰
  email?: string;               // Optional: 이메일
  position?: string;            // Optional: 직책
}

// 기본 회사 정보 (공통) - 저장용
export interface BaseCompany {
  businessNumber: NormalizedBusinessNumber;
  businessName: string;
  president: string;
  businessAddress: string;
  businessType?: string;
  businessItem?: string;

  // 회사 연락처
  presidentMobile?: NormalizedMobile;
  businessPhone?: NormalizedPhone;
  businessEmail?: string;

  // ✨ 통합 담당자 구조
  primaryContact: ContactInfo;      // 주 담당자 (필수)
  secondaryContact?: ContactInfo;   // 부 담당자 (선택)

  // 메타데이터
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 고객사
export interface Customer extends BaseCompany {
  // primaryContact.userId는 항상 존재 (필수)
  customerType: string;
  discountRate: number;
  currentBalance: number;
  specialPrices: SpecialPrice[];
  favoriteProducts: FavoriteProduct[];
}

// 공급사
export interface Supplier extends BaseCompany {
  // primaryContact.userId는 undefined (현재)
  // 미래에는 userId가 있을 수 있음
  supplierType?: string;
}
```

### 데이터 구조 예시

#### 고객사 문서
```json
{
  "businessNumber": "123-45-67890",
  "businessName": "ABC 마트",
  "primaryContact": {
    "userId": "01012345678",
    "name": "홍길동",
    "mobile": "01012345678"
  },
  "secondaryContact": {
    "userId": "01087654321",
    "name": "김철수",
    "mobile": "01087654321"
  }
}
```

#### 공급사 문서 (현재)
```json
{
  "businessNumber": "987-65-43210",
  "businessName": "XYZ 도매",
  "primaryContact": {
    "name": "이영희",
    "mobile": "01055556666"
  },
  "secondaryContact": {
    "name": "박민수",
    "mobile": "01077778888"
  }
}
```

---

## 작업 단계

### Phase 1: 타입 정의 수정
- [ ] `/admin/src/types/company.ts` 수정
  - [ ] `ContactInfo` 인터페이스 추가
  - [ ] `BaseCompany` 인터페이스에서 `primaryUserId`, `secondaryUserId` 제거
  - [ ] `BaseCompany`에 `primaryContact`, `secondaryContact` 추가
  - [ ] `Customer`, `Supplier` 인터페이스 상속 구조 유지
  - [ ] 폼 데이터 타입도 동일하게 수정

### Phase 2: 서비스 로직 수정

#### 2-1. 공통 유틸리티 함수 작성
- [ ] `/admin/src/services/contactService.ts` 신규 생성
  ```typescript
  /**
   * 담당자 처리 (userId 유무에 따라 users 등록 여부 결정)
   */
  export async function processContact(
    contactData: { name: string; mobile: string },
    businessNumber: string,
    createUser: boolean
  ): Promise<ContactInfo>
  ```

#### 2-2. customerService.ts 수정
- [ ] `processOrderContacts()` 제거
- [ ] `createCustomer()` → `processContact(..., true)` 사용
- [ ] `updateCustomer()` → 담당자 변경 시 old userId 처리 로직 수정
- [ ] 기존 `removeCustomerFromUser()` 로직 유지

#### 2-3. supplierService.ts 수정
- [ ] `processOrderContacts()` 제거
- [ ] `createSupplier()` → `processContact(..., false)` 사용
- [ ] `updateSupplier()` → 단순 contact 정보 업데이트만

### Phase 3: UI 컴포넌트 수정

#### 3-1. 고객사 페이지 (변경 최소화)
- [ ] `/admin/src/pages/customer/CustomerAddPage.tsx`
  - [ ] formData 구조 변경: `orderContacts` → `primaryContact`, `secondaryContact`
  - [ ] 사용자 조회 기능 유지 (현재 구현된 대로)

- [ ] `/admin/src/pages/customer/CustomerDetailPage.tsx`
  - [ ] formData 구조 변경
  - [ ] 사용자 조회 기능 유지

#### 3-2. 공급사 페이지 (대폭 수정)
- [ ] `/admin/src/pages/supplier/SupplierAddPage.tsx`
  - [ ] **사용자 조회 기능 제거** (방금 추가한 기능 롤백)
  - [ ] 단순 입력 필드로 변경 (2칸 레이아웃: 휴대폰 | 이름)
  - [ ] 안내 문구 변경: "주문 권한 + SMS 수신" → "매입주문서 SMS 수신자"

- [ ] `/admin/src/pages/supplier/SupplierDetailPage.tsx`
  - [ ] **사용자 조회 기능 제거**
  - [ ] 단순 입력 필드로 변경
  - [ ] 안내 문구 변경

#### 3-3. 공통 컴포넌트 (선택사항)
- [ ] `/admin/src/components/contact/ContactFormFields.tsx` 신규 생성
  - [ ] `enableUserLookup` prop으로 조회 기능 on/off
  - [ ] 고객사/공급사에서 재사용 가능

### Phase 4: 유효성 검증 수정
- [ ] `/admin/src/utils/companyValidation.ts`
  - [ ] `validateCustomerForm()` 수정: `primaryContact`, `secondaryContact` 검증
  - [ ] `validateSupplierForm()` 수정: 동일하게 contact 검증

---

## 수정 파일 목록

### 타입 정의
- [x] `/admin/src/types/company.ts` - **핵심 변경**

### 서비스 레이어
- [ ] `/admin/src/services/contactService.ts` - **신규 생성**
- [ ] `/admin/src/services/customerService.ts` - **대폭 수정**
- [ ] `/admin/src/services/supplierService.ts` - **대폭 수정**

### UI 컴포넌트
- [ ] `/admin/src/pages/customer/CustomerAddPage.tsx` - 소폭 수정
- [ ] `/admin/src/pages/customer/CustomerDetailPage.tsx` - 소폭 수정
- [ ] `/admin/src/pages/supplier/SupplierAddPage.tsx` - **대폭 수정** (조회 기능 제거)
- [ ] `/admin/src/pages/supplier/SupplierDetailPage.tsx` - **대폭 수정** (조회 기능 제거)

### 유틸리티
- [ ] `/admin/src/utils/companyValidation.ts` - 중간 수정

### 문서
- [ ] 이 계획서 자체

---

## 마이그레이션 계획

### 기존 데이터 변환 스크립트 필요

#### 고객사 마이그레이션
```typescript
// 기존 구조
{
  primaryUserId: "01012345678",
  secondaryUserId: "01087654321"
}

// 신규 구조
{
  primaryContact: {
    userId: "01012345678",
    name: "홍길동",        // users에서 조회
    mobile: "01012345678"  // users에서 조회
  },
  secondaryContact: {
    userId: "01087654321",
    name: "김철수",
    mobile: "01087654321"
  }
}
```

#### 공급사 마이그레이션
```typescript
// 기존 구조 (잘못됨)
{
  primaryUserId: "01055556666",
  secondaryUserId: "01077778888"
}

// 신규 구조
{
  primaryContact: {
    // userId 없음
    name: "이영희",        // users에서 조회
    mobile: "01055556666"  // users에서 조회
  },
  secondaryContact: {
    name: "박민수",
    mobile: "01077778888"
  }
}
```

#### 마이그레이션 스크립트
- [ ] `/admin/scripts/migrate-contacts.ts` 작성
  - [ ] 고객사 customers 컬렉션 변환
  - [ ] 공급사 suppliers 컬렉션 변환
  - [ ] Dry-run 모드 지원
  - [ ] 변환 결과 로그 저장

---

## 테스트 계획

### 단위 테스트
- [ ] `processContact()` 함수 테스트
  - [ ] createUser=true 시 userId 생성 확인
  - [ ] createUser=false 시 userId 없음 확인
  - [ ] 기존 사용자 발견 시 연결 확인

### 통합 테스트
- [ ] 고객사 생성/수정/삭제 테스트
- [ ] 공급사 생성/수정/삭제 테스트
- [ ] 담당자 변경 시나리오 테스트

### 수동 테스트 시나리오
1. **고객사 신규 등록**
   - [ ] 신규 담당자 등록 → users 생성 확인
   - [ ] 기존 담당자 등록 → linkedCustomers 추가 확인
   - [ ] 쇼핑몰 로그인 가능 확인

2. **공급사 신규 등록**
   - [ ] 담당자 등록 → users 생성 안 됨 확인
   - [ ] contact 정보만 저장 확인
   - [ ] 쇼핑몰 로그인 불가 확인

3. **고객사 담당자 변경**
   - [ ] 기존 담당자에서 linkedCustomers 제거 확인
   - [ ] 새 담당자에 linkedCustomers 추가 확인

4. **공급사 담당자 변경**
   - [ ] contact 정보만 업데이트 확인
   - [ ] users 컬렉션 영향 없음 확인

---

## 주의사항

### Breaking Changes
이 작업은 **Breaking Change**입니다:
- 기존 데이터 구조가 완전히 변경됨
- 마이그레이션 스크립트 실행 필수
- 롤백 계획 필요

### 롤백 계획
1. Git 브랜치 생성하여 작업
2. 마이그레이션 전 DB 백업
3. 문제 발생 시 이전 코드로 복구 + DB 복원

### 배포 순서
1. **개발 환경**: 코드 수정 + 테스트
2. **스테이징**: 마이그레이션 스크립트 테스트
3. **프로덕션**:
   - DB 백업
   - 서비스 점검 모드
   - 마이그레이션 실행
   - 코드 배포
   - 검증 후 서비스 재개

---

## 작업 재개 시 체크리스트

다음 작업 시작 시 아래 순서대로 진행:

1. [ ] 이 문서 다시 읽기
2. [ ] Git 브랜치 생성: `git checkout -b refactor/supplier-contact-structure`
3. [ ] Phase 1 시작: 타입 정의 수정
4. [ ] 각 Phase별 체크리스트 완료 확인
5. [ ] 테스트 실행
6. [ ] Pull Request 생성

---

## 참고 자료

### 현재 파일 위치
- 타입: `/home/soo/jhw/admin/src/types/company.ts`
- 서비스: `/home/soo/jhw/admin/src/services/`
- 페이지: `/home/soo/jhw/admin/src/pages/`

### 관련 이슈
- 고객사 담당자: 사용자 조회 기능 구현 완료 (2025-10-14)
- 공급사 담당자: 사용자 조회 기능 구현 완료 (2025-10-14) → **제거 예정**

---

**작업 종료일**: TBD
**검토자**: TBD
