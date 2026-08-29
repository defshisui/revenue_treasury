import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter {
    if (!this.transporter) {
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!user) {
        throw new Error('SMTP_USER is not configured.');
      }

      if (!pass) {
        throw new Error('SMTP_PASS is not configured.');
      }

      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT || '587');

      /*
       * Gmail:
       * 587 = STARTTLS
       * 465 = SSL
       *
       * For Railway, use 587 + STARTTLS.
       */
      const secure = port === 465;

      console.log(
        `[EmailService] Creating SMTP transporter: ${host}:${port} secure=${secure}`
      );

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,

        auth: {
          user,
          pass,
        },

        // Important for cloud deployment.
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,

        // Required for Gmail STARTTLS on port 587.
        requireTLS: port === 587,

        tls: {
          rejectUnauthorized: true,
        },
      });
    }

    return this.transporter;
  }

  /**
   * Verify SMTP connection.
   * Useful for testing locally and on Railway.
   */
  public static async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();

      await transporter.verify();

      console.log('✅ Nodemailer SMTP verification successful.');

      return true;
    } catch (error: any) {
      console.error(
        '❌ Nodemailer SMTP verification failed:',
        error?.message || error
      );

      return false;
    }
  }

  /**
   * Send a 6-digit OTP verification email.
   */
  public static async sendOtpEmail(
    toEmail: string,
    otp: string,
    purpose: 'REGISTER' | 'LOGIN'
  ): Promise<{ success: boolean; messageId?: string }> {
    const user =
      process.env.SMTP_USER || 'govserve.treasury@gmail.com';

    const fromAddress =
      process.env.SMTP_FROM ||
      `"GovServe Treasury" <${user}>`;

    const actionTitle =
      purpose === 'LOGIN'
        ? 'Sign-In Authentication'
        : 'Account Registration';

    const actionSubtitle =
      purpose === 'LOGIN'
        ? 'sign in to your GovServe Treasury account'
        : 'complete your citizen registration';

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

    try {
      const transporter = this.getTransporter();

      console.log(
        `[EmailService] Sending ${purpose} OTP to ${toEmail}...`
      );

      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject:
          `${otp} is your GovServe Treasury verification code`,
        text: textContent,
        html: htmlContent,
      });

      console.log(
        `[EmailService] OTP email sent successfully to ${toEmail}. Message ID: ${info.messageId}`
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error(
        `[EmailService] SMTP error sending OTP to ${toEmail}:`,
        error?.message || error
      );

      throw new Error(
        `Failed to send verification email: ${
          error?.message || 'SMTP Error'
        }`
      );
    }
  }
}