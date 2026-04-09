import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Calendar } from './Calendar.js';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from './Logger.js';
import { MeetingType } from './Meeting.js';

export interface Env {
    APPLE_ID: string;
    APPLE_APP_SPECIFIC_PASSWORD: string;
    RESEND_API_KEY: string;
    RESEND_FROM_NAME: string;
    RESEND_FROM_EMAIL: string;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
    origin: ['https://bookings.merelscapital.com', 'https://www.merelscapital.com', 'https://merelscapital.com'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
}));

/*const ALLOWED_ORIGINS = new Set([
    'https://bookings.merelscapital.com',
    'https://www.merelscapital.com',
    'https://merelscapital.com',
]);

// Some browsers send Origin: null when fetch is made from within a sandboxed/cross-origin iframe.
// Hono's built-in cors() rejects null, so we handle CORS manually to allow it.
app.use('*', async (c, next) => {
    const origin = c.req.header('Origin') ?? '';
    const acao = ALLOWED_ORIGINS.has(origin) ? origin : 'https://bookings.merelscapital.com';

    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': acao,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Vary': 'Origin',
            },
        });
    }

    await next();
    c.header('Access-Control-Allow-Origin', acao);
    c.header('Vary', 'Origin');
});*/

// Module-level cache — persists for the lifetime of the Worker instance,
// eliminating the fetchCalendars() iCloud round-trip on every request.
let cachedCalendar: Calendar | null = null;

async function getCalendar(env: Env): Promise<Calendar | null> {
    if (cachedCalendar) return cachedCalendar;

    const result = await Calendar.fetchCalendars(env.APPLE_ID, env.APPLE_APP_SPECIFIC_PASSWORD);
    if (!result.ok) {
        Logger.error({ err: result.error, msg: 'Failed to fetch calendars.' });
        return null;
    }
    const calData = result.value.find(c => c.displayName === 'Bookings');
    if (!calData) {
        Logger.error({ err: new Error('Bookings calendar not found'), msg: 'Bookings calendar not found.' });
        return null;
    }
    cachedCalendar = new Calendar(calData);
    return cachedCalendar;
}

app.get('/slots', async (c) => {
    const dateParam = c.req.query('date');
    if (!dateParam) {
        return c.json({ error: 'date query param is required' }, 400);
    }

    let date: Temporal.ZonedDateTime;
    try {
        date = Temporal.ZonedDateTime.from(`${dateParam}T00:00:00[America/Denver]`);
    } catch {
        return c.json({ error: 'Invalid date.' }, 400);
    }

    const calendar = await getCalendar(c.env);
    if (!calendar) {
        return c.json({ error: 'Calendar unavailable.' }, 503);
    }

    const result = await calendar.fetchFreeBookingSlots(c.env.APPLE_ID, c.env.APPLE_APP_SPECIFIC_PASSWORD, date);
    if (!result.ok) {
        Logger.error({ err: result.error, msg: 'Failed to fetch slots.' });
        return c.json({ error: 'Failed to fetch slots.' }, 500);
    }

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ slots: result.value.map(s => s.toString()) });
});

app.post('/booking', async (c) => {
    let body: { values: string[] };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const { values } = body;
    if (!Array.isArray(values) || values.length < 5) {
        return c.json({ error: 'Invalid booking values.' }, 400);
    }

    let bookingTime: Temporal.ZonedDateTime;
    try {
        bookingTime = Temporal.ZonedDateTime.from(values[2]);
    } catch {
        return c.json({ error: 'Invalid booking time.' }, 400);
    }

    const meetingType = values[4] as MeetingType;
    if (!Object.values(MeetingType).includes(meetingType)) {
        return c.json({ error: 'Invalid meeting type.' }, 400);
    }

    const calendar = await getCalendar(c.env);
    if (!calendar) {
        return c.json({ error: 'Calendar unavailable.' }, 503);
    }

    const emailConfig = {
        apiKey: c.env.RESEND_API_KEY,
        fromName: c.env.RESEND_FROM_NAME,
        fromEmail: c.env.RESEND_FROM_EMAIL,
    };
    const zoomConfig = {
        accountId: c.env.ZOOM_ACCOUNT_ID,
        clientId: c.env.ZOOM_CLIENT_ID,
        clientSecret: c.env.ZOOM_CLIENT_SECRET,
    };

    const result = await calendar.createNewBooking(
        c.env.APPLE_ID,
        c.env.APPLE_APP_SPECIFIC_PASSWORD,
        values[0],
        values[1],
        bookingTime,
        values[3],
        meetingType,
        emailConfig,
        zoomConfig,
    );

    if (!result.ok) {
        Logger.error({ err: result.error, msg: 'Failed to create booking.' });
        return c.json({ error: 'Failed to create booking.' }, 500);
    }

    return c.json({ success: true });
});

export default app;
