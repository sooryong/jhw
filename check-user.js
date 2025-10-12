// Firebase Admin SDK를 사용하여 사용자 확인
const admin = require('firebase-admin');
const serviceAccount = require('./.firebase/jinhyun-wholesale-firebase-adminsdk-fbsvc-60d22f97f7.json');

// Firebase 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'jinhyun-wholesale'
});

const db = admin.firestore();

async function checkUser() {
  try {
    const userDoc = await db.collection('users').doc('01038139885').get();

    if (userDoc.exists) {
      console.log('✅ 사용자 문서 존재!');
      console.log('\n📋 문서 데이터:');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('❌ 사용자 문서를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('오류:', error.message);
  }

  process.exit(0);
}

checkUser();
