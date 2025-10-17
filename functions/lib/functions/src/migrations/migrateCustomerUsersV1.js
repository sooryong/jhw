"use strict";
/**
 * 파일 경로: /functions/src/migrations/migrateCustomerUsersV1.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 SMS 수신자를 사용자 계정으로 마이그레이션
 *
 * 실행 방법:
 * 1. Firebase Admin SDK 초기화 필요
 * 2. 이 파일을 직접 실행하거나 Cloud Functions로 배포
 * 3. 단 한번만 실행하고 완료 후 비활성화 권장
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateAllCustomerUsers = migrateAllCustomerUsers;
exports.rollbackMigration = rollbackMigration;
const admin = require("firebase-admin");
/**
 * 기본 비밀번호 생성 (휴대폰 번호 뒷 4자리)
 */
function generateDefaultPassword(mobile) {
    const numbers = mobile.replace(/[^0-9]/g, '');
    return numbers.slice(-4);
}
/**
 * Firebase Auth에 사용자 생성 또는 기존 사용자 가져오기
 */
async function getOrCreateAuthUser(mobile, name) {
    const normalizedMobile = mobile.replace(/[^0-9]/g, '');
    const formattedMobile = `010-${normalizedMobile.slice(3, 7)}-${normalizedMobile.slice(7)}`;
    try {
        // 휴대폰 번호로 기존 사용자 조회 (email로 조회)
        const email = `${normalizedMobile}@jhw.local`;
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            return { uid: existingUser.uid, isNewUser: false };
        }
        catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }
        // 신규 사용자 생성
        const newUser = await admin.auth().createUser({
            email,
            password: generateDefaultPassword(mobile),
            displayName: name,
            disabled: false
        });
        return { uid: newUser.uid, isNewUser: true };
    }
    catch (error) {
        console.error(`Error creating auth user for ${mobile}:`, error);
        throw new Error(`Auth user creation failed: ${error.message}`);
    }
}
/**
 * Firestore users 컬렉션에 사용자 문서 생성 또는 업데이트
 */
async function createOrUpdateUserDocument(uid, mobile, name, customerNumber, customerRole, isNewUser) {
    const userRef = admin.firestore().collection('users').doc(uid);
    const normalizedMobile = mobile.replace(/[^0-9]/g, '');
    const formattedMobile = `010-${normalizedMobile.slice(3, 7)}-${normalizedMobile.slice(7)}`;
    if (isNewUser) {
        // 신규 사용자 문서 생성
        const userData = {
            uid,
            name,
            mobile: formattedMobile,
            role: 'customer',
            smsRecipientInfo: {
                mobile: formattedMobile,
                name,
                linkedCustomerNumbers: [customerNumber],
                recipientRole: customerRole === 'primary' ? 'person1' : 'person2',
                customerRole,
                notificationPreferences: {
                    receiveOrderNotifications: true,
                    receivePaymentNotifications: true,
                    receivePromotionNotifications: true
                }
            },
            linkedCustomers: [customerNumber],
            isActive: true,
            createdAt: new Date(),
            requiresPasswordChange: true
        };
        await userRef.set(userData);
    }
    else {
        // 기존 사용자 업데이트 (linkedCustomers에 추가)
        const userDoc = await userRef.get();
        const existingData = userDoc.data();
        const linkedCustomers = existingData.linkedCustomers || [];
        if (!linkedCustomers.includes(customerNumber)) {
            linkedCustomers.push(customerNumber);
        }
        await userRef.update({
            linkedCustomers,
            'smsRecipientInfo.linkedCustomerNumbers': linkedCustomers
        });
    }
}
/**
 * 고객사 문서 업데이트 (smsRecipient 제거, user references 추가)
 */
