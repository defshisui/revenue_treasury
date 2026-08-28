export interface FraudCheckParams {
  ip?: string;
  email?: string;
  username?: string;
  amount?: number;
  currency?: string;
}

export interface FraudCheckResult {
  score: number;
  isFraud: boolean;
  reason?: string;
  raw?: any;
}

export class AntiFraudService {
  private static getApiKey(): string {
    return process.env.ANTI_FRAUD_API_KEY || '';
  }

  private static getThreshold(): number {
    return parseInt(process.env.ANTI_FRAUD_SCORE_THRESHOLD || '70', 10);
  }

  /**
   * Evaluates the risk of a given action using FraudLabs Pro API.
   * If the API key is not set, it falls back to a mock evaluation.
   */
  public static async evaluateRisk(params: FraudCheckParams): Promise<FraudCheckResult> {
    const apiKey = this.getApiKey();
    const threshold = this.getThreshold();

    if (!apiKey) {
      console.warn('⚠️ No ANTI_FRAUD_API_KEY provided. Anti-fraud checks are bypassed.');
      return {
        score: 0,
        isFraud: false,
        reason: 'API Key Missing (Bypassed)',
      };
    }

    try {
      // FraudLabs Pro Fraud Prevention API (REST)
      // Documentation: https://www.fraudlabspro.com/developer/api/screen-order
      const url = new URL('https://api.fraudlabspro.com/v2/order/screen');
      url.searchParams.append('key', apiKey);
      url.searchParams.append('format', 'json');
      
      if (params.ip) url.searchParams.append('ip', params.ip);
      if (params.email) url.searchParams.append('email', params.email);
      if (params.amount) url.searchParams.append('amount', params.amount.toString());
      if (params.username) url.searchParams.append('username', params.username);
      url.searchParams.append('currency', params.currency || 'PHP');

      const response = await fetch(url.toString(), {
        method: 'POST',
      });

      const data: any = await response.json();

      if (!response.ok) {
        console.error('FraudLabs Pro API error:', data);
        // Fall open (allow) if the API fails, so we don't block legitimate users
        return {
          score: 0,
          isFraud: false,
          reason: 'API Error',
          raw: data
        };
      }

      const score = parseInt(data.fraudlabspro_score || '0', 10);
      const status = data.fraudlabspro_status; // 'APPROVE', 'REVIEW', 'REJECT'

      const isFraud = score >= threshold || status === 'REJECT';

      return {
        score,
        isFraud,
        reason: isFraud ? `Risk score ${score} exceeds threshold ${threshold}` : undefined,
        raw: data,
      };
    } catch (error: any) {
      console.error('Anti-fraud check failed:', error.message);
      // Fall open if API is unreachable
      return {
        score: 0,
        isFraud: false,
        reason: 'Service Unreachable'
      };
    }
  }
}
