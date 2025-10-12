import { initializeApp } from 'firebase-admin/app';

// Firebase Admin 초기화
initializeApp();

// 사용자 관리 Functions
export { createUserAccount } from './user/createUserAccount';
export { resetUserPassword } from './user/resetUserPassword';
export { changeUserPassword } from './user/changeUserPassword';
export { deleteUserAccount } from './user/deleteUserAccount';

// SMS 관련 Functions - SOLAPI v5.5.2 Upgraded
export { sendSms } from './sms/sendSms';
export { getBalance } from './sms/getBalance';
export { sendBulkSms } from './sms/sendBulkSms';
export { getStatistics } from './sms/getStatistics';

// 카카오톡 메시징 Functions
export { sendAlimtalk } from './kakao/sendAlimtalk';
export { sendFriendtalk } from './kakao/sendFriendtalk';

// RCS 메시징 Functions
export { sendRcs } from './rcs/sendRcs';

// 음성 메시징 Functions
export { sendVoice } from './voice/sendVoice';