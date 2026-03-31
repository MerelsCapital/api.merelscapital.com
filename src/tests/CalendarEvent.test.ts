import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarEvent } from '../CalendarEvent.js';
import { DAVCalendarObject } from 'tsdav';

describe('CalendarEvent', () => {
  it('parses iCal DTSTART/DTEND with TZID correctly', () => {
    const dateStr = 'DTSTART;TZID=America/Denver:20260331T090000';
    const result = CalendarEvent.CalendarDateParse(dateStr);

    expect(result).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(result.timeZoneId).toBe('America/Denver');
    expect(result.hour).toBe(9);
    expect(result.minute).toBe(0);
  });

  it('returns default Denver time when dateStr is falsy', () => {
    const result = CalendarEvent.CalendarDateParse('');
    const now = Temporal.Now.zonedDateTimeISO('America/Denver');

    expect(result).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(result.timeZoneId).toBe('America/Denver');
    expect(result.toPlainDate().toString()).toBe(now.toPlainDate().toString());
  });

  it('throws on invalid format', () => {
    expect(() => CalendarEvent.CalendarDateParse('invalid')).toThrow('Invalid iCal date format: invalid');
  });

  it('creates a full CalendarEvent instance with constructor', () => {
    const start = Temporal.ZonedDateTime.from('2026-04-02T09:00[America/Denver]');
    const end = start.add({ minutes: 30 });
    const mockDavObject: DAVCalendarObject = { data: 'mock-data' } as any;

    const event = new CalendarEvent('Intro Meeting', start, end, mockDavObject);

    expect(event).toBeInstanceOf(CalendarEvent);
    expect(event.name).toBe('Intro Meeting');
    expect(event.start).toEqual(start);
    expect(event.end).toEqual(end);
    expect(event.DCALEvent).toBe(mockDavObject);
  });
});