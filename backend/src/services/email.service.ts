import dns from 'dns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Ensure IPv4 is resolved first to prevent timeout issues on IPv6-restricted cloud platforms (Railway, Docker, etc.)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore in environments where setDefaultResultOrder is not supported
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Send email via Brevo (formerly Sendinblue) HTTPS REST API (Port 443 - Never blocked on Railway)
   */
  private static async sendViaBrevo(
    apiKey: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    fromEmail: string,
    fromName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[EmailService] Dispatching email via Brevo HTTPS API to ${toEmail}...`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey.trim(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok) {
      const errMsg = data?.message || data?.code || JSON.stringify(data);
      throw new Error(`Brevo API HTTP ${response.status}: ${errMsg}`);
    }

    console.log(`[EmailService] Brevo email sent successfully! Message ID: ${data?.messageId || 'ok'}`);
    return { success: true, messageId: data?.messageId || 'brevo-sent' };
  }

  /**
   * Send email via Resend HTTPS REST API (Port 443 - Never blocked on Railway)
   */
  private static async sendViaResend(
    apiKey: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    fromAddress: string
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[EmailService] Dispatching email via Resend HTTPS API to ${toEmail}...`);

    // Ensure valid format for Resend: "Sender Name <sender@domain.com>" or "onboarding@resend.dev"
    let from = fromAddress.trim();
    if (!from.includes('@')) {
      from = 'GovServe Treasury <onboarding@resend.dev>';
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        html: htmlContent,
        text: textContent,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok) {
      const errMsg = data?.message || data?.error || JSON.stringify(data);
      throw new Error(`Resend API HTTP ${response.status}: ${errMsg}`);
    }

    console.log(`[EmailService] Resend email sent successfully! ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  }

  /**
   * Send email via SendGrid HTTPS REST API (Port 443 - Never blocked on Railway)
   */
  private static async sendViaSendGrid(
    apiKey: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    fromEmail: string,
    fromName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[EmailService] Dispatching email via SendGrid HTTPS API to ${toEmail}...`);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: textContent },
          { type: 'text/html', value: htmlContent },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API HTTP ${response.status}: ${errorText}`);
    }

    console.log(`[EmailService] SendGrid email sent successfully!`);
    return { success: true, messageId: 'sendgrid-sent' };
  }

  /**
   * Helper to create a nodemailer transporter instance with given configuration
   */
  private static createTransporterInstance(
    host: string,
    port: number,
    secure: boolean,
    user: string,
    pass: string
  ): Transporter {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      requireTLS: !secure && (port === 587 || port === 2525),
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    });
  }

  private static getTransporter(): Transporter {
    if (!this.transporter) {
      const user = (process.env.SMTP_USER || '').trim();
      const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');

      if (!user) {
        throw new Error('SMTP_USER is not configured.');
      }

      if (!pass) {
        throw new Error('SMTP_PASS is not configured.');
      }

      const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const port = Number(process.env.SMTP_PORT || '465');

      let secure = port === 465;
      if (process.env.SMTP_SECURE !== undefined) {
        if (port === 587) {
          secure = false;
        } else if (port === 465) {
          secure = true;
        } else {
          secure = process.env.SMTP_SECURE === 'true';
        }
      }

      console.log(
        `[EmailService] Initializing SMTP transporter -> Host: ${host}, Port: ${port}, Secure: ${secure}`
      );

      this.transporter = this.createTransporterInstance(
        host,
        port,
        secure,
        user,
        pass
      );
    }

    return this.transporter;
  }

  /**
   * Verify email service connectivity (supports HTTPS APIs and SMTP)
   */
  public static async verifyConnection(): Promise<boolean> {
    const brevoKey = process.env.BREVO_API_KEY?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

    if (brevoKey) {
      console.log('✅ EmailService: Configured with Brevo HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (resendKey) {
      console.log('✅ EmailService: Configured with Resend HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (sendgridKey) {
      console.log('✅ EmailService: Configured with SendGrid HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (process.env.DEV_OTP_CONSOLE === 'true' || process.env.BYPASS_EMAIL === 'true') {
      console.log('⚡ EmailService: DEV_OTP_CONSOLE mode is ACTIVE. OTPs will be printed in server logs.');
      return true;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log('✅ Nodemailer SMTP verification successful.');
      return true;
    } catch (error: any) {
      console.warn(
        `⚠️ SMTP verification failed (${error?.message || error}). Note: Railway blocks outbound SMTP ports 25, 465, and 587. If running on Railway, add BREVO_API_KEY or RESEND_API_KEY in Railway Variables.`
      );
      return false;
    }
  }

  /**
   * Send a 6-digit OTP verification email.
   * Prioritizes HTTPS REST APIs (Brevo, Resend, SendGrid) over Port 443 to guarantee 100% reliability on Railway,
   * with fallback to SMTP or development console output.
   */
  public static async sendOtpEmail(
    toEmail: string,
    otp: string,
    purpose: 'REGISTER' | 'LOGIN'
  ): Promise<{ success: boolean; messageId?: string }> {
    const actionTitle =
      purpose === 'LOGIN'
        ? 'Sign-In Authentication'
        : 'Account Registration';

    const actionSubtitle =
      purpose === 'LOGIN'
        ? 'sign in to your GovServe Treasury account'
        : 'complete your citizen registration';

    // 1. Check for Development Console Mode (Instant bypass for development/testing)
    if (process.env.DEV_OTP_CONSOLE === 'true' || process.env.BYPASS_EMAIL === 'true') {
      console.log(`\n======================================================`);
      console.log(`🔑 [DEV_OTP_CONSOLE] ${purpose} OTP for ${toEmail}: ${otp}`);
      console.log(`======================================================\n`);
      return { success: true, messageId: `dev-console-${Date.now()}` };
    }

    const rawFrom = process.env.SMTP_FROM || 'GovServe Treasury <govserve.treasury@gmail.com>';
    const userEmail = (process.env.SMTP_USER || 'govserve.treasury@gmail.com').trim();
    const fromName = 'GovServe Treasury';
    const fromEmail = rawFrom.includes('<')
      ? (rawFrom.match(/<([^>]+)>/)?.[1] || userEmail)
      : (rawFrom.includes('@') ? rawFrom : userEmail);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GovServe Treasury Verification Code</title>
</head>
<body
  style="
    margin:0;
    padding:24px;
    background-color:#f8fafc;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color:#1e293b;
  "
>
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table
          width="100%"
          border="0"
          cellspacing="0"
          cellpadding="0"
          style="
            max-width:520px;
            background-color:#ffffff;
            border-radius:20px;
            overflow:hidden;
            border:1px solid #e2e8f0;
            box-shadow:0 4px 20px rgba(0,0,0,0.05);
          "
        >
          <!-- HEADER -->
          <tr>
            <td
              style="
                background-color:#0B3B60;
                padding:28px 24px;
                text-align:center;
              "
            >
              <div
                style="
                  color:#ffffff;
                  font-size:22px;
                  font-weight:800;
                "
              >
                GovServe Treasury
              </div>
              <div
                style="
                  color:#93c5fd;
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:1.2px;
                  text-transform:uppercase;
                  margin-top:6px;
                "
              >
                Republic of the Philippines • Local Government Unit
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px 28px;">
              <div
                style="
                  font-size:16px;
                  font-weight:700;
                  color:#0f172a;
                  margin-bottom:8px;
                "
              >
                ${actionTitle}
              </div>
              <div
                style="
                  font-size:13px;
                  color:#475569;
                  line-height:1.6;
                  margin-bottom:24px;
                "
              >
                You recently requested to ${actionSubtitle}.
                Please use the one-time verification code below:
              </div>

              <!-- OTP -->
              <div
                style="
                  background-color:#f1f5f9;
                  border:2px dashed #cbd5e1;
                  border-radius:16px;
                  padding:20px;
                  text-align:center;
                  margin-bottom:24px;
                "
              >
                <div
                  style="
                    font-size:11px;
                    font-weight:700;
                    color:#64748b;
                    text-transform:uppercase;
                    letter-spacing:1px;
                    margin-bottom:6px;
                  "
                >
                  Your One-Time Verification Code
                </div>
                <div
                  style="
                    font-family:'Courier New',Courier,monospace;
                    font-size:36px;
                    font-weight:900;
                    letter-spacing:10px;
                    color:#0B3B60;
                    padding:4px 0;
                  "
                >
                  ${otp}
                </div>
              </div>

              <!-- WARNING -->
              <table
                width="100%"
                border="0"
                cellspacing="0"
                cellpadding="0"
                style="margin-bottom:24px;"
              >
                <tr>
                  <td
                    style="
                      padding:10px 14px;
                      background-color:#fef2f2;
                      border-left:4px solid #ef4444;
                      border-radius:8px;
                    "
                  >
                    <div
                      style="
                        font-size:12px;
                        font-weight:700;
                        color:#991b1b;
                      "
                    >
                      ⏱️ This code expires in 5 minutes.
                    </div>
                    <div
                      style="
                        font-size:12px;
                        color:#b91c1c;
                        margin-top:2px;
                      "
                    >
                      Do not share this code with anyone,
                      including government personnel.
                    </div>
                  </td>
                </tr>
              </table>

              <div
                style="
                  font-size:12px;
                  color:#64748b;
                  line-height:1.5;
                "
              >
                If you did not make this request, please ignore this email
                or contact the Municipal Treasury security team.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              style="
                background-color:#f8fafc;
                padding:18px 24px;
                text-align:center;
                border-top:1px solid #e2e8f0;
              "
            >
              <div
                style="
                  font-size:11px;
                  color:#94a3b8;
                "
              >
                &copy; ${new Date().getFullYear()}
                GovServe Revenue & Treasury Management System.
                All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textContent = `
