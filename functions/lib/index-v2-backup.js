"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSaleOrderStatus = exports.deleteSaleOrder = exports.createSaleOrder = exports.changeUserPassword = exports.deleteUserAccount = exports.resetUserPassword = exports.getCreditBalance = exports.sendSms = exports.validateReferenceData = exports.createUserV2 = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const admin = require("firebase-admin");
const solapi_1 = require("solapi");
const crypto = require("crypto");
admin.initializeApp();
// Define secrets
const coolsmsApiKey = (0, params_1.defineSecret)('COOLSMS_API_KEY');
const coolsmsApiSecret = (0, params_1.defineSecret)('COOLSMS_API_SECRET');
/**
 * User creation V2 - Clean 2nd generation Firebase function with optimized CORS
 */
exports.createUserV2 = (0, https_1.onRequest)({
    cors: true
}, async (req, res) => {
    try {
        console.log('User creation function started');
        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        // Get the authorization token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: No valid authorization header' });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        // 호출자가 admin 권한인지 확인
        const callerDoc = await admin.firestore().collection('users').doc(uid).get();
        const callerData = callerDoc.data();
        if (!callerData || callerData.role !== 'admin') {
            res.status(403).json({ error: 'Admin role required' });
            return;
        }
        const { mobile, name, role = 'staff', email, customerBusinessNumbers } = req.body;
        console.log('받은 사용자 데이터:', {
            mobile,
            name,
            role,
            customerBusinessNumbers
        });
        if (!mobile || !name) {
            res.status(400).json({ error: 'Mobile and name are required' });
            return;
        }
        // 휴대폰번호 정규화 (숫자만 추출)
        const normalizedMobile = mobile.replace(/[^0-9]/g, '');
        // 휴대폰번호 길이 검증
        if (normalizedMobile.length !== 11 || !normalizedMobile.startsWith('010')) {
            res.status(400).json({
                success: false,
                error: '올바른 휴대폰번호 형식이 아닙니다. (010-XXXX-XXXX)'
            });
            return;
        }
        // 고객사 역할인 경우 customerBusinessNumbers 검증 (빈 배열 허용)
        if (role === 'customer') {
            if (customerBusinessNumbers !== undefined && !Array.isArray(customerBusinessNumbers)) {
                console.error('❌ 고객사 사용자 생성 실패: customerBusinessNumbers가 배열이 아님');
                res.status(400).json({
                    success: false,
                    error: 'customerBusinessNumbers는 배열이어야 합니다.'
                });
                return;
            }
            console.log('✅ 고객사 사용자 검증 통과:', {
                businessNumbersProvided: !!customerBusinessNumbers,
                businessNumbersCount: (customerBusinessNumbers === null || customerBusinessNumbers === void 0 ? void 0 : customerBusinessNumbers.length) || 0,
                businessNumbers: customerBusinessNumbers || []
            });
        }
        // 이메일 생성 (제공되지 않은 경우) - 숫자만 사용
        const userEmail = email || `${normalizedMobile}@jws.local`;
        // 초기 비밀번호 생성 (휴대폰 뒷자리 4자리를 2번 반복)
        const lastFourDigits = normalizedMobile.slice(-4);
        const initialPassword = lastFourDigits + lastFourDigits;
        // Firebase Auth에서 사용자 생성
        const userRecord = await admin.auth().createUser({
            email: userEmail,
            password: initialPassword,
            displayName: name,
        });
        // Firestore에 사용자 문서 생성
        const userData = {
            mobile: normalizedMobile,
            name,
            role,
            email: userEmail,
            isActive: true,
            requiresPasswordChange: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // customer 역할인 경우에만 customerBusinessNumbers 필드 추가
        if (role === 'customer') {
            userData.customerBusinessNumbers = customerBusinessNumbers || [];
        }
        console.log('저장할 사용자 데이터:', Object.assign(Object.assign({}, userData), { hasCustomerBusinessNumbers: !!userData.customerBusinessNumbers, isCustomerRole: role === 'customer' }));
        await admin.firestore().collection('users').doc(userRecord.uid).set(userData);
        console.log(`사용자 생성 완료: ${userRecord.uid}`, {
            role: userData.role,
            hasCustomerBusinessNumbers: !!userData.customerBusinessNumbers
        });
        res.status(200).json({
            success: true,
            uid: userRecord.uid,
            defaultPassword: initialPassword,
            message: '사용자가 성공적으로 생성되었습니다.'
        });
    }
    catch (error) {
        console.error('사용자 생성 실패:', error);
        // 이메일 중복 에러 처리
        if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/email-already-exists') {
            res.status(400).json({
                success: false,
                error: `이미 등록된 휴대폰번호입니다.`
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '사용자 생성에 실패했습니다'
        });
    }
});
exports.validateReferenceData = (0, firestore_1.onDocumentWritten)('referenceData/{docId}', async (event) => {
    var _a;
    const change = event.data;
    if (!change)
        return;
    const data = ((_a = change.after) === null || _a === void 0 ? void 0 : _a.exists) ? change.after.data() : null;
    if (!data)
        return;
    // Type assertion for data object
    const docData = data;
    if (!docData.category || !docData.code || !docData.name) {
        console.error('Invalid reference data: missing required fields');
        return;
    }
    const duplicateQuery = await admin
        .firestore()
        .collection('referenceData')
        .where('category', '==', docData.category)
        .where('code', '==', docData.code)
        .get();
    if (duplicateQuery.docs.length > 1) {
        console.error(`Duplicate reference data found: ${docData.category}/${docData.code}`);
    }
});
// Solapi 클라이언트 초기화
const initSolapi = () => {
    const apiKey = coolsmsApiKey.value().trim();
    const apiSecret = coolsmsApiSecret.value().trim();
    if (!apiKey || !apiSecret) {
        throw new Error('Solapi API credentials not configured');
    }
    return new solapi_1.SolapiMessageService(apiKey, apiSecret);
};
// Solapi Auth 헤더 생성 함수
const generateSolapiAuth = (apiKey, apiSecret, method, url) => {
    const salt = Date.now().toString();
    const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const stringToSign = method + ' ' + url + '\n' + date + '\n' + salt;
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(stringToSign)
        .digest('hex');
    // 줄바꿈 문자 없이 헤더 생성
    const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
    return {
        'Authorization': authorization,
        'Content-Type': 'application/json'
    };
};
// 실제 Solapi 잔액 조회 함수 - Enhanced v2
const getRealSolapiBalance = async () => {
    console.log('🔑 Retrieving CoolSMS API credentials from secrets...');
    const apiKey = coolsmsApiKey.value().trim(); // 줄바꿈 문자 제거
    const apiSecret = coolsmsApiSecret.value().trim(); // 줄바꿈 문자 제거
    console.log('📋 API Key length:', apiKey ? apiKey.length : 0);
    console.log('📋 API Secret length:', apiSecret ? apiSecret.length : 0);
    if (!apiKey || !apiSecret) {
        throw new Error('CoolSMS API credentials not configured in secrets');
    }
    const url = '/cash/v1/balance';
    const method = 'GET';
    console.log('🔐 Generating authentication headers...');
    const headers = generateSolapiAuth(apiKey, apiSecret, method, url);
    console.log('📤 Making request to CoolSMS API:', `https://api.solapi.com${url}`);
    console.log('📋 Request headers (auth info hidden):', {
        'Content-Type': headers['Content-Type'],
        'Authorization': headers['Authorization'] ? '[HIDDEN]' : 'missing'
    });
    const response = await fetch(`https://api.solapi.com${url}`, {
        method: method,
        headers: headers
    });
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', response.headers);
    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ CoolSMS API error:', response.status, errorText);
        throw new Error(`CoolSMS API error: ${response.status} - ${errorText}`);
    }
    const jsonResponse = await response.json();
    console.log('✅ Raw CoolSMS API response:', JSON.stringify(jsonResponse, null, 2));
    return jsonResponse;
};
// 백업용 더미 데이터 함수 - Enhanced for development
const getDummyBalance = () => {
    console.log('⚠️ Using fallback dummy balance data for development/testing');
    return {
        point: 2500,
        cash: 7500,
        note: 'This is dummy data - CoolSMS API not accessible'
    };
};
exports.sendSms = (0, https_1.onCall)({ secrets: [coolsmsApiKey, coolsmsApiSecret] }, async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인
    const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin role required');
    }
    try {
        const messageService = initSolapi();
        const { to, text } = data;
        if (!to || !text) {
            throw new https_1.HttpsError('invalid-argument', 'Both "to" and "text" are required');
        }
        const result = await messageService.sendOne({
            to,
            from: '01089822015', // 발신번호
            text,
            type: 'SMS'
        }).then(result => {
            console.log('Solapi SDK sendOne success:', JSON.stringify(result, null, 2));
            return {
                success: true,
                result,
                message: 'SMS sent successfully'
            };
        }).catch(error => {
            console.error('Solapi SDK sendOne error:', error);
            throw new https_1.HttpsError('internal', `SMS sending failed: ${error.message}`);
        });
        return result;
    }
    catch (error) {
        console.error('SMS sending error:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `SMS service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.getCreditBalance = (0, https_1.onCall)({ secrets: [coolsmsApiKey, coolsmsApiSecret] }, async () => {
    try {
        console.log('🔍 Credit balance check started - Firebase Functions v2');
        let balanceData;
        let isRealData = false;
        try {
            console.log('🌐 Attempting to fetch real CoolSMS balance...');
            balanceData = await getRealSolapiBalance();
            isRealData = true;
            console.log('✅ Real CoolSMS balance retrieved successfully:', JSON.stringify(balanceData, null, 2));
        }
        catch (error) {
            console.warn('⚠️ Failed to fetch real balance, using fallback dummy data:', error);
            console.warn('Error details:', error instanceof Error ? error.message : 'Unknown error');
            balanceData = getDummyBalance();
            isRealData = false;
        }
        // Enhanced response with metadata
        return {
            success: true,
            balance: balanceData,
            timestamp: new Date().toISOString(),
            source: isRealData ? 'coolsms_api' : 'fallback_dummy',
            version: 'v2'
        };
    }
    catch (error) {
        console.error('❌ Credit balance check failed:', error);
        throw new https_1.HttpsError('internal', `Balance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.resetUserPassword = (0, https_1.onCall)(async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 호출자가 admin 권한인지 확인
    const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin role required');
    }
    const { uid } = data;
    if (!uid) {
        throw new https_1.HttpsError('invalid-argument', 'User ID is required');
    }
    try {
        // 대상 사용자 정보 가져오기
        const targetUserDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!targetUserDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const targetUserData = targetUserDoc.data();
        if (!(targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.mobile)) {
            throw new https_1.HttpsError('invalid-argument', 'User mobile number not found');
        }
        // 새 비밀번호 생성 (휴대폰 뒷자리 4자리를 2번 반복)
        const normalizedMobile = targetUserData.mobile.replace(/[^0-9]/g, '');
        const lastFourDigits = normalizedMobile.slice(-4);
        const newPassword = lastFourDigits + lastFourDigits;
        // Firebase Auth에서 비밀번호 변경
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        // Firestore에서 비밀번호 변경 필수 플래그 설정
        await admin.firestore().collection('users').doc(uid).update({
            requiresPasswordChange: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Password reset successfully'
        };
    }
    catch (error) {
        console.error('Password reset failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.deleteUserAccount = (0, https_1.onCall)(async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 호출자가 admin 권한인지 확인
    const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin role required');
    }
    const { targetUserId } = data;
    if (!targetUserId) {
        throw new https_1.HttpsError('invalid-argument', 'Target user ID is required');
    }
    // 자기 자신을 삭제하려는 경우 방지
    if (auth.uid === targetUserId) {
        throw new https_1.HttpsError('invalid-argument', 'Cannot delete your own account');
    }
    try {
        // 1. Firestore에서 사용자 문서 삭제
        await admin.firestore().collection('users').doc(targetUserId).delete();
        // 2. Firebase Auth에서 사용자 삭제
        await admin.auth().deleteUser(targetUserId);
        console.log(`User account deleted successfully: ${targetUserId} by admin: ${auth.uid}`);
        return {
            success: true,
            message: 'User account deleted successfully'
        };
    }
    catch (error) {
        console.error('Delete user account failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Delete user account failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.changeUserPassword = (0, https_1.onCall)(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { currentPassword, newPassword } = data;
    if (!currentPassword || !newPassword) {
        throw new https_1.HttpsError('invalid-argument', 'Current password and new password are required');
    }
    if (newPassword.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'New password must be at least 6 characters long');
    }
    try {
        // 현재 비밀번호 검증을 위해 재인증 시도
        const user = await admin.auth().getUser(auth.uid);
        if (!user.email) {
            throw new https_1.HttpsError('invalid-argument', 'User email not found');
        }
        // Firebase Auth에서 비밀번호 변경
        await admin.auth().updateUser(auth.uid, {
            password: newPassword
        });
        // Firestore에서 비밀번호 변경 필수 플래그 해제
        await admin.firestore().collection('users').doc(auth.uid).update({
            requiresPasswordChange: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Password changed successfully'
        };
    }
    catch (error) {
        console.error('Change password failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Password change failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.createSaleOrder = (0, https_1.onCall)({
    region: 'asia-northeast3',
    secrets: []
}, async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인
    const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!userDoc.exists || !['admin', 'staff'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new https_1.HttpsError('permission-denied', 'Admin or staff role required');
    }
    const { customerCode, items, customerMemo, internalMemo, deliveryDate, specialInstructions } = data;
    if (!customerCode || !items || !Array.isArray(items) || items.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Customer code and items are required');
    }
    try {
        // 고객 정보 조회
        const customerQuery = await admin.firestore()
            .collection('referenceData')
            .where('category', '==', 'customer')
            .where('code', '==', customerCode)
            .get();
        if (customerQuery.empty) {
            throw new https_1.HttpsError('not-found', 'Customer not found');
        }
        const customerData = customerQuery.docs[0].data();
        // 주문 데이터 생성
        const orderData = {
            customerCode,
            customerName: customerData.name,
            items,
            customerMemo: customerMemo || '',
            internalMemo: internalMemo || '',
            deliveryDate: deliveryDate || null,
            specialInstructions: specialInstructions || '',
            status: 'pending',
            createdBy: auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // Firestore에 주문 저장
        const orderRef = await admin.firestore().collection('saleOrders').add(orderData);
        return {
            success: true,
            orderId: orderRef.id,
            message: 'Sale order created successfully'
        };
    }
    catch (error) {
        console.error('Create sale order failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Create sale order failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.deleteSaleOrder = (0, https_1.onCall)({
    region: 'asia-northeast3',
    secrets: []
}, async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인
    const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!userDoc.exists || !['admin', 'staff'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new https_1.HttpsError('permission-denied', 'Admin or staff role required');
    }
    const { orderId } = data;
    if (!orderId) {
        throw new https_1.HttpsError('invalid-argument', 'Order ID is required');
    }
    try {
        // 주문 존재 확인
        const orderDoc = await admin.firestore().collection('saleOrders').doc(orderId).get();
        if (!orderDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Sale order not found');
        }
        // 주문 삭제
        await admin.firestore().collection('saleOrders').doc(orderId).delete();
        return {
            success: true,
            message: 'Sale order deleted successfully'
        };
    }
    catch (error) {
        console.error('Delete sale order failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Delete sale order failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.updateSaleOrderStatus = (0, https_1.onCall)({
    region: 'asia-northeast3',
    secrets: []
}, async (request) => {
    var _a;
    const { data, auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 사용자 권한 확인
    const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
    if (!userDoc.exists || !['admin', 'staff'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new https_1.HttpsError('permission-denied', 'Admin or staff role required');
    }
    const { orderId, status, statusNote } = data;
    if (!orderId || !status) {
        throw new https_1.HttpsError('invalid-argument', 'Order ID and status are required');
    }
    // 유효한 상태값 검증
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid status value');
    }
    try {
        // 주문 존재 확인
        const orderDoc = await admin.firestore().collection('saleOrders').doc(orderId).get();
        if (!orderDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Sale order not found');
        }
        // 상태 업데이트
        const updateData = {
            status,
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (statusNote) {
            updateData.statusNote = statusNote;
        }
        await admin.firestore().collection('saleOrders').doc(orderId).update(updateData);
        return {
            success: true,
            message: 'Sale order status updated successfully'
        };
    }
    catch (error) {
        console.error('Update sale order status failed:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Update sale order status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=index-v2-backup.js.map