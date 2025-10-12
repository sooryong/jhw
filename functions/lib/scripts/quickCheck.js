"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
async function check() {
    const doc = await db.collection('users').doc('01038888601').get();
    const data = doc.data();
    console.log('linkedCustomers:', data === null || data === void 0 ? void 0 : data.linkedCustomers);
    console.log('role:', data === null || data === void 0 ? void 0 : data.role);
    console.log('name:', data === null || data === void 0 ? void 0 : data.name);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=quickCheck.js.map