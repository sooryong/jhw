"use strict";
/**
 * 사용자 데이터 확인 스크립트
 * 특정 사용자의 linkedCustomers 필드 확인
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
// Firebase Admin 초기화
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
async function checkUserData() {
    var _a, _b, _c;
    const userId = process.argv[2]; // 커맨드라인 인자로 사용자 ID 받기
    if (!userId) {
        console.error('❌ 사용자 ID를 입력하세요.');
        console.log('사용 예: npx tsx src/scripts/checkUserData.ts 01012345678');
        process.exit(1);
    }
    console.log(`🔍 사용자 ${userId} 데이터 확인 중...\n`);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
        console.error(`❌ 사용자를 찾을 수 없습니다: ${userId}`);
        process.exit(1);
    }
    const data = userDoc.data();
    console.log('📄 Firestore 문서 데이터:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n🔍 linkedCustomers 필드 상세:');
    console.log('  - 존재 여부:', 'linkedCustomers' in (data || {}));
    console.log('  - 타입:', typeof (data === null || data === void 0 ? void 0 : data.linkedCustomers));
    console.log('  - 값:', data === null || data === void 0 ? void 0 : data.linkedCustomers);
    console.log('  - 배열 여부:', Array.isArray(data === null || data === void 0 ? void 0 : data.linkedCustomers));
    console.log('  - 길이:', ((_a = data === null || data === void 0 ? void 0 : data.linkedCustomers) === null || _a === void 0 ? void 0 : _a.length) || 0);
    if ((data === null || data === void 0 ? void 0 : data.role) === 'customer' && (!(data === null || data === void 0 ? void 0 : data.linkedCustomers) || data.linkedCustomers.length === 0)) {
        console.log('\n⚠️  customer 역할인데 linkedCustomers가 비어있습니다!');
        console.log('\n🔍 SMS 수신자 확인 중...');
        // customers 컬렉션에서 이 휴대폰번호를 SMS 수신자로 가진 고객사 찾기
        const customersSnapshot = await db.collection('customers').get();
        const linkedCustomers = [];
        for (const customerDoc of customersSnapshot.docs) {
            const customerData = customerDoc.data();
            const person1Mobile = (_b = customerData.person1) === null || _b === void 0 ? void 0 : _b.mobile;
            const person2Mobile = (_c = customerData.person2) === null || _c === void 0 ? void 0 : _c.mobile;
            if (person1Mobile === userId || person2Mobile === userId) {
                linkedCustomers.push(customerDoc.id);
                console.log(`  ✅ 고객사 발견: ${customerDoc.id} (${customerData.businessName})`);
            }
        }
        if (linkedCustomers.length > 0) {
            console.log(`\n💡 이 사용자는 ${linkedCustomers.length}개 고객사의 SMS 수신자입니다.`);
            console.log('   하지만 users 문서의 linkedCustomers 필드에는 저장되지 않았습니다.');
        }
        else {
            console.log('\n❌ 이 휴대폰번호는 어떤 고객사의 SMS 수신자도 아닙니다.');
        }
    }
}
checkUserData()
    .then(() => {
    console.log('\n✅ 확인 완료');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ 오류:', error);
    process.exit(1);
});
//# sourceMappingURL=checkUserData.js.map