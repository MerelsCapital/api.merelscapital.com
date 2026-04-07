import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email } from '../Email.js';
import { Temporal } from '@js-temporal/polyfill';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}));

vi.mock('dotenv', () => ({ config: vi.fn() }));

vi.mock('../Logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('Email', () => {
  let emailService: Email;
  const start = Temporal.ZonedDateTime.from('2026-04-06T09:00[America/Denver]');
  const meetingUrl = new URL('https://meet.jit.si/testroom');

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new Email();
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

  it('calls sendMail once per invocation', async () => {
    await emailService.sendBookingConfirmation('client@example.com', 'John Doe', start, meetingUrl);

    const nodemailer = await import('nodemailer');
    const sendMail = nodemailer.default.createTransport().sendMail;
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('includes the client name in the sent email', async () => {
    await emailService.sendBookingConfirmation('client@example.com', 'Jane Smith', start, meetingUrl);

    const nodemailer = await import('nodemailer');
    const sendMail = nodemailer.default.createTransport().sendMail;
    const mailOptions = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mailOptions.html).toContain('Jane Smith');
  });

  it('sends to the correct recipient address', async () => {
    await emailService.sendBookingConfirmation('recipient@test.com', 'John', start, meetingUrl);

    const nodemailer = await import('nodemailer');
    const sendMail = nodemailer.default.createTransport().sendMail;
    const mailOptions = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mailOptions.to).toBe('recipient@test.com');
  });

  it('attaches the .ics file when an iCal string is provided', async () => {
    await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl, 'BEGIN:VCALENDAR...');

    const nodemailer = await import('nodemailer');
    const sendMail = nodemailer.default.createTransport().sendMail;
    const mailOptions = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mailOptions.attachments).toBeDefined();
    expect(mailOptions.attachments[0].contentType).toBe('text/calendar');
  });

  it('does not attach a file when no iCal string is provided', async () => {
    await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl);

    const nodemailer = await import('nodemailer');
    const sendMail = nodemailer.default.createTransport().sendMail;
    const mailOptions = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mailOptions.attachments).toBeUndefined();
  });

  it('returns ok:false when sendMail throws', async () => {
    const nodemailer = await import('nodemailer');
    (nodemailer.default.createTransport().sendMail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('SMTP fail'));

    const result = await emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl);

    expect(result.ok).toBe(false);
  });

  it('does not throw when sendMail fails — error is contained in Result', async () => {
    const nodemailer = await import('nodemailer');
    (nodemailer.default.createTransport().sendMail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('SMTP fail'));

    await expect(
      emailService.sendBookingConfirmation('client@example.com', 'John', start, meetingUrl)
    ).resolves.toMatchObject({ ok: false });
  });
});
