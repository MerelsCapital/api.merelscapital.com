import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Meeting, MeetingType } from '../Meeting.js';

vi.mock('../Logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Mock global fetch for Zoom API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const FUTURE_DATETIME = Temporal.ZonedDateTime.from('2026-04-06T09:00:00[America/Denver]');

describe('Meeting', () => {

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Meeting.create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('throws if title is empty', async () => {
      await expect(Meeting.create('', FUTURE_DATETIME, MeetingType.Jitsi, ''))
        .rejects.toThrow('Title is required');
    });

    it('throws if meetingType is missing', async () => {
      await expect(Meeting.create('Intro', FUTURE_DATETIME, '' as MeetingType, ''))
        .rejects.toThrow('Meeting Type is required');
    });

    it('creates a Jitsi meeting and sets location to the generated link', async () => {
      const meeting = await Meeting.create('Intro', FUTURE_DATETIME, MeetingType.Jitsi, '');

      expect(meeting.meetingType).toBe(MeetingType.Jitsi);
      expect(meeting.location).toMatch(/^https:\/\/meet\.jit\.si\//);
    });

    it('creates a Phone meeting with the provided phone number as location', async () => {
      const meeting = await Meeting.create('Intro', FUTURE_DATETIME, MeetingType.Phone, '+14250000000');

      expect(meeting.meetingType).toBe(MeetingType.Phone);
      expect(meeting.location).toBe('+14250000000');
    });

    it('assigns a unique UUID id to each meeting', async () => {
      const a = await Meeting.create('Intro', FUTURE_DATETIME, MeetingType.Phone, '+14250000000');
      const b = await Meeting.create('Intro', FUTURE_DATETIME, MeetingType.Phone, '+14250000000');

      expect(a.id).not.toBe(b.id);
    });

    it('stores the correct title, dateTime, and meetingType', async () => {
      const meeting = await Meeting.create('My Meeting', FUTURE_DATETIME, MeetingType.Phone, '+14250000000');

      expect(meeting.title).toBe('My Meeting');
      expect(meeting.dateTime).toEqual(FUTURE_DATETIME);
      expect(meeting.meetingType).toBe(MeetingType.Phone);
    });
  });

  // ---------------------------------------------------------------------------
  // Meeting.generateMeetingLink
  // ---------------------------------------------------------------------------
  describe('generateMeetingLink', () => {
    describe('Jitsi', () => {
      it('returns ok:true with a valid Jitsi URL', async () => {
        const result = await Meeting.generateMeetingLink(MeetingType.Jitsi);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeInstanceOf(URL);
          expect(result.value.href).toMatch(/^https:\/\/meet\.jit\.si\//);
        }
      });

      it('generates a unique link on each call', async () => {
        const a = await Meeting.generateMeetingLink(MeetingType.Jitsi);
        const b = await Meeting.generateMeetingLink(MeetingType.Jitsi);

        expect(a.ok).toBe(true);
        expect(b.ok).toBe(true);
        if (a.ok && b.ok) expect(a.value.href).not.toBe(b.value.href);
      });
    });

    describe('Zoom', () => {
      const zoomConfig = {
        accountId: 'test-account',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      it('returns ok:true with the join_url from Zoom API', async () => {
        mockFetch
          .mockResolvedValueOnce({
            json: async () => ({ access_token: 'mock-token' }),
          })
          .mockResolvedValueOnce({
            json: async () => ({ join_url: 'https://zoom.us/j/123456' }),
          });

        const result = await Meeting.generateMeetingLink(MeetingType.Zoom, zoomConfig);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeInstanceOf(URL);
          expect(result.value.href).toBe('https://zoom.us/j/123456');
        }
      });

      it('requests an access token before creating the meeting', async () => {
        mockFetch
          .mockResolvedValueOnce({ json: async () => ({ access_token: 'mock-token' }) })
          .mockResolvedValueOnce({ json: async () => ({ join_url: 'https://zoom.us/j/123' }) });

        await Meeting.generateMeetingLink(MeetingType.Zoom, zoomConfig);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[0][0]).toContain('zoom.us/oauth/token');
        expect(mockFetch.mock.calls[1][0]).toContain('api.zoom.us/v2/users/me/meetings');
      });

      it('uses the access token as a Bearer header for the meeting creation call', async () => {
        mockFetch
          .mockResolvedValueOnce({ json: async () => ({ access_token: 'my-token' }) })
          .mockResolvedValueOnce({ json: async () => ({ join_url: 'https://zoom.us/j/123' }) });

        await Meeting.generateMeetingLink(MeetingType.Zoom, zoomConfig);

        const meetingCallHeaders = mockFetch.mock.calls[1][1].headers;
        expect(meetingCallHeaders['Authorization']).toBe('Bearer my-token');
      });

      it('returns ok:false when zoomConfig is not provided', async () => {
        const result = await Meeting.generateMeetingLink(MeetingType.Zoom);

        expect(result.ok).toBe(false);
      });

      it('returns ok:false when the Zoom API fetch throws', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await Meeting.generateMeetingLink(MeetingType.Zoom, zoomConfig);

        expect(result.ok).toBe(false);
      });
    });

    describe('unsupported type', () => {
      it('returns ok:false for an unsupported meeting type', async () => {
        const result = await Meeting.generateMeetingLink('Unknown' as MeetingType);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('Unsupported');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Meeting.toString
  // ---------------------------------------------------------------------------
  describe('toString', () => {
    it('includes all meeting fields in the output', async () => {
      const meeting = await Meeting.create('Intro Meeting', FUTURE_DATETIME, MeetingType.Phone, '+14250000000');
      const output = meeting.toString();

      expect(output).toContain('Intro Meeting');
      expect(output).toContain(MeetingType.Phone);
      expect(output).toContain('+14250000000');
      expect(output).toContain(meeting.id);
    });
  });
});
