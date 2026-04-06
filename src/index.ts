import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Calendar } from './Calendar.js';
import { Temporal } from '@js-temporal/polyfill';
import type { Result } from './Result.js';
import type { DAVCalendar } from 'tsdav';
import { Logger } from './Logger.js';

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
    else{
        Logger.error({
            err: calendarResult.error,
            msg: 'Failed to fetch calendar.',
        });
        console.log("Failed to fetch calendar: " + calendarResult.error);
    }
        
    if(!gotCalendar)
        await new Promise(resolve => setTimeout(resolve, 1000));
}

app.get('/slots', async (req, res) => {
    try{
        const date = Temporal.ZonedDateTime.from(`${req.query.date}T00:00:00[America/Denver]`);
        const result = await calendar.fetchFreeBookingSlots(username, password, date);
        if(result.ok){
            return res.json({ slots: result.value.map(s => s.toString()) });
        }
        else {
            Logger.error({
                err: new Error("Response status: " + res.status),
                msg: '.',
            });
            console.error(result.error);
        }
    }
    catch(error){
        Logger.error({
            err: new Error("An error occurred fetching booking slots or parsing booking date."),
            msg: 'An error occurred fetching booking slots or parsing booking date.',
        });
        console.error("An error occurred fetching booking slots or parsing booking date.: " + error);
        return res.status(400).json({ error: 'Invalid Date.' });
    }
});

app.post('/booking', async (req, res) => {
    const { values } = req.body;
    const result = await calendar.createNewBooking(username, password, values[0], values[1], values[2], values[3]);
    if (!result.ok) {
        Logger.error({
            err: new Error("An error occurred creating a booking."),
            msg: 'An error occurred creating a booking.',
        });
        res.status(500).json({ error: 'Failed to create booking' });
        return;
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));