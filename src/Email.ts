import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Temporal } from '@js-temporal/polyfill';
import type { Result } from './Result.js';
import { Logger } from './Logger.js';

export class Email {
  private transporter: nodemailer.Transporter;

  constructor() {
    dotenv.config({ path: process.env.ENV_PATH || '/Users/andy/Documents/Git Repos/api.merelscapital.com/.env' });

    this.transporter = nodemailer.createTransport({
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.APPLE_ID!,
        pass: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
      },
      tls: { rejectUnauthorized: true },
    });
  }

    public async sendBookingConfirmation(toEmail: string, clientName: string, time: Temporal.ZonedDateTime, meetingUrl: URL, iCalString?: string): Promise<Result<boolean, Error>> {
        const start = Temporal.ZonedDateTime.from(time);
        const mailOptions: nodemailer.SendMailOptions = {
            from: `"${process.env.SEND_FROM_NAME}" <${process.env.SEND_FROM_EMAIL}>`,
            to: toEmail,
            subject: `Your Introductory Meeting – ${start.toPlainDate().toString()}`,
            html: `
                <h2>Hi ${clientName},</h2>
                <p>Your booking with Merels Capital is confirmed!</p>
                <p><strong>Date:</strong> ${start.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
                <p><strong>Join via this meeting link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>
                <p>Looking forward to speaking with you!</p>
                <p>— Merels Capital Team</p>
            `,
            ...(iCalString && {
                attachments: [{
                    filename: `intro-meeting-${start.toPlainDate().toString()}.ics`,
                    content: iCalString,
                    contentType: 'text/calendar',
                }],
            }),
        };

        try{
            await this.transporter.sendMail(mailOptions);
        }
        catch(error){
            Logger.error({
                err: error,
                msg: 'Error sending confirmation email.',
            });
            console.error('Error sending confirmation email:', error);
            return { ok: false, error: new Error(String(error))};
        }

        console.log(`✅ Confirmation email sent to ${toEmail}`);
        return { ok: true, value: true}
    }
}
