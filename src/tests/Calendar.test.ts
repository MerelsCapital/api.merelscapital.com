import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../Calendar.js';
import { CalendarError } from '../CalendarError.js';
import { MeetingType } from '../Meeting.js';
import { createDAVClient } from 'tsdav';

vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(),
}));

vi.mock('../Email.js', () => ({
  Email: vi.fn(function (this: Record<string, unknown>) {
    this.sendBookingConfirmation = vi.fn().mockResolvedValue({ ok: true, value: true });
  }),
}));

vi.mock('../Meeting.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Meeting.js')>();
  return {
    ...actual,
    Meeting: {
      ...actual.Meeting,
      generateMeetingLink: vi.fn().mockResolvedValue({ ok: true, value: new URL('https://meet.jit.si/testroom') }),
    },
  };
});

vi.mock('../Logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const FIXED_NOW = Temporal.ZonedDateTime.from('2026-04-02T12:00:00[America/Denver]');
const FUTURE_MONDAY = Temporal.ZonedDateTime.from('2026-04-06T09:00:00[America/Denver]');

function makeCalObject(startH: number, startM: number, endH: number, endM: number, dateStr = '20260406') {
  const pad = (n: number) => String(n).padStart(2, '0');
  const data = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Test Event',
    `DTSTART;TZID=America/Denver:${dateStr}T${pad(startH)}${pad(startM)}00`,
    `DTEND;TZID=America/Denver:${dateStr}T${pad(endH)}${pad(endM)}00`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  return { data };
}

describe('Calendar', () => {
  let calendar: Calendar;
  let mockClient: {
    fetchCalendars: ReturnType<typeof vi.fn>;
    fetchCalendarObjects: ReturnType<typeof vi.fn>;
    createCalendarObject: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(FIXED_NOW);

    mockClient = {
      fetchCalendars: vi.fn().mockResolvedValue([]),
      fetchCalendarObjects: vi.fn().mockResolvedValue([]),
      createCalendarObject: vi.fn().mockResolvedValue({}),
    };
    (createDAVClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    calendar = new Calendar({ url: 'https://caldav.icloud.com/calendars/test' } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchCalendars
  // ---------------------------------------------------------------------------
  describe('fetchCalendars', () => {
    it('creates a DAV client with the provided credentials and iCloud server', async () => {
      await Calendar.fetchCalendars('user@icloud.com', 'app-password');

      expect(createDAVClient).toHaveBeenCalledWith({
        serverUrl: 'https://caldav.icloud.com',
        credentials: { username: 'user@icloud.com', password: 'app-password' },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
    });

    it('returns ok:true with calendars on success', async () => {
      const mockCalendars = [{ url: 'cal1' }, { url: 'cal2' }] as any[];
      mockClient.fetchCalendars.mockResolvedValue(mockCalendars);

      const result = await Calendar.fetchCalendars('user', 'pass');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(mockCalendars);
    });

    it('returns ok:true with an empty array when no calendars exist', async () => {
      mockClient.fetchCalendars.mockResolvedValue([]);

      const result = await Calendar.fetchCalendars('user', 'pass');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it('returns ok:false with a CalendarError when the DAV client throws', async () => {
      (createDAVClient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Auth failed'));

      const result = await Calendar.fetchCalendars('bad', 'creds');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(CalendarError);
    });

    it('wraps the original error as the cause on failure', async () => {
      const originalError = new Error('Auth failed');
      (createDAVClient as ReturnType<typeof vi.fn>).mockRejectedValue(originalError);

      const result = await Calendar.fetchCalendars('bad', 'creds');

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as CalendarError).cause).toBe(originalError);
    });

    it('uses the correct error code on failure', async () => {
      (createDAVClient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      const result = await Calendar.fetchCalendars('bad', 'creds');

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as CalendarError).code).toBe('FETCH_CALENDARS_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchFreeBookingSlots – date validation
  // ---------------------------------------------------------------------------
  describe('fetchFreeBookingSlots – date validation', () => {
    it('returns ok:false with InvalidBookingDateError for a date in the past', async () => {
      const past = Temporal.ZonedDateTime.from('2026-04-01T09:00:00[America/Denver]');

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', past);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe('Error');
      expect(mockClient.fetchCalendarObjects).not.toHaveBeenCalled();
    });

    it('returns ok:false for today (before tomorrow threshold)', async () => {
      const today = Temporal.ZonedDateTime.from('2026-04-02T09:00:00[America/Denver]');

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', today);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe('Error');
    });

    it('returns ok:false for Saturday', async () => {
      const saturday = Temporal.ZonedDateTime.from('2026-04-04T09:00:00[America/Denver]');
      expect(saturday.dayOfWeek).toBe(6);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', saturday);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe('Error');
    });

    it('returns ok:false for Sunday', async () => {
      const sunday = Temporal.ZonedDateTime.from('2026-04-05T09:00:00[America/Denver]');
      expect(sunday.dayOfWeek).toBe(7);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', sunday);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe('Error');
    });

    it('accepts a valid future weekday and returns ok:true', async () => {
      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      expect(mockClient.fetchCalendarObjects).toHaveBeenCalled();
    });

    it('returns ok:false with CalendarError when the DAV client throws during event fetch', async () => {
      mockClient.fetchCalendarObjects.mockRejectedValue(new Error('DAV error'));

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(CalendarError);
        expect((result.error as CalendarError).code).toBe('FETCH_CALENDAR_OBJECTS_ERROR');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // fetchFreeBookingSlots – slot availability
  // ---------------------------------------------------------------------------
  describe('fetchFreeBookingSlots – slot availability', () => {
    it('returns all 18 slots when no events exist', async () => {
      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(18);
      const times = result.value.map(s => ({ h: s.hour, m: s.minute }));
      expect(times).toEqual([
        { h: 8,  m: 0  }, { h: 8,  m: 30 },
        { h: 9,  m: 0  }, { h: 9,  m: 30 },
        { h: 10, m: 0  }, { h: 10, m: 30 },
        { h: 11, m: 0  }, { h: 11, m: 30 },
        { h: 13, m: 0  }, { h: 13, m: 30 },
        { h: 14, m: 0  }, { h: 14, m: 30 },
        { h: 15, m: 0  }, { h: 15, m: 30 },
        { h: 16, m: 0  }, { h: 16, m: 30 },
        { h: 17, m: 0  }, { h: 17, m: 30 },
      ]);
    });

    it('skips 12:00–13:00 (no lunch-hour slots)', async () => {
      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.some(s => s.hour === 12)).toBe(false);
    });

    it('blocks a slot when event starts exactly at slot start', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 0, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(17);
      expect(result.value.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
    });

    it('blocks a slot when event starts mid-slot', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 15, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
    });

    it('blocks a slot when an event fully spans it (start before, end after)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(7, 45, 8, 45)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
    });

    it('blocks both slots when event spans across two slots', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 15, 8, 45)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
      expect(result.value.some(s => s.hour === 8 && s.minute === 30)).toBe(false);
      expect(result.value).toHaveLength(16);
    });

    it('does not block adjacent slot when event ends exactly on slot boundary', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(7, 30, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
      expect(result.value.some(s => s.hour === 8 && s.minute === 30)).toBe(true);
    });

    it('blocks the last slot (17:30) when an event starts at 17:30', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(17, 30, 18, 0)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(17);
      expect(result.value.some(s => s.hour === 17 && s.minute === 30)).toBe(false);
    });

    it('does not block any slot for an event entirely outside business hours', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(6, 0, 7, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(18);
    });

    it('independently blocks multiple non-adjacent slots from separate events', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([
        makeCalObject(8, 0, 8, 30),
        makeCalObject(14, 0, 14, 30),
      ]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(16);
      expect(result.value.some(s => s.hour === 8  && s.minute === 0)).toBe(false);
      expect(result.value.some(s => s.hour === 14 && s.minute === 0)).toBe(false);
      expect(result.value.some(s => s.hour === 8  && s.minute === 30)).toBe(true);
      expect(result.value.some(s => s.hour === 14 && s.minute === 30)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // createNewBooking
  // ---------------------------------------------------------------------------
  describe('createNewBooking', () => {
    const bookingStart = Temporal.ZonedDateTime.from('2026-04-06T09:00:00[America/Denver]');

    it('returns ok:true on a successful Jitsi booking', async () => {
      const result = await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart, 'test details', MeetingType.Jitsi);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it('returns ok:true on a successful Phone booking', async () => {
      const result = await calendar.createNewBooking('user', 'pass', 'Jane Doe', '+14250000000', bookingStart, 'test details', MeetingType.Phone);

      expect(result.ok).toBe(true);
    });

    it('calls createCalendarObject with correct calendar and filename', async () => {
      await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart, 'details', MeetingType.Jitsi);

      expect(mockClient.createCalendarObject).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar: calendar.DCal,
          filename: 'Introduction.ics',
          iCalString: expect.stringContaining('BEGIN:VCALENDAR'),
        })
      );
    });

    it('returns ok:false when the DAV client constructor throws', async () => {
      (createDAVClient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DAV error'));

      const result = await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart, 'details', MeetingType.Jitsi);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(CalendarError);
        expect((result.error as CalendarError).code).toBe('CREATE_CALENDAR_OBJECT_ERROR');
      }
    });

    describe('generated iCal string', () => {
      let capturedICal: string;

      beforeEach(async () => {
        capturedICal = '';
        mockClient.createCalendarObject.mockImplementation(
          async ({ iCalString }: { iCalString: string }) => { capturedICal = iCalString; }
        );
        await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart, 'test details', MeetingType.Jitsi);
      });

      it('contains correct SUMMARY', () => {
        expect(capturedICal).toContain('SUMMARY:Jane Doe - Introductory Meeting');
      });

      it('contains correct DTSTART', () => {
        expect(capturedICal).toContain('DTSTART;TZID=America/Denver:20260406T090000');
      });

      it('contains DTEND 30 minutes after start', () => {
        expect(capturedICal).toContain('DTEND;TZID=America/Denver:20260406T093000');
      });

      it('contains valid VCALENDAR/VEVENT structure', () => {
        expect(capturedICal).toContain('BEGIN:VCALENDAR');
        expect(capturedICal).toContain('BEGIN:VEVENT');
        expect(capturedICal).toContain('END:VEVENT');
        expect(capturedICal).toContain('END:VCALENDAR');
      });

      it('contains DESCRIPTION with client name and details', () => {
        expect(capturedICal).toContain('DESCRIPTION:Introductory meeting with Jane Doe');
        expect(capturedICal).toContain('test details');
      });

      it('includes a unique UID', () => {
        expect(capturedICal).toMatch(/UID:booking-.+@merelscapital\.com/);
      });

      it('contains the meeting link in LOCATION', () => {
        expect(capturedICal).toContain('LOCATION:https://meet.jit.si/testroom');
      });
    });
  });
});
