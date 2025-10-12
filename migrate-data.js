/**
 * 데이터 마이그레이션 스크립트
 * jws-platform → jinhyun-wholesale
 *
 * 마이그레이션 대상:
 * - 마스터 데이터: referenceData, suppliers, customers, products, productCounters
 * - 시스템 데이터: settings, lastCounters, smsRecipients, smsCenterRecipients
 */

const admin = require('firebase-admin');

// jws-platform (소스)
const sourceServiceAccount = require('/home/soo/jws-platform/.firebase/jws-platform-firebase-adminsdk-fbsvc-d5db0efa63.json');
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(sourceServiceAccount),
  projectId: 'jws-platform'
}, 'source');
const sourceDb = sourceApp.firestore();

// jinhyun-wholesale (타겟)
const targetServiceAccount = require('./.firebase/jinhyun-wholesale-firebase-adminsdk-fbsvc-60d22f97f7.json');
const targetApp = admin.initializeApp({
  credential: admin.credential.cert(targetServiceAccount),
  projectId: 'jinhyun-wholesale'
}, 'target');
const targetDb = targetApp.firestore();

// 마이그레이션할 컬렉션 목록
const COLLECTIONS = {
  master: [
    'referenceData',
    'suppliers',
    'customers',
    'products',
    'productCounters'
  ],
  system: [
    'settings',
    'lastCounters',
    'smsRecipients',
    'smsCenterRecipients'
  ]
};

/**
 * 컬렉션 데이터 마이그레이션
 */
async function migrateCollection(collectionName) {
  console.log(`\n📦 [${collectionName}] 마이그레이션 시작...`);

  try {
    // 소스에서 모든 문서 읽기
    const snapshot = await sourceDb.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`   ⚠️  비어있음 - 건너뜀`);
      return { success: true, count: 0 };
    }

    console.log(`   📊 ${snapshot.size}개 문서 발견`);

    // 배치 쓰기 준비
    let batch = targetDb.batch();
    let batchCount = 0;
    let totalCount = 0;

    for (const doc of snapshot.docs) {
      const docRef = targetDb.collection(collectionName).doc(doc.id);
      batch.set(docRef, doc.data());
      batchCount++;
      totalCount++;

      // Firestore 배치는 최대 500개
      if (batchCount === 500) {
        await batch.commit();
        console.log(`   ✅ ${totalCount}개 커밋됨`);
        batch = targetDb.batch();
        batchCount = 0;
      }
    }

    // 남은 데이터 커밋
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`   ✅ [${collectionName}] 완료: ${totalCount}개 문서`);
    return { success: true, count: totalCount };

  } catch (error) {
    console.error(`   ❌ [${collectionName}] 오류:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 메인 마이그레이션 실행
 */
async function main() {
  console.log('🚀 데이터 마이그레이션 시작');
  console.log('📍 소스: jws-platform');
  console.log('📍 타겟: jinhyun-wholesale');
  console.log('='.repeat(60));

  const results = {
    master: {},
    system: {}
  };

  // 마스터 데이터 마이그레이션
  console.log('\n📂 마스터 데이터 마이그레이션');
  console.log('-'.repeat(60));
  for (const collection of COLLECTIONS.master) {
    results.master[collection] = await migrateCollection(collection);
  }

  // 시스템 데이터 마이그레이션
  console.log('\n⚙️  시스템 데이터 마이그레이션');
  console.log('-'.repeat(60));
  for (const collection of COLLECTIONS.system) {
    results.system[collection] = await migrateCollection(collection);
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 마이그레이션 결과 요약');
  console.log('='.repeat(60));

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDocs = 0;

  console.log('\n📂 마스터 데이터:');
  for (const [name, result] of Object.entries(results.master)) {
    const status = result.success ? '✅' : '❌';
    const count = result.count || 0;
    console.log(`   ${status} ${name}: ${count}개 문서`);
    if (result.success) {
      totalSuccess++;
      totalDocs += count;
    } else {
      totalFailed++;
    }
  }

  console.log('\n⚙️  시스템 데이터:');
  for (const [name, result] of Object.entries(results.system)) {
    const status = result.success ? '✅' : '❌';
    const count = result.count || 0;
    console.log(`   ${status} ${name}: ${count}개 문서`);
    if (result.success) {
      totalSuccess++;
      totalDocs += count;
    } else {
      totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ 성공: ${totalSuccess}개 컬렉션`);
  console.log(`❌ 실패: ${totalFailed}개 컬렉션`);
  console.log(`📊 총 문서: ${totalDocs}개`);
  console.log('='.repeat(60));

  if (totalFailed === 0) {
    console.log('\n🎉 마이그레이션 완료!');
  } else {
    console.log('\n⚠️  일부 컬렉션 마이그레이션 실패');
  }

  process.exit(0);
}

// 실행
main().catch(error => {
  console.error('❌ 치명적 오류:', error);
  process.exit(1);
});
