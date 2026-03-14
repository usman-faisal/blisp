import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { Transporter, createTransport } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
enum OtpType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}
import { throwError } from 'src/common/utils/helpers';

@Injectable()
export class MailerService {
  private readonly transporter: Transporter;
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.transporter = createTransport({
      pool: true,
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendOtpEmail(email: string, otp: string, type: OtpType) {
    try {
      let subject = '';
      if (type === OtpType.EMAIL_VERIFICATION) {
        subject = `Vonc | Verify your account`;
      } else if (type === OtpType.PASSWORD_RESET) {
        subject = `Vonc | Reset Password`;
      } else {
        console.info('Unsupported OTP type');
        return;
      }

      const purposeText = type === OtpType.EMAIL_VERIFICATION ? 'verify your email address' : 'reset your password';
      const instructionText =
        type === OtpType.EMAIL_VERIFICATION
          ? 'Please use the verification code below to complete your account verification.'
          : 'Please use the code below to reset your password. This code will expire in 10 minutes.';

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f0f; color: #e0e0e0;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f0f0f;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a1a; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                <tr>
                  <td style="padding: 50px 40px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td align="center" style="padding-bottom: 30px;">
                          <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Vonc</h1>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-bottom: 40px;">
                          <h2 style="margin: 0; font-size: 22px; font-weight: 500; color: #ffffff; line-height: 1.4;">
                            ${type === OtpType.EMAIL_VERIFICATION ? 'Verify Your Account' : 'Reset Your Password'}
                          </h2>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-bottom: 30px;">
                          <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #b0b0b0; max-width: 500px;">
                            To ${purposeText}, ${instructionText}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <div style="display: inline-block; background-color: #2a2a2a; border: 2px solid #3a3a3a; border-radius: 8px; padding: 30px 40px; min-width: 200px;">
                            <p style="margin: 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace; text-align: center;">
                              ${otp}
                            </p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 20px; padding-bottom: 40px;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #808080; max-width: 500px;">
                            If you did not request this code, please ignore this email or contact our support team if you have concerns.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top: 1px solid #2a2a2a; padding-top: 30px;">
                          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #666666; text-align: center;">
                            This is an automated message, please do not reply to this email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      const mailOptions = {
        from: this.configService.get<string>('EMAIL'),
        to: email,
        html,
        subject,
      };

      const mailResponse = await this.transporter.sendMail(mailOptions);
      return mailResponse;
    } catch (error: any) {
      throw throwError(error.message || 'Failed to send OTP email', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
