/**
 * SMS 관련 타입 정의
 * 작성 날짜: 2025-09-23
 */

export interface SMSMessage {
  id?: string;
  to: string;
  from?: string;
  message: string;
  type: SMSType;
  status: SMSStatus;
  createdAt: Date;
  sentAt?: Date;
  failReason?: string;
  cost?: number;
}

export interface SMSSendRequest {
  to: string | string[];
  message: string;
  type?: SMSType;
  from?: string;
  reservedAt?: Date;
}

export interface SMSSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

export interface SMSBalance {
  balance: number;
  currency: string;
  lastUpdated: Date;
}

export interface SMSUsageStats {
  totalSent: number;
  totalCost: number;
  successRate: number;
  period: {
    start: Date;
    end: Date;
  };
  breakdown: {
    sms: number;
    lms: number;
    mms: number;
  };
}

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  type: SMSType;
  variables: string[];
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSProvider {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface SMSRecipient {
  phoneNumber: string;
  name?: string;
  customerType?: string;
}

export type SMSType = 'SMS' | 'LMS' | 'MMS';

export type SMSStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type SMSEventType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_received'
  | 'custom';