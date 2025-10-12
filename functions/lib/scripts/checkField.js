"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
async function check() {
    const doc = await db.collection('users').doc('01038888601').get();
    if (!doc.exists) {
        console.log('❌ 문서가 존재하지 않습니다');
        return;
    }
    const data = doc.data();
    console.log('\n📄 전체 문서 데이터:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n🔍 linkedCustomers 필드:');
    console.log('  - 존재:', 'linkedCustomers' in (data || {}));
    console.log('  - 값:', data === null || data === void 0 ? void 0 : data.linkedCustomers);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=checkField.js.map