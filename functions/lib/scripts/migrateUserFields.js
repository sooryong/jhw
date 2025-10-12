"use strict";
/**
 * 사용자 필드 마이그레이션 스크립트
 * customerBusinessNumbers → linkedCustomers
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
// Firebase Admin 초기화
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
async function migrateUserFields() {
    console.log('🔄 Starting user field migration...');
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    let updated = 0;
    let skipped = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const docId = doc.id;
        // customer 역할이 아니면 건너뛰기
        if (data.role !== 'customer') {
            continue;
        }
        // 이미 linkedCustomers 필드가 있으면 건너뛰기
        if (data.linkedCustomers) {
            console.log(`✅ Skip ${docId}: linkedCustomers already exists`);
            skipped++;
            continue;
        }
        // 구 필드에서 마이그레이션
        let linkedCustomers = [];
        if (data.customerBusinessNumbers && Array.isArray(data.customerBusinessNumbers)) {
            linkedCustomers = data.customerBusinessNumbers;
        }
        else if (data.customerBusinessNumber) {
            linkedCustomers = [data.customerBusinessNumber];
        }
        // linkedCustomers가 비어있으면 빈 배열로 초기화
        await doc.ref.update({
            linkedCustomers: linkedCustomers,
        });
        console.log(`✅ Updated ${docId}: linkedCustomers = ${JSON.stringify(linkedCustomers)}`);
        updated++;
    }
    console.log('\n📊 Migration completed!');
    console.log(`  - Updated: ${updated}`);
    console.log(`  - Skipped: ${skipped}`);
    console.log(`  - Total: ${snapshot.size}`);
}
// 실행
migrateUserFields()
    .then(() => {
    console.log('✅ Migration script finished successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=migrateUserFields.js.map