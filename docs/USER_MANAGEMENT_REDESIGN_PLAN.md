# 사용자 관리 로직 재설계 계획

## 📋 개요

**작성일**: 2025-10-15
**목적**: 사용자 생성/삭제를 시스템 설정에서만 가능하도록 변경하고, 고객사 페이지에서는 기존 사용자 연결/해제만 수행

## 🎯 변경 목표

### 현재 방식 (Before)
- ❌ 고객사 추가/수정 시 사용자 자동 생성
- ❌ 고객사 페이지에서 사용자 생성과 연결이 동시에 발생
- ❌ 사용자 삭제 로직 없음

### 새로운 방식 (After)
- ✅ **사용자 생성/삭제**: 시스템 설정 > 사용자 관리 메뉴에서만 가능
- ✅ **고객사 페이지**: 기존 사용자 검색 후 연결/해제만 가능
- ✅ **사용자 삭제**: 연결된 고객사가 없는 경우에만 허용
- ✅ **워크플로우**: 사용자 추가 → 고객사에서 연결

## 📐 아키텍처 변경

### 1. 데이터 흐름 변경

#### Before (자동 생성 방식)
```
고객사 추가 페이지
  ↓
담당자 정보 입력 (이름, 휴대폰)
  ↓
저장 버튼 클릭
  ↓
contactService.processContact(data, businessNumber, true)
  ↓
사용자 존재 여부 확인
  ├─ 없으면: createCustomerUser() 호출 → 새 사용자 생성
  └─ 있으면: addCustomerToUser() 호출 → 기존 사용자에 고객사 추가
  ↓
고객사 생성 완료
```

#### After (연결 전용 방식)
```
[Step 1] 시스템 설정 > 사용자 관리
  ↓
사용자 추가 버튼 클릭
  ↓
이름, 휴대폰 입력 → createCustomerUser(data, []) 호출
  ↓
사용자 생성 완료 (companies: [])

[Step 2] 고객사 추가 페이지
  ↓
담당자1 검색 (휴대폰번호로 검색)
  ↓
기존 사용자 목록 표시
  ↓
사용자 선택 → userId, name, mobile 가져옴
  ↓
저장 버튼 클릭
  ↓
linkContactToCustomer(userId, businessNumber) 호출
  ↓
고객사 생성 + 사용자의 companies 배열에 businessNumber 추가
```

### 2. 책임 분리

| 기능 | Before | After |
|------|--------|-------|
| **사용자 생성** | customerService, contactService | userService (시스템 설정에서만) |
| **사용자 삭제** | 없음 | userService (companies 배열 비어있을 때만) |
| **사용자-고객사 연결** | contactService (자동) | customerService (명시적 연결) |
| **사용자-고객사 해제** | customerService (cleanup) | customerService (명시적 해제) |

## 🔧 구현 단계

### Phase 1: Service Layer 수정

#### 1.1 contactService.ts 수정
**파일**: `/home/soo/jhw/admin/src/services/contactService.ts`

**변경 내용**:
```typescript
// BEFORE: processContact(contactData, businessNumber, createUser)
// - createUser=true일 때 사용자 자동 생성

// AFTER: linkContactToCustomer(userId, businessNumber)
// - 이미 존재하는 사용자만 연결
// - userId가 필수 파라미터

export async function linkContactToCustomer(
  userId: string,
  businessNumber: string
): Promise<ContactInfo> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  // 고객사를 사용자의 companies 배열에 추가
  await addCustomerToUser(userId, businessNumber);

  return {
    userId: user.uid,
    name: user.name,
    mobile: user.mobile,
    email: user.email
  };
}

export async function unlinkContactFromCustomer(
  userId: string,
  businessNumber: string
): Promise<void> {
  await removeCustomerFromUser(userId, businessNumber);
}

// processContact 함수는 공급사용으로만 사용 (createUser 파라미터 제거)
export async function processSupplierContact(
  contactData: { name: string; mobile: string; email?: string }
): Promise<ContactInfo> {
  const normalizedMobile = normalizeNumber(contactData.mobile);
  return {
    name: contactData.name,
    mobile: normalizedMobile,
    email: contactData.email
  };
}
```

#### 1.2 customerService.ts 수정
**파일**: `/home/soo/jhw/admin/src/services/customerService.ts`

