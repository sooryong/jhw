// Firebase Client SDK로 사용자 확인
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCdP-OJnnRP4iyE8iDCj11SU7JQJdZB2y0",
  authDomain: "jinhyun-wholesale.firebaseapp.com",
  projectId: "jinhyun-wholesale",
  storageBucket: "jinhyun-wholesale.firebasestorage.app",
  messagingSenderId: "623246979895",
  appId: "1:623246979895:web:e50ea3d2c2787d8703a0b2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser() {
  try {
    const userRef = doc(db, 'users', '01038139885');
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      console.log('✅ 사용자 문서 존재!');
      console.log('\n📋 문서 데이터:');
      const data = userDoc.data();
      console.log(JSON.stringify(data, null, 2));

      console.log('\n🔍 중요 필드 확인:');
      console.log('- authUid:', data.authUid || '❌ 없음');
      console.log('- mobile:', data.mobile || '❌ 없음');
      console.log('- name:', data.name || '❌ 없음');
      console.log('- role:', data.role || '❌ 없음');
      console.log('- isActive:', data.isActive !== undefined ? data.isActive : '❌ 없음');
    } else {
      console.log('❌ 사용자 문서를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('오류:', error.message);
  }

  process.exit(0);
}

checkUser();
