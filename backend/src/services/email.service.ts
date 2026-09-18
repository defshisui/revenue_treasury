import dns from 'dns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';


try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {

}

export class EmailService {
  private static transporter: Transporter | null = null;


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


  private static async sendViaResend(
    apiKey: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    fromAddress: string
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[EmailService] Dispatching email via Resend HTTPS API to ${toEmail}...`);


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


  public static async verifyConnection(): Promise<boolean> {
    const brevoKey = process.env.BREVO_API_KEY?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

    if (brevoKey) {
      console.log('EmailService: Configured with Brevo HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (resendKey) {
      console.log('EmailService: Configured with Resend HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (sendgridKey) {
      console.log('EmailService: Configured with SendGrid HTTPS API (Port 443, Railway-ready).');
      return true;
    }

    if (process.env.DEV_OTP_CONSOLE === 'true' || process.env.BYPASS_EMAIL === 'true') {
      console.log('EmailService: DEV_OTP_CONSOLE mode is ACTIVE. OTPs will be printed in server logs.');
      return true;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log('Nodemailer SMTP verification successful.');
      return true;
    } catch (error: any) {
      console.warn(
        ` SMTP verification failed (${error?.message || error}). Note: Railway blocks outbound SMTP ports 25, 465, and 587. If running on Railway, add BREVO_API_KEY or RESEND_API_KEY in Railway Variables.`
      );
      return false;
    }
  }


  public static async sendOtpEmail(
    toEmail: string,
    otp: string,
    purpose: 'REGISTER' | 'LOGIN' | 'FORGOT_PASSWORD'
  ): Promise<{ success: boolean; messageId?: string }> {
    const actionTitle =
      purpose === 'LOGIN'
        ? 'Sign-In Authentication'
        : purpose === 'FORGOT_PASSWORD'
          ? 'Password Reset Request'
          : 'Account Registration';

    const actionSubtitle =
      purpose === 'LOGIN'
        ? 'sign in to your GovServe Treasury account'
        : purpose === 'FORGOT_PASSWORD'
          ? 'reset your GovServe Treasury account password'
          : 'complete your citizen registration';


    if (process.env.DEV_OTP_CONSOLE === 'true' || process.env.BYPASS_EMAIL === 'true') {
      console.log(`\n======================================================`);
      console.log(` [DEV_OTP_CONSOLE] ${purpose} OTP for ${toEmail}: ${otp}`);
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
                Republic of the Philippines - Local Government Unit
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
                       This code expires in 1 minutes.
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
          `Failed to send verification email: ${fallbackError?.message || primaryError?.message || 'Connection timeout'
          }${railwayHelp}`
        );
      }
    }
  }


  public static async sendPaymentReceiptEmail(params: {
    toEmail: string;
    customerName?: string;
    service: string;
    amount: number;
    paymentMethod: string;
    paymentReference: string;
    officialReceiptNumber: string;
    paymentDate?: Date | string;
    accountReference?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const {
      toEmail,
      customerName,
      service,
      amount,
      paymentMethod,
      paymentReference,
      officialReceiptNumber,
      paymentDate,
      accountReference,
    } = params;

    if (!toEmail || !toEmail.includes('@')) {
      throw new Error('A valid recipient email address is required.');
    }

    const rawFrom =
      process.env.SMTP_FROM ||
      'GovServe Treasury <govserve.treasury@gmail.com>';

    const userEmail =
      (process.env.SMTP_USER || 'govserve.treasury@gmail.com').trim();

    const fromName = 'GovServe Treasury';

    const fromEmail = rawFrom.includes('<')
      ? (rawFrom.match(/<([^>]+)>/)?.[1] || userEmail)
      : (rawFrom.includes('@') ? rawFrom : userEmail);

    const esc = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const numericAmount = Number(amount || 0);

    const amountText = `₱${numericAmount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const formattedDate = paymentDate
      ? new Date(paymentDate).toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

    const subject =
      `Payment Received - Official Receipt ${officialReceiptNumber}`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GovServe Payment Confirmation</title>
</head>

<body
  style="
    margin:0;
    padding:24px;
    background:#f1f5f9;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
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
            max-width:600px;
            background:#ffffff;
            border:1px solid #e2e8f0;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                background:#0B3B60;
                padding:28px 24px;
                text-align:center;
              "
            >
              <div
                style="
                  color:#ffffff;
                  font-size:23px;
                  font-weight:800;
                "
              >
                GovServe Treasury
              </div>

              <div
                style="
                  color:#bfdbfe;
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:1px;
                  margin-top:6px;
                  text-transform:uppercase;
                "
              >
                Revenue &amp; Treasury Management System
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px 28px;">

              <div
                style="
                  font-size:20px;
                  font-weight:800;
                  color:#0f172a;
                  margin-bottom:8px;
                "
              >
                Payment Successfully Recorded
              </div>

              <div
                style="
                  font-size:14px;
                  color:#475569;
                  line-height:1.6;
                  margin-bottom:24px;
                "
              >
                Dear ${esc(customerName || 'Citizen Taxpayer')}, your payment
                has been successfully recorded in the GovServe Treasury system.
              </div>

              <!-- AMOUNT -->
              <div
                style="
                  background:#f0fdf4;
                  border:1px solid #bbf7d0;
                  border-radius:14px;
                  padding:22px;
                  text-align:center;
                  margin-bottom:24px;
                "
              >
                <div
                  style="
                    font-size:11px;
                    color:#64748b;
                    font-weight:700;
                    text-transform:uppercase;
                    letter-spacing:1px;
                  "
                >
                  Amount Paid
                </div>

                <div
                  style="
                    font-size:32px;
                    font-weight:900;
                    color:#166534;
                    margin-top:6px;
                  "
                >
                  ${amountText}
                </div>
              </div>

              <!-- PAYMENT DETAILS -->
              <table
                width="100%"
                border="0"
                cellspacing="0"
                cellpadding="0"
                style="
                  border-collapse:collapse;
                  font-size:13px;
                  margin-bottom:24px;
                "
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      color:#64748b;
                      width:42%;
                    "
                  >
                    Service
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      font-weight:700;
                      text-align:right;
                    "
                  >
                    ${esc(service)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      color:#64748b;
                    "
                  >
                    Official Receipt No.
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      font-weight:700;
                      text-align:right;
                    "
                  >
                    ${esc(officialReceiptNumber)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      color:#64748b;
                    "
                  >
                    Payment Reference
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      font-weight:700;
                      text-align:right;
                      word-break:break-all;
                    "
                  >
                    ${esc(paymentReference)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      color:#64748b;
                    "
                  >
                    Payment Method
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      font-weight:700;
                      text-align:right;
                    "
                  >
                    ${esc(paymentMethod)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      color:#64748b;
                    "
                  >
                    Payment Date
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      border-bottom:1px solid #e2e8f0;
                      font-weight:700;
                      text-align:right;
                    "
                  >
                    ${esc(formattedDate)}
                  </td>
                </tr>

                ${
                  accountReference
                    ? `
                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#64748b;
                    "
                  >
                    Account / Reference
                  </td>
                  <td
                    style="
                      padding:11px 0;
                      font-weight:700;
                      text-align:right;
                      word-break:break-word;
                    "
                  >
                    ${esc(accountReference)}
                  </td>
                </tr>
                `
                    : ''
                }

              </table>

              <!-- NOTICE -->
              <div
                style="
                  background:#eff6ff;
                  border-left:4px solid #2563eb;
                  padding:12px 14px;
                  border-radius:8px;
                  font-size:12px;
                  color:#1e40af;
                  line-height:1.5;
                "
              >
                Please keep this email for your records. This message confirms
                that the payment information above was recorded by the GovServe
                Revenue &amp; Treasury Management System.
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              style="
                background:#f8fafc;
                padding:18px 24px;
                text-align:center;
                border-top:1px solid #e2e8f0;
              "
            >
              <div
                style="
                  font-size:11px;
                  color:#94a3b8;
                  line-height:1.5;
                "
              >
                GovServe Revenue &amp; Treasury Management System<br>
                Republic of the Philippines - Local Government Unit
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
GovServe Treasury - Payment Confirmation

Dear ${customerName || 'Citizen Taxpayer'},

Your payment has been successfully recorded.

Service: ${service}
Amount Paid: ${amountText}
Official Receipt No.: ${officialReceiptNumber}
Payment Reference: ${paymentReference}
Payment Method: ${paymentMethod}
Payment Date: ${formattedDate}
${accountReference ? `Account / Reference: ${accountReference}` : ''}

Please keep this email for your records.

GovServe Revenue & Treasury Management System
Republic of the Philippines - Local Government Unit
`;

    // ============================================
    // BREVO - HTTPS / PORT 443
    // ============================================
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();

    if (brevoApiKey) {
      return await this.sendViaBrevo(
        brevoApiKey,
        toEmail,
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName
      );
    }

    // ============================================
    // RESEND - HTTPS / PORT 443
    // ============================================
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    if (resendApiKey) {
      return await this.sendViaResend(
        resendApiKey,
        toEmail,
        subject,
        htmlContent,
        textContent,
        rawFrom
      );
    }

    // ============================================
    // SENDGRID - HTTPS / PORT 443
    // ============================================
    const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim();

    if (sendgridApiKey) {
      return await this.sendViaSendGrid(
        sendgridApiKey,
        toEmail,
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName
      );
    }

    // ============================================
    // SMTP FALLBACK
    // ============================================
    const transporter = this.getTransporter();

    const info = await transporter.sendMail({
      from: rawFrom,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  }

  public static async sendCertificateEmail(
    toEmail: string,
    citizenName: string,
    certificate: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string }> {
    const rawFrom = process.env.SMTP_FROM || 'GovServe Treasury <govserve.treasury@gmail.com>';
    const userEmail = (process.env.SMTP_USER || 'govserve.treasury@gmail.com').trim();
    const fromName = 'GovServe Treasury';
    const fromEmail = rawFrom.includes('<')
      ? (rawFrom.match(/<([^>]+)>/)?.[1] || userEmail)
      : (rawFrom.includes('@') ? rawFrom : userEmail);
    const esc = (value: any) => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const amount = Number(certificate.grandTotal || certificate.total || certificate.amount || 0);
    const amountText = `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    const subject = `GovServe Official Receipt / Digital Certificate ${certificate.certificateNumber || ''}`.trim();
    const logoUrl = String(process.env.SYSTEM_LOGO_URL || '').trim();
    const logoHtml = logoUrl ? `<img src="${esc(logoUrl)}" style="max-width:85px;max-height:85px" alt="Government seal">` : '<div style="font-weight:900;font-size:11px">QUEZON CITY<br>GOVSERVE</div>';
    const htmlContent = `<!DOCTYPE html><html><body style="margin:0;background:#eef2f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="max-width:850px;margin:auto;background:#fff;border:2px solid #334155">
        <div style="display:grid;grid-template-columns:120px 1fr 120px;align-items:center;border-bottom:2px solid #334155;padding:14px">
          <div style="text-align:center">${logoHtml}</div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:900;letter-spacing:2px">DIGITAL CERTIFICATE</div><div>Republic of the Philippines</div><div>Office of the City Treasurer</div><div>Quezon City</div></div>
          <div style="text-align:center;border:1px solid #64748b;padding:8px;font-weight:700">ORIGINAL</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="border-bottom:1px solid #334155;border-right:1px solid #334155;padding:12px"><b>Computerized Official Receipt</b><br>Certificate Type: ${esc(certificate.certificateType)}</td><td style="border-bottom:1px solid #334155;padding:12px"><b>No.</b> ${esc(certificate.certificateNumber)}<br>Issue Date: ${esc(certificate.issueDate)}</td></tr>
        <tr><td style="border-bottom:1px solid #334155;border-right:1px solid #334155;padding:12px"><b>Machine Validation No.</b><br>${esc(certificate.machineValidationNumber)}</td><td style="border-bottom:1px solid #334155;padding:12px"><b>Bill Number</b><br>${esc(certificate.billNumber)}</td></tr>
        <tr><td colspan="2" style="border-bottom:1px solid #334155;padding:12px"><b>Payor:</b> ${esc(certificate.registeredOwner || citizenName)}</td></tr>
        <tr><td style="border-bottom:1px solid #334155;border-right:1px solid #334155;padding:12px"><b>Tax Declaration No.</b><br>${esc(certificate.taxDeclarationNumber)}</td><td style="border-bottom:1px solid #334155;padding:12px"><b>PIN</b><br>${esc(certificate.pin)}</td></tr>
        <tr><td colspan="2" style="border-bottom:1px solid #334155;padding:12px"><b>Property Address:</b> ${esc(certificate.propertyAddress)}</td></tr></table>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="border-bottom:1px solid #334155;border-right:1px solid #334155;padding:10px">NATURE OF COLLECTION</th><th style="border-bottom:1px solid #334155;border-right:1px solid #334155;padding:10px">FUND AND ACCOUNT CODE</th><th style="border-bottom:1px solid #334155;padding:10px">AMOUNT</th></tr><tr><td style="border-right:1px solid #334155;padding:14px">${esc(certificate.natureOfCollection)}</td><td style="border-right:1px solid #334155;padding:14px;text-align:center">${esc(certificate.fundAccountCode)}</td><td style="padding:14px;text-align:right;font-weight:bold">${amountText}</td></tr></table>
        <div style="display:grid;grid-template-columns:1fr 220px;border-top:1px solid #334155"><div style="padding:12px;text-align:right;font-weight:bold">Subtotal<br>Grand Total</div><div style="border-left:1px solid #334155;padding:12px;text-align:right">${esc(certificate.subtotal)}<br>${esc(certificate.grandTotal)}</div></div>
        <div style="display:grid;grid-template-columns:1fr 220px;border-top:2px solid #334155;font-size:18px;font-weight:900"><div style="padding:14px;text-align:right;letter-spacing:5px">TOTAL</div><div style="border-left:1px solid #334155;padding:14px;text-align:right">${amountText}</div></div>
        <div style="border-top:1px solid #334155;padding:12px;font-size:13px"><b>Amount in Words:</b> ${esc(certificate.amountInWords)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #334155;font-size:13px"><div style="padding:16px"><b>Payment Method:</b> ${esc(certificate.paymentMethod)}<br><b>Reference:</b> ${esc(certificate.paymentReference)}</div><div style="padding:16px;text-align:center">Received the Amount stated above.<div style="margin-top:55px;font-weight:bold">${esc(certificate.issuedBy)}</div><div>${esc(certificate.position)}</div></div></div>
        <div style="border-top:1px solid #334155;padding:12px;font-size:11px"><b>Remarks:</b> ${esc(certificate.remarks)}<br>Generated electronically by GovServe Revenue &amp; Treasury Management System.</div>
      </div></body></html>`;
    const textContent = `GovServe Treasury - Official Receipt\n\nDear ${citizenName},\n\nYour official receipt / digital certificate has been issued.\nCertificate No.: ${certificate.certificateNumber}\nBill Number: ${certificate.billNumber}\nAmount: ${amountText}\nIssue Date: ${certificate.issueDate}\nPayment Reference: ${certificate.paymentReference}\n\nThis document was issued electronically by the GovServe Treasury Portal.`;
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    if (brevoApiKey) return this.sendViaBrevo(brevoApiKey, toEmail, subject, htmlContent, textContent, fromEmail, fromName);
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) return this.sendViaResend(resendApiKey, toEmail, subject, htmlContent, textContent, rawFrom);
    const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim();
    if (sendgridApiKey) return this.sendViaSendGrid(sendgridApiKey, toEmail, subject, htmlContent, textContent, fromEmail, fromName);
    const transporter = this.getTransporter();
    const info = await transporter.sendMail({ from: rawFrom, to: toEmail, subject, text: textContent, html: htmlContent });
    return { success: true, messageId: info.messageId };
  }

}