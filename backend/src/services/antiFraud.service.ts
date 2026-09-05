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
  isReview?: boolean;
  reason?: string;
  raw?: any;
}

export class AntiFraudService {
  private static getApiKey(): string {
    return process.env.ANTI_FRAUD_API_KEY || '';
  }

  /**
   * Hard-block threshold: score must meet/exceed this AND FraudLabs status must be REJECT.
   * Raised from 70 to 90 to prevent false positives on legitimate government service users.
   * Override via env: ANTI_FRAUD_SCORE_THRESHOLD
   */
  private static getThreshold(): number {
    return parseInt(process.env.ANTI_FRAUD_SCORE_THRESHOLD || '90', 10);
  }

  /**
   * Review (soft-flag) threshold: scores between this and the hard-block threshold
   * are logged and flagged for review but are NOT blocked.
   * Override via env: ANTI_FRAUD_REVIEW_THRESHOLD
   */
  private static getReviewThreshold(): number {
    return parseInt(process.env.ANTI_FRAUD_REVIEW_THRESHOLD || '75', 10);
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
   *
   * Blocking logic (requires BOTH conditions to hard-block):
   *   1. score >= hard-block threshold (default 90)
   *   2. FraudLabs status is explicitly "REJECT"
   *
   * This dual-condition approach prevents false positives from scoring alone,
   * since many legitimate first-time government service users score 60-80.
   *
   * If the API key is not set, the check is bypassed (allow-open).
   */
  public static async evaluateRisk(params: FraudCheckParams): Promise<FraudCheckResult> {
    const apiKey = this.getApiKey();
    const threshold = this.getThreshold();
    const reviewThreshold = this.getReviewThreshold();

    if (!apiKey) {
      console.warn('No ANTI_FRAUD_API_KEY provided. Anti-fraud checks are bypassed.');
      return {
        score: 0,
        isFraud: false,
        isReview: false,
        reason: 'API Key Missing (Bypassed)',
      };
    }

    try {
      const url = new URL('https://api.fraudlabspro.com/v1/order/screen');
      url.searchParams.append('key', apiKey);
      url.searchParams.append('format', 'json');
      url.searchParams.append('currency', params.currency || 'PHP');

      // FraudLabs Pro requires a valid public IP format.
      // If client IP is local/private/loopback, skip it to avoid incorrect scoring.
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
        // API errors - fail open (do not block legitimate users due to API issues)
        return { score: 0, isFraud: false, isReview: false, reason: `API Error: ${data.fraudlabspro_message}`, raw: data };
      }

      const score = parseInt(String(data.fraudlabspro_score || '0'), 10);
      const status = data.fraudlabspro_status; // "APPROVE", "REVIEW", "REJECT"

      console.log(
        `[AntiFraud] Result for ${params.email}: score=${score}, status=${status}, blockThreshold=${threshold}, reviewThreshold=${reviewThreshold}`
      );

      // Hard-block: score must be very high AND FraudLabs explicitly says REJECT.
      // Dual-condition to minimize false positives on government service citizens.
      const isFraud = score >= threshold && status === 'REJECT';

      // Soft-flag: medium risk - log but allow through
      const isReview = !isFraud && (score >= reviewThreshold || status === 'REVIEW');

      if (isFraud) {
        console.warn(`[AntiFraud] BLOCKED - score=${score}, status=${status}`);
      } else if (isReview) {
        console.warn(`[AntiFraud] REVIEW FLAG - score=${score}, status=${status} (allowed through)`);
      }

      return {
        score,
        isFraud,
        isReview,
        reason: isFraud
          ? `Risk score ${score} exceeds block threshold ${threshold} with status REJECT`
          : isReview
          ? `Risk score ${score} flagged for review (status: ${status}) - allowed through`
          : `Risk score ${score} is within acceptable range (status: ${status})`,
        raw: data,
      };
    } catch (error: any) {
      console.error('Anti-fraud check failed:', error.message);
      // Fail open if API is unreachable - do not block legitimate users
      return {
        score: 0,
        isFraud: false,
        isReview: false,
        reason: 'Service Unreachable (Fail-Open)',
      };
    }
  }
}
