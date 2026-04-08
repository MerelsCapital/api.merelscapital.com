import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email } from '../Email.js';
import { Temporal } from '@js-temporal/polyfill';

const mockSend = vi.fn();

vi.mock('resend', () => ({
    Resend: vi.fn(function (this: Record<string, unknown>) {
        this.emails = { send: mockSend };
    }),
}));

vi.mock('../Logger.js', () => ({
    Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('Email', () => {
    let emailService: Email;
    const start = Temporal.ZonedDateTime.from('2026-04-06T09:00[America/Denver]');
    const meetingUrl = new URL('https://meet.jit.si/testroom');

    beforeEach(() => {
        vi.clearAllMocks();
        mockSend.mockResolvedValue({ data: { id: 'test-id' }, error: null });
        emailService = new Email('re_test_key', 'Merels Capital', 'test@merelscapital.com');
    });

    it('returns ok:true on a successful send', async () => {
        const result = await emailService.sendBookingConfirmation(
            'client@example.com',
            'John Doe',
            start,
            meetingUrl,
            'BEGIN:VCALENDAR...'
        );

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(true);
    });

    it('calls resend.emails.send once per invocation', async () => {
        await emailService.sendBookingConfirmation('client@example.com', 'John Doe', start, meetingUrl);

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('includes the client name in the sent email', async () => {
        await emailService.sendBookingConfirmation('client@example.com', 'Jane Smith', start, meetingUrl);

        const mailOptions = mockSend.mock.calls[0][0];
        expect(mailOptions.html).toContain('Jane Smith');
    });

    it('sends to the correct recipient address', async () => {
        await emailService.sendBookingConfirmation('recipient@test.com', 'John', start, meetingUrl);

        const mailOptions = mockSend.mock.calls[0][0];
        expect(mailOptions.to).toBe('recipient@test.com');
    });

    it('attaches the .ics file when an iCal string is provided', async () => {
        await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl, 'BEGIN:VCALENDAR...');

        const mailOptions = mockSend.mock.calls[0][0];
        expect(mailOptions.attachments).toBeDefined();
        expect(mailOptions.attachments[0].filename).toMatch(/\.ics$/);
    });

    it('does not attach a file when no iCal string is provided', async () => {
        await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl);

        const mailOptions = mockSend.mock.calls[0][0];
        expect(mailOptions.attachments).toBeUndefined();
    });

    it('returns ok:false when resend throws', async () => {
        mockSend.mockRejectedValueOnce(new Error('Resend error'));

        const result = await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl);

        expect(result.ok).toBe(false);
    });

    it('does not throw when send fails — error is contained in Result', async () => {
        mockSend.mockRejectedValueOnce(new Error('Resend error'));

        await expect(
            emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl)
        ).resolves.toMatchObject({ ok: false });
    });
});
