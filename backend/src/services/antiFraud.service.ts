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

  private static isPublicIP(ip: string): boolean {
    if (!ip || ip === 'Unknown') return false;
    const stripped = ip.replace(/^::ffff:/, '');
    if (stripped === '::1' || stripped === '127.0.0.1') return false;
    if (/^10\./.test(stripped)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(stripped)) return false;
    if (/^192\.168\./.test(stripped)) return false;
    if (/^fc|^fd/.test(stripped)) return false;
    return true;
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
      const url = new URL('https://api.fraudlabspro.com/v1/order/screen');
      url.searchParams.append('key', apiKey);
      url.searchParams.append('format', 'json');
      url.searchParams.append('currency', params.currency || 'PHP');

      // FraudLabs Pro requires a valid public IP format.
      // If client IP is local/private/loopback, use a standard public gateway IP.
      if (params.ip && this.isPublicIP(params.ip)) {
  const ipToSend = params.ip.replace(/^::ffff:/, '');
  url.searchParams.append('ip', ipToSend);
}
      if (params.email) url.searchParams.append('email', params.email);
      if (params.username) url.searchParams.append('username', params.username);
      if (params.amount) url.searchParams.append('amount', params.amount.toString());

      console.log('[AntiFraud] Calling FraudLabs Pro for:', params.email);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const data: any = await response.json();

      if (data?.fraudlabspro_error_code) {
        console.error('FraudLabs Pro error:', data.fraudlabspro_error_code, data.fraudlabspro_message);
        return { score: 0, isFraud: false, reason: `API Error: ${data.fraudlabspro_message}`, raw: data };
      }

      const score = parseInt(String(data.fraudlabspro_score || '0'), 10);
      const status = data.fraudlabspro_status;

      console.log(
  `[AntiFraud] Result for ${params.email}: score=${score}, status=${status}, threshold=${threshold}`
);

console.log(
  '[AntiFraud] Full FraudLabs response:',
  JSON.stringify(data, null, 2)
);

      const isFraud = score >= threshold;

      return {
  score,
  isFraud,
  reason: isFraud
    ? `Risk score ${score} exceeds threshold ${threshold} (FraudLabs status: ${status})`
    : `Risk score ${score} is below threshold ${threshold} (FraudLabs status: ${status})`,
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