**변경 내용**:
```typescript
// createCustomer 수정
export async function createCustomer(formData: CustomerFormData): Promise<void> {
  // ... 기존 검증 로직 ...

  // BEFORE: processContact로 자동 생성
  // const primaryContact = await processContact(formData.primaryContact, businessNumberId, true);

  // AFTER: userId 필수, linkContactToCustomer로 명시적 연결
  if (!formData.primaryContact.userId) {
    throw new Error('담당자1을 선택해주세요. 사용자 관리에서 먼저 사용자를 추가해주세요.');
  }

  const primaryContact = await linkContactToCustomer(
    formData.primaryContact.userId,
    businessNumberId
  );

  let secondaryContact: ContactInfo | undefined;
  if (formData.secondaryContact?.userId) {
    secondaryContact = await linkContactToCustomer(
      formData.secondaryContact.userId,
      businessNumberId
    );
  }

  // ... 고객사 생성 로직 ...
}

// updateCustomer 수정 - 담당자 변경 시 기존 연결 해제 및 새 연결 추가
export async function updateCustomer(
  customerId: string,
  formData: CustomerFormData,
  existingData: Customer
): Promise<void> {
  // 기존 담당자 해제
  if (existingData.primaryContact.userId) {
    await unlinkContactFromCustomer(
      existingData.primaryContact.userId,
      existingData.businessNumber
    );
  }
  if (existingData.secondaryContact?.userId) {
    await unlinkContactFromCustomer(
      existingData.secondaryContact.userId,
      existingData.businessNumber
    );
  }

  // 새 담당자 연결
  const primaryContact = await linkContactToCustomer(
    formData.primaryContact.userId!,
    existingData.businessNumber
  );

  let secondaryContact: ContactInfo | undefined;
  if (formData.secondaryContact?.userId) {
    secondaryContact = await linkContactToCustomer(
      formData.secondaryContact.userId,
      existingData.businessNumber
    );
  }

  // ... 고객사 업데이트 로직 ...
}
```

#### 1.3 supplierService.ts 수정
**파일**: `/home/soo/jhw/admin/src/services/supplierService.ts`

**변경 내용**:
```typescript
// BEFORE: processContact(data, businessNumber, false)
// AFTER: processSupplierContact(data)

const primaryContact = await processSupplierContact(formData.primaryContact);
const secondaryContact = formData.secondaryContact
  ? await processSupplierContact(formData.secondaryContact)
  : undefined;
```

#### 1.4 userService.ts 수정 - 삭제 검증 추가
**파일**: `/home/soo/jhw/admin/src/services/userService.ts`

**새 함수 추가**:
```typescript
/**
 * 사용자 삭제 (연결된 고객사가 없는 경우에만 가능)
 */
export async function deleteUser(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  // 연결된 고객사 확인
  if (user.companies && user.companies.length > 0) {
    throw new Error(
      `이 사용자는 ${user.companies.length}개의 고객사에 연결되어 있어 삭제할 수 없습니다. ` +
      '먼저 모든 고객사 연결을 해제해주세요.'
    );
  }

  // Firebase Auth에서 삭제
  await deleteUserFromAuth(userId);

  // Firestore에서 삭제
  await deleteDoc(doc(db, 'users', userId));
}

/**
 * 사용자가 삭제 가능한지 확인
 */
export async function canDeleteUser(userId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  linkedCompaniesCount?: number;
}> {
  const user = await getUserById(userId);
  if (!user) {
    return { canDelete: false, reason: '사용자를 찾을 수 없습니다.' };
  }

  if (user.companies && user.companies.length > 0) {
    return {
      canDelete: false,
      reason: '연결된 고객사가 있습니다.',
      linkedCompaniesCount: user.companies.length
    };
  }

  return { canDelete: true };
}
```

### Phase 2: UI Layer 수정

#### 2.1 CustomerAddPage.tsx 수정
**파일**: `/home/soo/jhw/admin/src/pages/customer/CustomerAddPage.tsx`

**변경 내용**:
1. **사용자 검색 결과 처리 변경**
   ```typescript
   // BEFORE: 검색 결과 없을 때 빈 값으로 두고, 저장 시 자동 생성

   // AFTER: 검색 결과 없을 때 명확한 안내 메시지
   const handleUserSearch = async (contact: 'primary' | 'secondary', mobile: string) => {
     const user = await findUserByMobile(mobile);

     if (!user) {
       setSnackbar({
         open: true,
         message: '사용자를 찾을 수 없습니다. 시스템 설정 > 사용자 관리에서 먼저 사용자를 추가해주세요.',
         severity: 'warning'
       });
       return;
     }

     // userId 필수로 설정
     handleContactUpdate(contact, 'userId', user.uid);
     handleContactUpdate(contact, 'name', user.name);
     handleContactUpdate(contact, 'mobile', user.mobile);
   };
   ```

