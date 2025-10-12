/**
 * 파일 경로: /src/main.tsx
 * 작성 날짜: 2025-09-22
 * 주요 내용: JWS 플랫폼 진입점 - 완전 새로운 TSX 구현
 */

import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <App />
);