// src/services/paymongo.service.ts
import crypto from 'crypto';

export interface PayMongoCustomerInfo {
  name?: string;
  email?: string;
  phone?: string;
}

export interface CreateCheckoutSessionParams {
  amount: number; // In PHP pesos (e.g., 1500.50)
  description: string;
  referenceNumber: string;
  customer?: PayMongoCustomerInfo;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
  paymentMethodTypes?: string[];
}

export interface PayMongoCheckoutResponse {
  id: string;
  checkoutUrl: string;
  status: string;
  referenceNumber?: string;
  payments?: any[];
  raw?: any;
}

export class PayMongoService {
  private static getApiBaseUrl(): string {
    return 'https://api.paymongo.com/v1';
  }

  public static getSecretKey(): string {
    return process.env.PAYMONGO_SECRET_KEY || '';
  }

  public static getPublicKey(): string {
    return process.env.PAYMONGO_PUBLIC_KEY || '';
  }

  public static getWebhookSecret(): string {
    return process.env.PAYMONGO_WEBHOOK_SECRET || '';
  }

  public static getEnvironment(): 'live' | 'test' {
    const key = this.getSecretKey();
    if (key.startsWith('sk_live_')) return 'live';
    if (key.startsWith('sk_test_')) return 'test';
    return (process.env.PAYMONGO_ENVIRONMENT as 'live' | 'test') || 'test';
  }

  private static getAuthHeader(): string {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error(
        'PayMongo Secret Key is not configured. Please set PAYMONGO_SECRET_KEY in your backend/.env file.'
      );
    }
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Tests connectivity and API key validity against PayMongo
   */
  public static async testConnection(): Promise<{
    configured: boolean;
    valid: boolean;
    environment: 'live' | 'test';
    message: string;
  }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      return {
        configured: false,
        valid: false,
        environment: 'test',
        message: 'PAYMONGO_SECRET_KEY is not set in environment variables.',
      };
    }

    try {
      const response = await fetch(`${this.getApiBaseUrl()}/webhooks`, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return {
          configured: true,
          valid: true,
          environment: this.getEnvironment(),
          message: `Successfully connected to PayMongo (${this.getEnvironment().toUpperCase()} mode).`,
        };
      }

      const errData = await response.json().catch(() => ({}));
      const errorMsg =
        errData.errors?.[0]?.detail ||
        errData.message ||
        `PayMongo API returned HTTP status ${response.status}`;
      return {
        configured: true,
        valid: false,
        environment: this.getEnvironment(),
        message: `PayMongo authentication failed: ${errorMsg}`,
      };
    } catch (error: any) {
      return {
        configured: true,
        valid: false,
        environment: this.getEnvironment(),
        message: `Network error connecting to PayMongo: ${error.message}`,
      };
    }
  }

  /**
   * Creates a hosted Checkout Session for GCash, Maya, Card, QR Ph, etc.
   */
  public static async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<PayMongoCheckoutResponse> {
    const {
      amount,
      description,
      referenceNumber,
      customer,
      successUrl,
      cancelUrl,
      metadata = {},
      paymentMethodTypes = ['card', 'gcash', 'paymaya', 'grab_pay', 'dob', 'billease', 'qrph'],
    } = params;

    // Convert PHP to centavos (smallest currency unit, min ₱20.00 = 2000 centavos)
    const amountInCentavos = Math.round(Math.max(amount, 20) * 100);

    const payload = {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              description: description,
              name: description.slice(0, 50),
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethodTypes,
          description: description,
          reference_number: referenceNumber,
          success_url: successUrl,
          cancel_url: cancelUrl,
          billing: customer
            ? {
                name: customer.name || 'Citizen Taxpayer',
                email: customer.email || 'citizen@gov.ph',
                phone: customer.phone || '09000000000',
              }
            : undefined,
          metadata: {
            ...metadata,
            system: 'Revenue & Treasury Management',
            referenceNumber,
          },
        },
      },
    };

    const response = await fetch(`${this.getApiBaseUrl()}/checkout_sessions`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.errors?.map((e: any) => e.detail || e.code).join(', ') ||
        'Failed to create PayMongo Checkout Session';
      console.error('❌ PayMongo Checkout Session Error:', data);
      throw new Error(`PayMongo API Error: ${errorMsg}`);
    }

    const sessionData = data.data;
    return {
      id: sessionData.id,
      checkoutUrl: sessionData.attributes.checkout_url,
      status: sessionData.attributes.status,
      referenceNumber: sessionData.attributes.reference_number,
      payments: sessionData.attributes.payments || [],
      raw: sessionData,
    };
  }

  /**
   * Retrieves a Checkout Session by ID from PayMongo
   */
  public static async retrieveCheckoutSession(sessionId: string): Promise<{
    id: string;
    status: 'active' | 'paid' | 'expired';
    paid: boolean;
    amount: number; // in PHP
    payments: Array<{
      id: string;
      attributes: {
        amount: number;
        status: string;
        source?: { type: string };
        paid_at?: number;
      };
    }>;
    referenceNumber?: string;
    metadata?: Record<string, any>;
    raw: any;
  }> {
    const response = await fetch(`${this.getApiBaseUrl()}/checkout_sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.errors?.map((e: any) => e.detail || e.code).join(', ') ||
        'Failed to retrieve PayMongo Checkout Session';
      throw new Error(`PayMongo API Error: ${errorMsg}`);
    }

    const attr = data.data.attributes;
    const payments = attr.payments || [];
    const isPaid =
      attr.status === 'paid' ||
      payments.some((p: any) => p.attributes?.status === 'paid');

    const totalPaidCentavos = payments.reduce(
      (sum: number, p: any) => sum + (p.attributes?.amount || 0),
      0
    );

    return {
      id: data.data.id,
      status: attr.status,
      paid: isPaid,
      amount: totalPaidCentavos > 0 ? totalPaidCentavos / 100 : (attr.line_items?.[0]?.amount || 0) / 100,
      payments: payments,
      referenceNumber: attr.reference_number,
      metadata: attr.metadata,
      raw: data.data,
    };
  }

  /**
   * Verifies incoming webhook signature from PayMongo
   */
  public static verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string
  ): boolean {
    const webhookSecret = this.getWebhookSecret();
    if (!webhookSecret || !signatureHeader) {
      return false;
    }

    try {
      // Signature header format: t=timestamp,te=test_signature,li=live_signature
      const parts = signatureHeader.split(',');
      let timestamp = '';
      let signature = '';

      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === 't') timestamp = v;
        if (k === 'li' || (k === 'te' && !signature)) signature = v;
      }

      if (!timestamp || !signature) return false;

      const payloadToSign = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadToSign)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (err) {
      console.error('Webhook signature verification error:', err);
      return false;
    }
  }
}
