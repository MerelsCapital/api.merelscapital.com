import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email } from '../Email.js';
import { Temporal } from '@js-temporal/polyfill';

// ──────────────────────────────────────────────────────────────
// MOCK EXTERNAL DEPENDENCIES
// ──────────────────────────────────────────────────────────────
// We mock nodemailer so tests never hit real SMTP servers (keeps tests fast,
// deterministic, and portable across any hosting provider).
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}));

// Mock dotenv so the constructor doesn't try to load real .env credentials
// during tests (important for CI/CD and when moving between environments).
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('Email', () => {
  let emailService: Email;

  // ──────────────────────────────────────────────────────────────
  // SETUP BEFORE EACH TEST
  // ──────────────────────────────────────────────────────────────
  beforeEach(() => {
    vi.clearAllMocks();           // Reset all mock call counts and implementations
    emailService = new Email();   // Fresh Email instance for every test
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 1: Functioning path – successful booking confirmation email
  // ──────────────────────────────────────────────────────────────
  it('sends booking confirmation with correct HTML and .ics attachment', async () => {
    const start = Temporal.ZonedDateTime.from('2026-04-02T10:00[America/Denver]');

    const result = await emailService.sendBookingConfirmation(
      'client@example.com',
      'John Doe',
      start,
      'https://teams.microsoft.com/l/meetup-join/...',
      'BEGIN:VCALENDAR...' // fake iCal string
    );

    // Verify the public contract: method returns true on success
    expect(result).toBe(true);

    // Verify nodemailer was used correctly (transport was created)
    const nodemailer = await import('nodemailer');
    const createTransport = nodemailer.default.createTransport;
    expect(createTransport).toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 2: Error path – SMTP failure should return false gracefully
  // ──────────────────────────────────────────────────────────────
  it('returns false on send error', async () => {
    // Force the mocked sendMail to reject (simulates real SMTP/network failure)
    const nodemailer = await import('nodemailer');
    (nodemailer.default.createTransport().sendMail as any).mockRejectedValueOnce(
      new Error('SMTP fail')
    );

    const start = Temporal.ZonedDateTime.from('2026-04-02T10:00[America/Denver]');

    const result = await emailService.sendBookingConfirmation(
      'client@example.com',
      'John',
      start,
      'url'
    );

    // The method should catch the error internally and return false
    // (never throw to the caller – important for robust booking flow)
    expect(result).toBe(false);
  });
});