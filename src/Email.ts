import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Temporal } from '@js-temporal/polyfill';

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

    public async sendBookingConfirmation(toEmail: string, clientName: string, start: Temporal.ZonedDateTime, teamsJoinUrl: string, iCalString?: string): Promise<boolean> {
        const mailOptions: nodemailer.SendMailOptions = {
            from: `"Merels Capital" <andrewbowden86@icloud.com>`,
            to: toEmail,
            subject: `Your Introductory Meeting – ${start.toPlainDate().toString()}`,
            html: `
                <h2>Hi ${clientName},</h2>
                <p>Your booking with Merels Capital is confirmed!</p>
                <p><strong>Date:</strong> ${start.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
                <p><strong>Join via Microsoft Teams:</strong> <a href="${teamsJoinUrl}">${teamsJoinUrl}</a></p>
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
          console.error('Error sending confirmation email:', error);
          return false;
        }

        console.log(`✅ Confirmation email sent to ${toEmail}`);
        return true;
    }
}