2. **저장 시 검증 강화**
   ```typescript
   const validateForm = (): boolean => {
     // ... 기존 검증 ...

     // userId 필수 검증 추가
     if (!formData.primaryContact.userId) {
       setErrors(prev => ({
         ...prev,
         primaryContact_mobile: '담당자1을 검색하여 선택해주세요.'
       }));
       return false;
     }

     if (formData.secondaryContact?.mobile && !formData.secondaryContact?.userId) {
       setErrors(prev => ({
         ...prev,
         secondaryContact_mobile: '담당자2를 검색하여 선택해주세요.'
       }));
       return false;
     }

     return true;
   };
   ```

3. **UI 안내 메시지 추가**
   ```typescript
   <Alert severity="info" sx={{ mb: 3 }}>
     <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
       💡 담당자 등록 안내
     </Typography>
     <Typography variant="body2">
       • 담당자는 시스템 설정 > 사용자 관리에서 먼저 추가해야 합니다.
     </Typography>
     <Typography variant="body2">
       • 휴대폰번호로 검색하여 등록된 사용자를 선택해주세요.
     </Typography>
     <Typography variant="body2">
       • 새로운 담당자를 추가하려면 사용자 관리 메뉴를 이용해주세요.
     </Typography>
   </Alert>
   ```

#### 2.2 CustomerDetailPage.tsx 수정
**파일**: `/home/soo/jhw/admin/src/pages/customer/CustomerDetailPage.tsx`

**변경 내용**: CustomerAddPage.tsx와 동일한 패턴 적용

#### 2.3 사용자 관리 페이지 개선 (선택사항)
**파일**: `/home/soo/jhw/admin/src/pages/settings/UserManagementPage.tsx` (기존 파일 개선)

**추가 기능**:
1. **사용자 추가 버튼**
   - Firebase Console 스타일 다이얼로그
   - 이름, 휴대폰 입력 → 사용자 생성

2. **사용자 목록**
   - 각 사용자의 연결된 고객사 수 표시
   - 삭제 버튼 (연결된 고객사 없을 때만 활성화)

3. **삭제 확인 다이얼로그**
   ```typescript
   const handleDeleteUser = async (userId: string) => {
     const checkResult = await canDeleteUser(userId);

     if (!checkResult.canDelete) {
       alert(
         `사용자를 삭제할 수 없습니다.\n` +
         `이유: ${checkResult.reason}\n` +
         `연결된 고객사: ${checkResult.linkedCompaniesCount}개`
       );
       return;
     }

     if (confirm('정말 이 사용자를 삭제하시겠습니까?')) {
       await deleteUser(userId);
       // 목록 새로고침
     }
   };
   ```

### Phase 3: Validation Layer 수정

#### 3.1 companyValidation.ts 수정
**파일**: `/home/soo/jhw/admin/src/utils/companyValidation.ts`

**변경 내용**:
```typescript
export const validateContacts = (
  primaryContact: { userId?: string; name: string; mobile: string },
  secondaryContact?: { userId?: string; name: string; mobile: string }
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // userId 필수 검증 추가
  if (!primaryContact.userId) {
    errors.primaryContact_mobile = '담당자1을 검색하여 선택해주세요.';
  }

  if (!primaryContact.name) {
    errors.primaryContact_name = '담당자1 이름은 필수입니다.';
  }

  if (!primaryContact.mobile) {
    errors.primaryContact_mobile = '담당자1 휴대폰은 필수입니다.';
  } else {
    const normalized = normalizeNumber(primaryContact.mobile);
    if (!isValidMobile(normalized)) {
      errors.primaryContact_mobile = '올바른 휴대폰 형식이 아닙니다. (010-XXXX-XXXX)';
    }
  }

  // secondaryContact는 입력했다면 userId도 필수
  if (secondaryContact?.mobile && !secondaryContact?.userId) {
    errors.secondaryContact_mobile = '담당자2를 검색하여 선택해주세요.';
  }

  // ... 나머지 검증 로직 ...

  return errors;
};
```

## 📊 변경 영향 분석

### 영향받는 파일
1. ✅ `/admin/src/services/contactService.ts` - **핵심 변경**
2. ✅ `/admin/src/services/customerService.ts` - **핵심 변경**
3. ✅ `/admin/src/services/supplierService.ts` - 함수명 변경만
4. ✅ `/admin/src/services/userService.ts` - 삭제 로직 추가
5. ✅ `/admin/src/pages/customer/CustomerAddPage.tsx` - 검증 강화
6. ✅ `/admin/src/pages/customer/CustomerDetailPage.tsx` - 검증 강화
7. ✅ `/admin/src/utils/companyValidation.ts` - userId 검증 추가
8. 🔵 `/admin/src/pages/settings/UserManagementPage.tsx` - 개선 (선택)

