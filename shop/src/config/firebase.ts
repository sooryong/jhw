/**
 * 파일 경로: /src/config/firebase.ts
 * 주요 내용: Firebase 설정 및 초기화
 * 관련 데이터: Firebase App, Auth, Firestore, Functions
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스 초기화
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast3'); // Seoul region

// Firebase 초기화 상태 확인 완료

// 개발 환경에서 에뮬레이터 사용 (필요시)
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    // Firebase Functions 에뮬레이터 연결 완료
  } catch (error) {
      // Error handled silently
    // 경고: Firebase Functions 에뮬레이터 연결 실패
  }
}

export default app;