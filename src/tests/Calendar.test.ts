import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Calendar } from '../Calendar.js';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarEvent } from '../CalendarEvent.js';

// Mock Email (prevents real sending + noisy logs)
vi.mock('../Email.js');

// Mock tsdav so createNewBooking doesn't hit real iCloud
vi.mock('tsdav', () => ({
  createDAVClient: vi.fn().mockResolvedValue({
    fetchCalendars: vi.fn(),
    fetchCalendarObjects: vi.fn(),
    createCalendarObject: vi.fn().mockResolvedValue({}),
  }),
}));

describe('Calendar', () => {
  let calendar: Calendar;
  const mockDCal: any = { url: 'https://caldav.icloud.com/calendars/mock/' };

  beforeEach(() => {
    vi.clearAllMocks();
    calendar = new Calendar(mockDCal);

    // Fixed "now" for deterministic tests
    const fixedNow = Temporal.ZonedDateTime.from('2026-04-01T12:00[America/Denver]');
    vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(fixedNow);
  });

  describe('fetchFreeBookingSlots', () => {
    const testUsername = 'test@icloud.com';
    const testPassword = 'app-specific-pass';
    const baseDate = Temporal.ZonedDateTime.from('2026-04-02T00:00[America/Denver]');

    it('returns empty array for dates before tomorrow', async () => {
      const yesterday = Temporal.Now.zonedDateTimeISO('America/Denver').subtract({ days: 2 });
      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, yesterday);
      expect(slots).toEqual([]);
    });

    it('returns empty array for Saturdays', async () => {
      const saturday = Temporal.ZonedDateTime.from('2026-04-04T10:00[America/Denver]');
      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, saturday);
      expect(slots).toEqual([]);
    });

    it('returns empty array for Sundays', async () => {
      const sunday = Temporal.ZonedDateTime.from('2026-04-05T10:00[America/Denver]');
      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, sunday);
      expect(slots).toEqual([]);
    });

    it('returns all 18 slots when the calendar is completely empty', async () => {
      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce([]);

      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);

      expect(slots.length).toBe(18);
      expect(slots[0].hour).toBe(8);
      expect(slots[0].minute).toBe(0);
      expect(slots[17].hour).toBe(17);
      expect(slots[17].minute).toBe(30);
    });

    it('correctly marks a slot as busy when an event overlaps the start of the slot', async () => {
      const eventStart = baseDate.with({ hour: 9, minute: 15 });
      const eventEnd = eventStart.add({ minutes: 30 });

      const mockEvent = new CalendarEvent('Test Meeting', eventStart, eventEnd, {} as any);
      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce([mockEvent]);

      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);
      const slotTimes = slots.map((s: any) => `${s.hour}:${s.minute.toString().padStart(2, '0')}`);

      expect(slotTimes).not.toContain('9:0');
      expect(slotTimes).toContain('8:0');
      expect(slotTimes).toContain('9:30');
    });

    it('correctly marks a slot as busy when an event completely covers the slot', async () => {
      const eventStart = baseDate.with({ hour: 14, minute: 0 });
      const eventEnd = eventStart.add({ minutes: 60 });

      const mockEvent = new CalendarEvent('Long Meeting', eventStart, eventEnd, {} as any);
      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce([mockEvent]);

      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);
      const slotTimes = slots.map((s: any) => `${s.hour}:${s.minute.toString().padStart(2, '0')}`);

      expect(slotTimes).not.toContain('14:0');
      expect(slotTimes).not.toContain('14:30');
    });

    it('correctly marks a slot as busy when an event ends inside the slot', async () => {
      const eventStart = baseDate.with({ hour: 10, minute: 45 });
      const eventEnd = eventStart.add({ minutes: 20 });

      const mockEvent = new CalendarEvent('Short Overlap', eventStart, eventEnd, {} as any);
      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce([mockEvent]);

      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);
      const slotTimes = slots.map((s: any) => `${s.hour}:${s.minute.toString().padStart(2, '0')}`);

      expect(slotTimes).not.toContain('11:0');
    });

    it('handles multiple overlapping events correctly', async () => {
      const events = [
        new CalendarEvent('Event 1', baseDate.with({ hour: 8, minute: 45 }), baseDate.with({ hour: 9, minute: 15 }), {} as any),
        new CalendarEvent('Event 2', baseDate.with({ hour: 13, minute: 0 }), baseDate.with({ hour: 14, minute: 0 }), {} as any),
      ];

      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce(events);

      const slots = await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);
      const slotTimes = slots.map((s: any) => `${s.hour}:${s.minute.toString().padStart(2, '0')}`);

      expect(slotTimes).not.toContain('8:30');
      expect(slotTimes).not.toContain('9:0');
      expect(slotTimes).not.toContain('13:0');
      expect(slotTimes).toContain('9:30');
      expect(slotTimes).toContain('14:0');
    });

    it('calls fetchCalendarObjects with correct parameters', async () => {
      const spy = vi.spyOn(calendar, 'fetchCalendarObjects').mockResolvedValueOnce([]);

      await calendar.fetchFreeBookingSlots(testUsername, testPassword, baseDate);

      expect(spy).toHaveBeenCalledWith(testUsername, testPassword, baseDate);
    });
  });

  describe('createNewBooking', () => {
    it('creates calendar object and returns true', async () => {
      const start = Temporal.ZonedDateTime.from('2026-04-02T10:00[America/Denver]');
      const result = await calendar.createNewBooking(
        'user',
        'pass',
        'John Doe',
        'john@example.com',
        start
      );

      expect(result).toBe(true);

      const tsdav = await import('tsdav');
      expect(tsdav.createDAVClient).toHaveBeenCalled();
    });
  });
});