# JWS Platform v2.0

JWS 플랫폼 v2.0 - 관리 시스템과 쇼핑몰을 분리한 독립 실행형 애플리케이션

## 프로젝트 구조

```
jws-workspace/
├── jws-admin/          # 관리자 시스템 (Admin System)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── jws-shop/           # 쇼핑몰 시스템 (Shopping Mall)
    ├── src/
    ├── package.json
    └── vite.config.ts
```

## v2.0 주요 변경사항

### 아키텍처
- **분리된 애플리케이션**: 관리 시스템(jws-admin)과 쇼핑몰(jws-shop)을 별도 앱으로 분리
- **독립 인증 세션**: 각 앱이 독립된 Firebase Auth 인스턴스를 가져 세션 충돌 방지
- **공유 데이터베이스**: 동일한 Firebase Firestore 데이터베이스 공유

### 포트 구성
- **jws-admin**: http://localhost:5173 (관리자/직원 전용)
- **jws-shop**: http://localhost:5174 (고객사 쇼핑몰)

### 대리 쇼핑 기능
- 관리자/직원이 대리 쇼핑 메뉴에서 고객사 선택
- 새 창으로 jws-shop 앱 오픈 (window.open)
- URL 파라미터로 고객사 정보 전달
- 각 앱의 독립적인 인증 세션 유지

## 개발 가이드

### 설치 및 실행

#### jws-admin (관리 시스템)
```bash
cd jws-admin
npm install
npm run dev  # http://localhost:5173
```

#### jws-shop (쇼핑몰)
```bash
cd jws-shop
npm install
npm run dev  # http://localhost:5174
```

### 빌드
```bash
# jws-admin
cd jws-admin
npm run build

# jws-shop
cd jws-shop
npm run build
```

### 배포
```bash
# jws-admin
cd jws-admin
npm run build
firebase deploy --only hosting:jws-admin

# jws-shop
cd jws-shop
npm run build
firebase deploy --only hosting:jws-shop
```

## 기술 스택

### 공통
- React 19.1.1
- TypeScript 5.9.3
- Material-UI v7.3.4
- React Router v7.9.4
- Firebase 12.4.0
- Vite 7.1.9

### jws-admin 전용
- MUI X Data Grid
- MUI X Date Pickers
- Recharts (차트)
- XLSX (엑셀 내보내기)

### jws-shop 전용
- Context API (Cart, Customer)
- Mobile-first UI

## v1.0 → v2.0 마이그레이션

### v1.0 (Unified System)
- 단일 앱에서 관리 시스템과 쇼핑몰 통합
- Firebase Auth 세션 충돌 문제

### v2.0 (Separated System)
- 독립된 2개 앱으로 분리
- 각 앱의 독립 세션으로 충돌 해결
- 동일한 Firebase 프로젝트 및 데이터베이스 유지

## 버전 히스토리

- **v1.0.0** (2025-10-12): 기존 통합 시스템의 프로덕션 베이스라인
- **v2.0.0** (2025-10-12): 관리 시스템과 쇼핑몰 분리

## 라이선스

Proprietary - 중원식품 (JWS)
