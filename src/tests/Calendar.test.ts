import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../Calendar.js';
import { createDAVClient } from 'tsdav';

vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(),
}));

vi.mock('../Email.js', () => ({
  // Must use a regular function (not an arrow function) so vitest can call it with `new`.
  Email: vi.fn(function (this: Record<string, unknown>) {
    this.sendBookingConfirmation = vi.fn().mockResolvedValue(true);
  }),
}));

// Fixed "now" so the tomorrow-guard in fetchFreeBookingSlots is deterministic.
// tomorrow = FIXED_NOW + 1 day = 2026-04-03T12:00:00[America/Denver]
const FIXED_NOW = Temporal.ZonedDateTime.from('2026-04-02T12:00:00[America/Denver]');

// A future weekday (Monday) whose time is clearly after FIXED_NOW + 1 day.
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

    it('returns the calendars resolved by the DAV client', async () => {
      const mockCalendars = [{ url: 'cal1' }, { url: 'cal2' }] as any[];
      mockClient.fetchCalendars.mockResolvedValue(mockCalendars);

      const result = await Calendar.fetchCalendars('user', 'pass');

      expect(result).toEqual(mockCalendars);
    });

    it('returns an empty array when no calendars exist', async () => {
      mockClient.fetchCalendars.mockResolvedValue([]);

      const result = await Calendar.fetchCalendars('user', 'pass');

      expect(result).toEqual([]);
    });

    it('propagates errors thrown by the DAV client', async () => {
      (createDAVClient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Auth failed'));

      await expect(Calendar.fetchCalendars('bad', 'creds')).rejects.toThrow('Auth failed');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchFreeBookingSlots – date validation guards
  // ---------------------------------------------------------------------------
  describe('fetchFreeBookingSlots – date validation', () => {
    it('returns [] for a date in the past without fetching events', async () => {
      const past = Temporal.ZonedDateTime.from('2026-04-01T09:00:00[America/Denver]');

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', past);

      expect(result).toEqual([]);
      expect(mockClient.fetchCalendarObjects).not.toHaveBeenCalled();
    });

    it('returns [] for today (before tomorrow threshold)', async () => {
      const today = Temporal.ZonedDateTime.from('2026-04-02T09:00:00[America/Denver]');

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', today);

      expect(result).toEqual([]);
    });

    it('returns [] for Saturday (dayOfWeek === 6)', async () => {
      // 2026-04-04 is a Saturday
      const saturday = Temporal.ZonedDateTime.from('2026-04-04T09:00:00[America/Denver]');
      expect(saturday.dayOfWeek).toBe(6);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', saturday);

      expect(result).toEqual([]);
      expect(mockClient.fetchCalendarObjects).not.toHaveBeenCalled();
    });

    it('returns [] for Sunday (dayOfWeek === 7)', async () => {
      // 2026-04-05 is a Sunday
      const sunday = Temporal.ZonedDateTime.from('2026-04-05T09:00:00[America/Denver]');
      expect(sunday.dayOfWeek).toBe(7);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', sunday);

      expect(result).toEqual([]);
      expect(mockClient.fetchCalendarObjects).not.toHaveBeenCalled();
    });

    it('accepts a valid future weekday without returning []', async () => {
      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      // Guard did not reject the date; events were fetched
      expect(mockClient.fetchCalendarObjects).toHaveBeenCalled();
      expect(result).not.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // fetchFreeBookingSlots – slot availability
  // ---------------------------------------------------------------------------
  describe('fetchFreeBookingSlots – slot availability', () => {
    it('returns all 18 slots with correct times when no events exist', async () => {
      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(18);
      const times = result.map(s => ({ h: s.hour, m: s.minute }));
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

      expect(result.some(s => s.hour === 12)).toBe(false);
    });

    it('blocks slot 8:00 when an event starts exactly at 8:00', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 0, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(17);
      expect(result.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
    });

    it('blocks slot 8:00 when an event starts mid-slot (8:15), which is in [8:00, 8:30)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 15, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
    });

    it('blocks slot 8:00 when an event ends mid-slot (end=8:15, satisfies end > 8:00 && end <= 8:30)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(7, 45, 8, 15)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
      // Adjacent slot 8:30 must be unaffected
      expect(result.some(s => s.hour === 8 && s.minute === 30)).toBe(true);
    });

    it('blocks slot 8:00 when event end falls exactly on the slot boundary (end=8:30, satisfies end <= 8:30)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(7, 30, 8, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
      // Slot 8:30: end > 8:30 is false (equal, not greater) → slot 8:30 stays free
      expect(result.some(s => s.hour === 8 && s.minute === 30)).toBe(true);
    });

    it('blocks both slot 8:00 and slot 8:30 when event spans across them (start in slot1, end in slot2)', async () => {
      // start=8:15 ∈ [8:00, 8:30) → blocks slot 8:00
      // end=8:45:  end > 8:30 && end <= 9:00 → blocks slot 8:30
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(8, 15, 8, 45)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.some(s => s.hour === 8 && s.minute === 0)).toBe(false);
      expect(result.some(s => s.hour === 8 && s.minute === 30)).toBe(false);
      expect(result).toHaveLength(16);
    });

    it('blocks the last slot (17:30) when an event starts at 17:30', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(17, 30, 18, 0)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(17);
      expect(result.some(s => s.hour === 17 && s.minute === 30)).toBe(false);
    });

    it('blocks the last slot (17:30) when an event ends at exactly 18:00', async () => {
      // end=18:00 satisfies end > 17:30 && end <= 18:00
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(17, 45, 18, 0)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result.some(s => s.hour === 17 && s.minute === 30)).toBe(false);
    });

    it('does not block any slot for an event entirely before business hours (6:00–7:30)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(6, 0, 7, 30)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(18);
    });

    it('does not block any slot for an event entirely after business hours (18:30–19:00)', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([makeCalObject(18, 30, 19, 0)]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(18);
    });

    it('independently blocks multiple non-adjacent slots from separate events', async () => {
      mockClient.fetchCalendarObjects.mockResolvedValue([
        makeCalObject(8, 0, 8, 30),   // blocks 8:00
        makeCalObject(14, 0, 14, 30), // blocks 14:00
      ]);

      const result = await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(result).toHaveLength(16);
      expect(result.some(s => s.hour === 8  && s.minute === 0)).toBe(false);
      expect(result.some(s => s.hour === 14 && s.minute === 0)).toBe(false);
      // Adjacent slots should be unaffected
      expect(result.some(s => s.hour === 8  && s.minute === 30)).toBe(true);
      expect(result.some(s => s.hour === 13 && s.minute === 30)).toBe(true);
      expect(result.some(s => s.hour === 14 && s.minute === 30)).toBe(true);
    });

    it('fetches calendar objects with the correct day-range timeRange', async () => {
      await calendar.fetchFreeBookingSlots('user', 'pass', FUTURE_MONDAY);

      expect(mockClient.fetchCalendarObjects).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar: calendar.DCal,
          timeRange: { start: '2026-04-06', end: '2026-04-07' },
        })
      );
    });

    it('creates the DAV client with the supplied credentials', async () => {
      await calendar.fetchFreeBookingSlots('myuser', 'mypass', FUTURE_MONDAY);

      expect(createDAVClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: { username: 'myuser', password: 'mypass' },
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createNewBooking
  // ---------------------------------------------------------------------------
  describe('createNewBooking', () => {
    const bookingStart = Temporal.ZonedDateTime.from('2026-04-06T09:00:00[America/Denver]');

    it('returns true on a successful booking', async () => {
      const result = await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart);

      expect(result).toBe(true);
    });

    it('calls createCalendarObject with the correct calendar, filename, and an iCal string', async () => {
      await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart);

      expect(mockClient.createCalendarObject).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar: calendar.DCal,
          filename: 'Introduction.ics',
          iCalString: expect.stringContaining('BEGIN:VCALENDAR'),
        })
      );
    });

    it('returns false when createCalendarObject throws', async () => {
      mockClient.createCalendarObject.mockRejectedValue(new Error('CalDAV error'));

      const result = await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart);

      expect(result).toBe(false);
    });

    it('does not throw when createCalendarObject fails', async () => {
      mockClient.createCalendarObject.mockRejectedValue(new Error('Network error'));

      await expect(
        calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart)
      ).resolves.toBe(false);
    });

    describe('generated iCal string', () => {
      let capturedICal: string;

      beforeEach(async () => {
        capturedICal = '';
        mockClient.createCalendarObject.mockImplementation(
          async ({ iCalString }: { iCalString: string }) => { capturedICal = iCalString; }
        );
        await calendar.createNewBooking('user', 'pass', 'Jane Doe', 'jane@example.com', bookingStart);
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

      it('contains DESCRIPTION with client name', () => {
        expect(capturedICal).toContain('DESCRIPTION:Introductory meeting with Jane Doe');
      });

      it('includes a unique UID', () => {
        expect(capturedICal).toMatch(/UID:booking-.+@merelscapital\.com/);
      });

      it('uses the correct timezone in DTSTART/DTEND', () => {
        expect(capturedICal).toContain('TZID=America/Denver');
      });
    });

    it('uses the client name from the argument in the iCal SUMMARY', async () => {
      let capturedICal = '';
      mockClient.createCalendarObject.mockImplementation(
        async ({ iCalString }: { iCalString: string }) => { capturedICal = iCalString; }
      );

      await calendar.createNewBooking('user', 'pass', 'John Smith', 'john@example.com', bookingStart);

      expect(capturedICal).toContain('SUMMARY:John Smith - Introductory Meeting');
      expect(capturedICal).toContain('DESCRIPTION:Introductory meeting with John Smith');
    });

    it('creates a DAV client with the provided credentials', async () => {
      await calendar.createNewBooking('myuser', 'mypass', 'Jane Doe', 'jane@example.com', bookingStart);

      expect(createDAVClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: { username: 'myuser', password: 'mypass' },
        })
      );
    });
  });
});
