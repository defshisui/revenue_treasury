// src/services/paymongoService.ts
import { API_BASE_URL } from '../config/api';

export interface PayMongoStatusResponse {
  success: boolean;
  configured: boolean;
  valid: boolean;
  environment: 'live' | 'test';
  message: string;
  keys?: {
    hasSecretKey: boolean;
    publicKey: string;
    hasWebhookSecret: boolean;
  };
}

export interface CreateCheckoutParams {
  type: 'RPT' | 'MARKET_STALL' | 'BUSINESS_TAX' | 'CUSTOM';
  amount: number;
  taxDeclarationNumber?: string;
  rptRecordId?: string | number;
  leaseId?: string;
  businessTrackingNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}

export interface CheckoutResult {
  success: boolean;
  checkoutUrl: string;
  sessionId: string;
  referenceNumber: string;
  environment: 'live' | 'test';
}

export interface VerifyPaymentResult {
  success: boolean;
  paid: boolean;
  alreadyRecorded?: boolean;
  officialReceiptNumber?: string;
  paymentReference?: string;
  amount?: number;
  paymentMethod?: string;
  paymentDate?: string;
  message?: string;
}

/**
 * Checks connectivity and API key status from the backend
 */
export async function getPayMongoStatus(): Promise<PayMongoStatusResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/paymongo/status`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      valid: false,
      environment: 'test',
      message: err.message || 'Failed to connect to backend PayMongo status endpoint',
    };
  }
}

/**
 * Creates a PayMongo Checkout Session and returns checkout URL for redirection
 */
export async function createPayMongoCheckout(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const payload = {
    ...params,
    frontendRedirectUrl: window.location.origin,
  };

  const response = await fetch(`${API_BASE_URL}/api/payments/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || 'Failed to initiate PayMongo checkout session.');
  }

  return data;
}

/**
 * Verifies if a PayMongo session was successfully paid and registers the Official Receipt
 */
export async function verifyPayMongoSession(
  sessionId: string
): Promise<VerifyPaymentResult> {
  const response = await fetch(`${API_BASE_URL}/api/payments/verify-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to verify PayMongo payment session.');
  }

  return data;
}
