import { Resend } from 'resend';
import { Temporal } from '@js-temporal/polyfill';
import type { Result } from './Result.js';
import { Logger } from './Logger.js';

export class Email {
    private resend: Resend;
    private fromAddress: string;

    constructor(apiKey: string, fromName: string, fromEmail: string) {
        this.resend = new Resend(apiKey);
        this.fromAddress = `${fromName} <${fromEmail}>`;
    }

    public async sendBookingConfirmation(
        toEmail: string,
        clientName: string,
        time: Temporal.ZonedDateTime,
        meetingUrl: URL,
        iCalString?: string
    ): Promise<Result<boolean, Error>> {
        const start = Temporal.ZonedDateTime.from(time);

        try {
            await this.resend.emails.send({
                from: this.fromAddress,
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
                        content: btoa(iCalString),
                    }],
                }),
            });
        }
        catch (error) {
            Logger.error({
                err: error,
                msg: 'Error sending confirmation email.',
            });
            return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
        }

        return { ok: true, value: true };
    }
}
