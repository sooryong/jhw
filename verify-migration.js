// Verify migrated data in jinhyun-wholesale
const admin = require('firebase-admin');
const serviceAccount = require('./.firebase/jinhyun-wholesale-firebase-adminsdk-fbsvc-60d22f97f7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'jinhyun-wholesale'
});

const db = admin.firestore();

async function verifyMigration() {
  console.log('🔍 마이그레이션 데이터 확인\n');
  console.log('='.repeat(60));

  // Check suppliers
  const suppliersSnap = await db.collection('suppliers').limit(3).get();
  console.log(`\n📦 Suppliers (${suppliersSnap.size}개 샘플):`);
  suppliersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name || '이름없음'}`);
  });

  // Check customers
  const customersSnap = await db.collection('customers').limit(3).get();
  console.log(`\n👥 Customers (${customersSnap.size}개 샘플):`);
  customersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name || '이름없음'}`);
  });

  // Check products
  const productsSnap = await db.collection('products').limit(5).get();
  console.log(`\n🛍️  Products (${productsSnap.size}개 샘플):`);
  productsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name || '이름없음'}`);
  });

  // Check settings
  const settingsSnap = await db.collection('settings').get();
  console.log(`\n⚙️  Settings (${settingsSnap.size}개):`);
  settingsSnap.forEach(doc => {
    console.log(`   - ${doc.id}`);
  });

  // Check lastCounters
  const countersSnap = await db.collection('lastCounters').get();
  console.log(`\n🔢 LastCounters (${countersSnap.size}개):`);
  countersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.lastCounter || 0}`);
  });

  // Check smsCenterRecipients
  const smsSnap = await db.collection('smsCenterRecipients').get();
  console.log(`\n📱 SMS Center Recipients (${smsSnap.size}개):`);
  smsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name || '이름없음'} (${data.mobile || ''})`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ 마이그레이션 데이터 확인 완료');

  process.exit(0);
}

verifyMigration().catch(error => {
  console.error('❌ 오류:', error);
  process.exit(1);
});