### 영향받지 않는 파일
- `/admin/src/pages/supplier/SupplierAddPage.tsx` - 변경 없음
- `/admin/src/pages/supplier/SupplierDetailPage.tsx` - 변경 없음
- `/admin/src/types/company.ts` - 변경 없음 (ContactInfo 구조 그대로)

## 🧪 테스트 시나리오

### 1. 사용자 추가 시나리오
1. 시스템 설정 > 사용자 관리로 이동
2. "사용자 추가" 버튼 클릭
3. 이름: "홍길동", 휴대폰: "01012345678" 입력
4. 저장 → 사용자 생성 확인 (companies: [])

### 2. 고객사 추가 시나리오
1. 고객사 > 추가로 이동
2. 기본 정보 입력
3. 담당자1 휴대폰 "01012345678" 입력 후 검색
4. 사용자 찾기 성공 → 이름, userId 자동 입력
5. 저장 → 고객사 생성 + 사용자의 companies 배열에 추가

### 3. 사용자 미등록 시나리오
1. 고객사 > 추가로 이동
2. 담당자1 휴대폰 "01099999999" 입력 후 검색
3. "사용자를 찾을 수 없습니다" 경고 메시지
4. 저장 시도 → "담당자1을 검색하여 선택해주세요" 에러

### 4. 사용자 삭제 실패 시나리오
1. 시스템 설정 > 사용자 관리
2. 연결된 고객사가 있는 사용자의 삭제 버튼 클릭
3. "이 사용자는 N개의 고객사에 연결되어 있어 삭제할 수 없습니다" 에러

### 5. 사용자 삭제 성공 시나리오
1. 시스템 설정 > 사용자 관리
2. 연결된 고객사가 없는 사용자의 삭제 버튼 클릭
3. 확인 다이얼로그 → 삭제 완료

## 🚀 배포 고려사항

### 기존 데이터 마이그레이션
- **필요 없음**: 이미 생성된 사용자와 고객사는 정상적으로 연결되어 있음
- 새로운 로직은 **새로 추가되는 고객사부터** 적용됨

### 호환성
- **완전 호환**: ContactInfo 구조는 변경 없음
- **기존 기능 유지**: 사용자 검색, 연결 해제 등 기존 기능 모두 동작

### 롤백 계획
- Git commit으로 버전 관리
- 문제 발생 시 이전 버전으로 롤백 가능

## ✅ 체크리스트

### Phase 1: Service Layer
- [ ] contactService.ts - linkContactToCustomer 함수 구현
- [ ] contactService.ts - unlinkContactFromCustomer 함수 구현
- [ ] contactService.ts - processSupplierContact 함수 리팩토링
- [ ] customerService.ts - createCustomer 수정 (userId 필수)
- [ ] customerService.ts - updateCustomer 수정 (명시적 연결/해제)
- [ ] supplierService.ts - processSupplierContact 사용하도록 변경
- [ ] userService.ts - deleteUser 함수 추가
- [ ] userService.ts - canDeleteUser 함수 추가

### Phase 2: UI Layer
- [ ] CustomerAddPage.tsx - 검색 결과 없을 때 안내 메시지
- [ ] CustomerAddPage.tsx - userId 필수 검증
- [ ] CustomerAddPage.tsx - 안내 Alert 추가
- [ ] CustomerDetailPage.tsx - 동일한 패턴 적용
- [ ] (선택) UserManagementPage.tsx - 사용자 추가/삭제 UI 개선

### Phase 3: Validation Layer
- [ ] companyValidation.ts - validateContacts에 userId 검증 추가

### Phase 4: Testing
- [ ] 사용자 추가 테스트
- [ ] 고객사 추가 (기존 사용자 연결) 테스트
- [ ] 고객사 추가 (사용자 미등록) 테스트
- [ ] 사용자 삭제 (연결된 고객사 있음) 테스트
- [ ] 사용자 삭제 (연결된 고객사 없음) 테스트

## 📝 다음 단계

1. ✅ 계획 문서 검토 및 승인 대기
2. ⏳ Phase 1: Service Layer 구현
3. ⏳ Phase 2: UI Layer 구현
4. ⏳ Phase 3: Validation Layer 구현
5. ⏳ Phase 4: 테스트 및 검증

---

**작성자**: Claude Code
**문서 버전**: 1.0
**마지막 업데이트**: 2025-10-15
