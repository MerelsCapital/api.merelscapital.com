import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Calendar } from './Calendar.js';
import { Temporal } from '@js-temporal/polyfill';
import type { Result } from './Result.js';
import type { DAVCalendar } from 'tsdav';

const app = express();
app.use(cors({ origin: 'http://bookings.merelscapital.com:5173' }));
app.use(express.json());

const username = process.env.APPLE_ID!;
const password = process.env.APPLE_APP_SPECIFIC_PASSWORD!;

let gotCalendar = false;
let calendarResult: Result<DAVCalendar[], Error> = { ok: false, error: new Error('Not yet fetched') };
let bookingCalData: DAVCalendar | undefined = undefined;
let calendar: Calendar | undefined = undefined;

// Keep retrying to setup the calendar until it succeeds, with a delay between attempts.
while (!gotCalendar) {
    calendarResult = await Calendar.fetchCalendars(username, password);
    if (calendarResult.ok) {
        gotCalendar = true;
        bookingCalData = calendarResult.value.find(c => c.displayName === 'Bookings');  
        if (bookingCalData === undefined || bookingCalData === null) {
            console.error('Bookings calendar not found. Retrying in 1 second...');
            gotCalendar = false;
        }
        if(bookingCalData) {
            calendar = new Calendar(bookingCalData);
            if (calendar === undefined || calendar === null) {
                console.error('Bookings calendar data is undefined. Retrying in 1 second...');
                gotCalendar = false;
            }
        }
    }   
    else
        console.log("Failed to fetch calendar: " + calendarResult.error);
    if(!gotCalendar)
        await new Promise(resolve => setTimeout(resolve, 1000));
}

app.get('/slots', async (req, res) => {
    try{
        const date = Temporal.ZonedDateTime.from(`${req.query.date}T00:00:00[America/Denver]`);
        const result = await calendar.fetchFreeBookingSlots(username, password, date);
        if(result.ok){
            console.log("Fetched free booking slots: " + result.value.length);
            return res.json({ slots: result.value.map(s => s.toString()) });
        }
        else {
            console.log("Failed to fetch free booking slots: " + result.error);
            throw result.error;
        }
    }
    catch(error){
        console.log("Failed to fetch free booking slots 2: " + error);
        return res.status(400).json({ error: 'Invalid Date.' });
    }
});

app.post('/booking', async (req, res) => {
    const { name, email, slot } = req.body;
    const start = Temporal.ZonedDateTime.from(slot);
    const result = await calendar.createNewBooking(username, password, name, email, start);
    if (!result.ok) {
        res.status(500).json({ error: 'Failed to create booking' });
        return;
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));