GovServe Treasury - Republic of the Philippines

Your verification code is: ${otp}

This code expires in 5 minutes.

Do not share this code with anyone.

Purpose: ${actionTitle}
`;

    const subject = `${otp} is your GovServe Treasury verification code`;

    // 2. Try Brevo HTTPS REST API (Port 443 - Recommended for Railway)
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    if (brevoApiKey) {
      try {
        return await this.sendViaBrevo(
          brevoApiKey,
          toEmail,
          subject,
          htmlContent,
          textContent,
          fromEmail,
          fromName
        );
      } catch (brevoErr: any) {
        console.error('[EmailService] Brevo HTTPS dispatch failed:', brevoErr?.message || brevoErr);
        throw new Error(
          `Failed to send verification email: ${brevoErr?.message || 'Brevo API Error'}`
        );
      }
    }

    // 3. Try Resend HTTPS REST API (Port 443 - Recommended for Railway)
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) {
      try {
        return await this.sendViaResend(
          resendApiKey,
          toEmail,
          subject,
          htmlContent,
          textContent,
          rawFrom
        );
      } catch (resendErr: any) {
        console.error('[EmailService] Resend HTTPS dispatch failed:', resendErr?.message || resendErr);
        throw new Error(
          `Failed to send verification email: ${resendErr?.message || 'Resend API Error'}`
        );
      }
    }

    // 4. Try SendGrid HTTPS REST API (Port 443)
    const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim();
    if (sendgridApiKey) {
      try {
        return await this.sendViaSendGrid(
          sendgridApiKey,
          toEmail,
          subject,
          htmlContent,
          textContent,
          fromEmail,
          fromName
        );
      } catch (sendgridErr: any) {
        console.error('[EmailService] SendGrid HTTPS dispatch failed:', sendgridErr?.message || sendgridErr);
        throw new Error(
          `Failed to send verification email: ${sendgridErr?.message || 'SendGrid API Error'}`
        );
      }
    }

    // 5. Fallback to SMTP / Nodemailer (Works on local machine or unblocked hosts)
    const user = (process.env.SMTP_USER || 'govserve.treasury@gmail.com').trim();
    const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const configuredPort = Number(process.env.SMTP_PORT || '465');

    const mailPayload = {
      from: rawFrom,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      const transporter = this.getTransporter();
      console.log(`[EmailService] Attempting SMTP send to ${toEmail}...`);

      const info = await transporter.sendMail(mailPayload);
      console.log(`[EmailService] OTP email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (primaryError: any) {
      console.warn(
        `[EmailService] Primary SMTP attempt failed for ${toEmail} (${primaryError?.message || primaryError}). Attempting fallback port...`
      );

      // Attempt fallback between port 465 and 587
      try {
        const fallbackPort = configuredPort === 465 ? 587 : 465;
        const fallbackSecure = fallbackPort === 465;

        const fallbackTransporter = this.createTransporterInstance(
          host,
          fallbackPort,
          fallbackSecure,
          user,
          pass
        );

        console.log(
          `[EmailService] Retrying send via fallback SMTP on ${host}:${fallbackPort} (secure: ${fallbackSecure})...`
        );

        const fallbackInfo = await fallbackTransporter.sendMail(mailPayload);
        this.transporter = fallbackTransporter;

        console.log(
          `[EmailService] OTP email sent successfully via fallback port ${fallbackPort} to ${toEmail}. Message ID: ${fallbackInfo.messageId}`
        );

        return {
          success: true,
          messageId: fallbackInfo.messageId,
        };
      } catch (fallbackError: any) {
        console.error(
          `[EmailService] Fallback SMTP attempt failed for ${toEmail}:`,
          fallbackError?.message || fallbackError
        );

        this.transporter = null;

        const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL);
        const railwayHelp = isRailway || String(fallbackError?.message || '').includes('timeout')
          ? ' (Note: Railway blocks outbound SMTP ports 25, 465, and 587. Please add BREVO_API_KEY or RESEND_API_KEY in Railway Variables to use HTTPS over Port 443).'
          : '';

        throw new Error(
          `Failed to send verification email: ${
            fallbackError?.message || primaryError?.message || 'Connection timeout'
          }${railwayHelp}`
        );
      }
    }
  }
}