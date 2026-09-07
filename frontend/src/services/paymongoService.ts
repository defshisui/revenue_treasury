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



export interface CreateQrPaymentIntentParams {
  amount: number;
  type?: 'RPT' | 'RPT_SERVICE' | 'MARKET_STALL' | 'BUSINESS_TAX' | 'CUSTOM';
  leaseId?: string;
  businessTrackingNumber?: string;
  taxDeclarationNumber?: string;
  rptRecordId?: string | number;
  rptApplicationId?: string | number;
  customerName?: string;
  customerEmail?: string;
  description?: string;
}

export interface QrPaymentIntentResult {
  success: boolean;
  paymentIntentId: string;
  clientKey: string;
  publicKey: string;
  amount: number;
  referenceNumber: string;
  status: string;
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
      message:
        err.message ||
        'Failed to connect to backend PayMongo status endpoint',
    };
  }
}


export async function createPayMongoCheckout(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const payload = {
    ...params,
    frontendRedirectUrl: window.location.origin,
  };

  const response = await fetch(
    `${API_BASE_URL}/api/payments/create-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ||
      data.message ||
      'Failed to initiate PayMongo checkout session.'
    );
  }

  return data;
}


export async function createPayMongoQrPaymentIntent(
  params: CreateQrPaymentIntentParams
): Promise<QrPaymentIntentResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/payments/create-qr-payment-intent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ||
      data.message ||
      'Failed to create PayMongo QR Ph Payment Intent.'
    );
  }

  return {
    success: data.success,
    paymentIntentId: data.paymentIntentId,
    clientKey: data.clientKey,
    publicKey: data.publicKey,
    amount: data.amount,
    referenceNumber: data.referenceNumber,
    status: data.status,
  };
}


export async function createQrPhPaymentMethod(
  publicKey: string,
  expirySeconds: number = 300
): Promise<string> {
  if (!publicKey) {
    throw new Error('PayMongo public key is missing.');
  }

  const encodedKey = btoa(`${publicKey}:`);

  const response = await fetch(
    'https://api.paymongo.com/v1/payment_methods',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodedKey}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: 'qrph',
            expiry_seconds: Math.min(9000, Math.max(60, Math.round(expirySeconds))),
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.data?.id) {
    const errorMessage =
      data.errors
        ?.map((error: any) => error.detail || error.code)
        .join(', ') ||
      'Failed to create QR Ph Payment Method.';

    console.error('PayMongo QR Ph Payment Method error:', data);

    throw new Error(errorMessage);
  }

  return data.data.id;
}


export async function attachQrPhPaymentMethod(
  paymentIntentId: string,
  paymentMethodId: string,
  clientKey: string,
  publicKey: string
): Promise<any> {
  if (!paymentIntentId) {
    throw new Error('Payment Intent ID is missing.');
  }

  if (!paymentMethodId) {
    throw new Error('Payment Method ID is missing.');
  }

  if (!clientKey) {
    throw new Error('Payment Intent client key is missing.');
  }

  if (!publicKey) {
    throw new Error('PayMongo public key is missing.');
  }

  const encodedKey = btoa(`${publicKey}:`);

  const response = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodedKey}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: paymentMethodId,
            client_key: clientKey,
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data.errors
        ?.map((error: any) => error.detail || error.code)
        .join(', ') ||
      'Failed to attach QR Ph Payment Method.';

    console.error('PayMongo QR Ph attach error:', data);

    throw new Error(errorMessage);
  }

  return data.data;
}


export async function verifyPayMongoSession(
  sessionId: string
): Promise<VerifyPaymentResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/payments/verify-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      'Failed to verify PayMongo payment session.'
    );
  }

  return data;
}