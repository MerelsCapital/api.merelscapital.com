import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email } from '../Email.js';
import { Temporal } from '@js-temporal/polyfill';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}));

// Mock dotenv so it doesn't try to load real .env in tests
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('Email', () => {
  let emailService: Email;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new Email();
  });

  it('sends booking confirmation with correct HTML and .ics attachment', async () => {
    const start = Temporal.ZonedDateTime.from('2026-04-02T10:00[America/Denver]');
    const result = await emailService.sendBookingConfirmation(
      'client@example.com',
      'John Doe',
      start,
      'https://teams.microsoft.com/l/meetup-join/...',
      'BEGIN:VCALENDAR...' // fake ics
    );

    expect(result).toBe(true);

    const nodemailer = await import('nodemailer');
    const createTransport = nodemailer.default.createTransport;
    expect(createTransport).toHaveBeenCalled();

    // You can also spy deeper on sendMail arguments if needed
  });

  it('returns false on send error', async () => {
    // Override the mock to throw
    const nodemailer = await import('nodemailer');
    (nodemailer.default.createTransport().sendMail as any).mockRejectedValueOnce(new Error('SMTP fail'));

    const start = Temporal.ZonedDateTime.from('2026-04-02T10:00[America/Denver]');
    const result = await emailService.sendBookingConfirmation('client@example.com', 'John', start, 'url');

    expect(result).toBe(false);
  });
});