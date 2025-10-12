"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVoice = exports.sendRcs = exports.sendFriendtalk = exports.sendAlimtalk = exports.getStatistics = exports.sendBulkSms = exports.getBalance = exports.sendSms = exports.deleteUserAccount = exports.changeUserPassword = exports.resetUserPassword = exports.createUserAccount = void 0;
const app_1 = require("firebase-admin/app");
// Firebase Admin 초기화
(0, app_1.initializeApp)();
// 사용자 관리 Functions
var createUserAccount_1 = require("./user/createUserAccount");
Object.defineProperty(exports, "createUserAccount", { enumerable: true, get: function () { return createUserAccount_1.createUserAccount; } });
var resetUserPassword_1 = require("./user/resetUserPassword");
Object.defineProperty(exports, "resetUserPassword", { enumerable: true, get: function () { return resetUserPassword_1.resetUserPassword; } });
var changeUserPassword_1 = require("./user/changeUserPassword");
Object.defineProperty(exports, "changeUserPassword", { enumerable: true, get: function () { return changeUserPassword_1.changeUserPassword; } });
var deleteUserAccount_1 = require("./user/deleteUserAccount");
Object.defineProperty(exports, "deleteUserAccount", { enumerable: true, get: function () { return deleteUserAccount_1.deleteUserAccount; } });
// SMS 관련 Functions - SOLAPI v5.5.2 Upgraded
var sendSms_1 = require("./sms/sendSms");
Object.defineProperty(exports, "sendSms", { enumerable: true, get: function () { return sendSms_1.sendSms; } });
var getBalance_1 = require("./sms/getBalance");
Object.defineProperty(exports, "getBalance", { enumerable: true, get: function () { return getBalance_1.getBalance; } });
var sendBulkSms_1 = require("./sms/sendBulkSms");
Object.defineProperty(exports, "sendBulkSms", { enumerable: true, get: function () { return sendBulkSms_1.sendBulkSms; } });
var getStatistics_1 = require("./sms/getStatistics");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return getStatistics_1.getStatistics; } });
// 카카오톡 메시징 Functions
var sendAlimtalk_1 = require("./kakao/sendAlimtalk");
Object.defineProperty(exports, "sendAlimtalk", { enumerable: true, get: function () { return sendAlimtalk_1.sendAlimtalk; } });
var sendFriendtalk_1 = require("./kakao/sendFriendtalk");
Object.defineProperty(exports, "sendFriendtalk", { enumerable: true, get: function () { return sendFriendtalk_1.sendFriendtalk; } });
// RCS 메시징 Functions
var sendRcs_1 = require("./rcs/sendRcs");
Object.defineProperty(exports, "sendRcs", { enumerable: true, get: function () { return sendRcs_1.sendRcs; } });
// 음성 메시징 Functions
var sendVoice_1 = require("./voice/sendVoice");
Object.defineProperty(exports, "sendVoice", { enumerable: true, get: function () { return sendVoice_1.sendVoice; } });
//# sourceMappingURL=index.js.map