async function updateCustomerDocument(customerNumber, primaryUserId, secondaryUserId) {
    const customerRef = admin.firestore().collection('customers').doc(customerNumber);
    const updateData = {
        authorizedUsers: secondaryUserId ? [primaryUserId, secondaryUserId] : [primaryUserId],
        primaryContactUserId: primaryUserId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (secondaryUserId) {
        updateData.secondaryContactUserId = secondaryUserId;
    }
    // smsRecipient 필드 삭제
    updateData.smsRecipient = admin.firestore.FieldValue.delete();
    await customerRef.update(updateData);
}
/**
 * 단일 고객사 마이그레이션
 */
async function migrateCustomer(customer) {
    try {
        const { businessNumber, businessName, smsRecipient } = customer;
        if (!smsRecipient || !smsRecipient.person1) {
            return {
                success: false,
                error: 'No SMS recipient found'
            };
        }
        // person1 (주 담당자) 마이그레이션
        const person1Result = await getOrCreateAuthUser(smsRecipient.person1.mobile, smsRecipient.person1.name);
        await createOrUpdateUserDocument(person1Result.uid, smsRecipient.person1.mobile, smsRecipient.person1.name, businessNumber, 'primary', person1Result.isNewUser);
        let person2UserId;
        // person2 (부 담당자) 마이그레이션 (선택사항)
        if (smsRecipient.person2 && smsRecipient.person2.mobile) {
            const person2Result = await getOrCreateAuthUser(smsRecipient.person2.mobile, smsRecipient.person2.name);
            await createOrUpdateUserDocument(person2Result.uid, smsRecipient.person2.mobile, smsRecipient.person2.name, businessNumber, 'secondary', person2Result.isNewUser);
            person2UserId = person2Result.uid;
        }
        // 고객사 문서 업데이트
        await updateCustomerDocument(businessNumber, person1Result.uid, person2UserId);
        return {
            success: true,
            primaryUserId: person1Result.uid,
            secondaryUserId: person2UserId
        };
    }
    catch (error) {
        console.error(`Error migrating customer ${customer.businessNumber}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * 전체 마이그레이션 실행
 */
async function migrateAllCustomerUsers() {
    const result = {
        totalCustomers: 0,
        migratedUsers: 0,
        errors: [],
        skipped: []
    };
    try {
        console.log('Starting customer user migration...');
        // 모든 활성 고객사 조회
        const customersSnapshot = await admin
            .firestore()
            .collection('customers')
            .where('isActive', '==', true)
            .get();
        result.totalCustomers = customersSnapshot.size;
        console.log(`Found ${result.totalCustomers} active customers`);
        // 각 고객사 순차적으로 마이그레이션
        for (const doc of customersSnapshot.docs) {
            const customer = doc.data();
            customer.businessNumber = doc.id; // 문서 ID가 사업자번호
            console.log(`Migrating customer: ${customer.businessName} (${customer.businessNumber})`);
            // 이미 마이그레이션된 고객사는 건너뛰기
            if (customer.authorizedUsers && customer.authorizedUsers.length > 0) {
                result.skipped.push({
                    customerId: customer.businessNumber,
                    customerName: customer.businessName,
                    reason: 'Already migrated'
                });
                console.log(`  -> Skipped (already migrated)`);
                continue;
            }
            const migrationResult = await migrateCustomer(customer);
            if (migrationResult.success) {
                result.migratedUsers += migrationResult.secondaryUserId ? 2 : 1;
                console.log(`  -> Success (${migrationResult.secondaryUserId ? '2 users' : '1 user'})`);
            }
            else {
                result.errors.push({
                    customerId: customer.businessNumber,
                    customerName: customer.businessName,
                    error: migrationResult.error || 'Unknown error'
                });
                console.log(`  -> Failed: ${migrationResult.error}`);
            }
            // API 제한을 피하기 위해 약간의 딜레이
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('\nMigration completed!');
        console.log(`Total customers: ${result.totalCustomers}`);
        console.log(`Migrated users: ${result.migratedUsers}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log(`Skipped: ${result.skipped.length}`);
        return result;
    }
    catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
/**
 * 마이그레이션 롤백 (주의: 사용자 계정은 삭제하지 않음)
 */
async function rollbackMigration() {
    console.log('Starting rollback...');
    console.log('Note: This will NOT delete user accounts, only restore customer smsRecipient fields');
    // 고객사별 사용자 정보를 복원하는 로직
    // 실제 구현은 백업 데이터가 필요함
    throw new Error('Rollback not implemented. Manual rollback required if needed.');
}
//# sourceMappingURL=migrateCustomerUsersV1.js.map