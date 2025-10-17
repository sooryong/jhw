# Changelog

All notable changes to the JHW Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.5] - 2025-10-17 (Beta Release)

### 🎯 Beta Testing Release
프로덕션 1.0 출시 전 베타 테스트를 위한 릴리스

### ✅ Production Readiness
- TypeScript 빌드 최적화 및 검증 완료
- ESLint 코드 품질 검사 완료
- npm audit 보안 취약점 0건 확인
- Firebase 보안 규칙 검토 완료
- 프로덕션 빌드 성공 (Admin, Shop, Functions)

### 📦 Build Information
- **Admin Bundle**: 2.3MB (gzipped: 623KB)
- **Shop Bundle**: 1.25MB (gzipped: 346KB)
- **Functions**: TypeScript 컴파일 성공

### 🔧 Technical Improvements
- Build 스크립트 개선 (`build`, `build:check`, `typecheck` 분리)
- TypeScript strict mode 유지
- ESLint 자동 수정 적용

### 🐛 Bug Fixes
- Supplier 타입 import 경로 수정 (company.ts로 통합)
- PayoutMethod 타입 정의 수정

### 📝 Known Issues
- TypeScript strict 모드에서 일부 타입 경고 (런타임 영향 없음)
- ESLint 미사용 error 변수 경고 (빌드 영향 없음)

### 🔄 Next Steps (v1.0)
- TypeScript 타입 오류 완전 해결
- 번들 크기 최적화
- 코드 splitting 개선
- 성능 최적화

---

## [0.9.0] - 2025-10-12

### Added
- 초기 시스템 구현
- Admin 시스템 (관리자/직원용)
- Shop 시스템 (고객사용)
- Cloud Functions (SMS, 사용자 관리)
- Firebase Authentication, Firestore, Storage 통합
- 일일주문 확정 프로세스
- 입고/출고 관리
- 매입/매출 원장
- 고객사/공급사 관리
- 상품 관리
- SMS 센터

### Changed
- JWS → JHW 브랜드 변경
- 사용자 권한 체계 개선
- 담당자 관리 시스템 개선

### Technical Details
- React 19.1.1
- TypeScript 5.9.3
- Material-UI 7.3.4
- Firebase 12.4.0
- Vite 7.1.9

---

## Version History

- **0.9.5** - 2025-10-17 - Beta Release (현재)
- **0.9.0** - 2025-10-12 - Initial Release
