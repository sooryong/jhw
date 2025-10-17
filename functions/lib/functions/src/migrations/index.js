"use strict";
/**
 * 파일 경로: /functions/src/migrations/index.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 마이그레이션 Cloud Functions 엔드포인트
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMigrationStatus = exports.migrateCustomerUsers = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const migrateCustomerUsersV1_1 = require("./migrateCustomerUsersV1");
// CORS 설정
const cors = require('cors')({ origin: true });
/**
 * HTTP Cloud Function: 고객사 사용자 마이그레이션 실행
 *
 * 보안: admin 역할만 실행 가능
 *
 * 호출 방법:
 * POST https://asia-northeast3-{project-id}.cloudfunctions.net/migrateCustomerUsers
 * Authorization: Bearer {idToken}
 *
 * Body:
 * {
 *   "dryRun": false // true면 실제 실행하지 않고 시뮬레이션만
 * }
 */
exports.migrateCustomerUsers = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
        var _a;
        try {
            // POST 메서드만 허용
            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Method not allowed' });
                return;
            }
            // 인증 확인
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            // admin 권한 확인
            const userDoc = await admin
                .firestore()
                .collection('users')
                .doc(decodedToken.uid)
                .get();
            const userData = userDoc.data();
            if (!userData || userData.role !== 'admin') {
                res.status(403).json({ error: 'Forbidden: Admin access required' });
                return;
            }
            // 마이그레이션 실행
            const dryRun = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.dryRun) === true;
            if (dryRun) {
                res.status(200).json({
                    message: 'Dry run mode - migration not executed',
                    note: 'Set dryRun: false to execute actual migration'
                });
                return;
            }
            console.log(`Migration started by user: ${userData.name} (${decodedToken.uid})`);
            const result = await (0, migrateCustomerUsersV1_1.migrateAllCustomerUsers)();
            res.status(200).json({
                success: true,
                message: 'Migration completed',
                result
            });
        }
        catch (error) {
            console.error('Migration error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});
/**
 * HTTP Cloud Function: 마이그레이션 결과 확인
 *
 * 호출 방법:
 * GET https://asia-northeast3-{project-id}.cloudfunctions.net/checkMigrationStatus
 * Authorization: Bearer {idToken}
 */
exports.checkMigrationStatus = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
        try {
            // GET 메서드만 허용
            if (req.method !== 'GET') {
                res.status(405).json({ error: 'Method not allowed' });
                return;
            }
            // 인증 확인
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            // admin 권한 확인
            const userDoc = await admin
                .firestore()
                .collection('users')
                .doc(decodedToken.uid)
                .get();
            const userData = userDoc.data();
            if (!userData || userData.role !== 'admin') {
                res.status(403).json({ error: 'Forbidden: Admin access required' });
                return;
            }
            // 마이그레이션 상태 확인
            const customersSnapshot = await admin
                .firestore()
                .collection('customers')
                .where('isActive', '==', true)
                .get();
            let totalCustomers = 0;
            let migratedCustomers = 0;
            let notMigratedCustomers = 0;
            for (const doc of customersSnapshot.docs) {
                totalCustomers++;
                const data = doc.data();
                if (data.authorizedUsers && data.authorizedUsers.length > 0) {
                    migratedCustomers++;
                }
                else {
                    notMigratedCustomers++;
                }
            }
            res.status(200).json({
                success: true,
                status: {
                    totalCustomers,
                    migratedCustomers,
                    notMigratedCustomers,
                    migrationProgress: totalCustomers > 0 ? ((migratedCustomers / totalCustomers) * 100).toFixed(2) + '%' : '0%'
                }
            });
        }
        catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});
//# sourceMappingURL=index.js.map