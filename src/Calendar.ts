import { createDAVClient, DAVCalendar, DAVCalendarObject } from 'tsdav';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarEvent } from './CalendarEvent.js';
import { Email } from './Email.js';
import { CalendarError, InvalidBookingDateError } from './CalendarError.js';
import { Result } from './Result.js';

export class Calendar {
    DCal: DAVCalendar
    
    constructor(dcal: DAVCalendar) { 
        this.DCal = dcal;
    }

    public static async fetchCalendars(username: string, password: string): Promise<Result<DAVCalendar[], Error>> {
        try{
            const client = await createDAVClient({
                serverUrl: 'https://caldav.icloud.com',
                credentials: {
                    username: username,
                    password: password,
                },
                authMethod: 'Basic',
                defaultAccountType: 'caldav',
            });

            const calendars = await client.fetchCalendars();
            return { ok: true, value: calendars };
        } catch (error) {
            return { ok: false, error: new CalendarError('Failed to fetch calendars', 'FETCH_CALENDARS_ERROR', { cause: error }) };
        }
    }

    public async fetchFreeBookingSlots(username: string, password: string, date: Temporal.ZonedDateTime): Promise<Result<Temporal.ZonedDateTime[], Error>> {
        const tomorrow = Temporal.Now.zonedDateTimeISO('America/Denver').add({ days: 1 });
        if (Temporal.ZonedDateTime.compare(date, tomorrow) < 0 || date.dayOfWeek === 6 || date.dayOfWeek === 7)
            return { ok: false, error: new InvalidBookingDateError('Booking date must be at least 24 hours in the future and cannot be on a weekend.') };

        const calendarResult = await this.fetchCalendarObjects(username, password, date);
        if (!calendarResult.ok) return { ok: false, error: calendarResult.error };
        const calendarEvents = calendarResult.value;

        let freeSlots: Temporal.ZonedDateTime[] = [];
        let slot1Free: boolean = true;
        let slot2Free: boolean = true;
        let slot3Free: boolean = true;
        let slot4Free: boolean = true;
        let slot5Free: boolean = true;
        let slot6Free: boolean = true;
        let slot7Free: boolean = true;
        let slot8Free: boolean = true;
        let slot9Free: boolean = true;
        let slot10Free: boolean = true;
        let slot11Free: boolean = true;
        let slot12Free: boolean = true;
        let slot13Free: boolean = true;
        let slot14Free: boolean = true;
        let slot15Free: boolean = true;
        let slot16Free: boolean = true;
        let slot17Free: boolean = true;
        let slot18Free: boolean = true;

        const slot01 = date.with({ hour: 8, minute: 0, second: 0, millisecond: 0 });
        const slot02 = date.with({ hour: 8, minute: 30, second: 0, millisecond: 0 });
        const slot03 = date.with({ hour: 9, minute: 0, second: 0, millisecond: 0 });
        const slot04 = date.with({ hour: 9, minute: 30, second: 0, millisecond: 0 });
        const slot05 = date.with({ hour: 10, minute: 0, second: 0, millisecond: 0 });
        const slot06 = date.with({ hour: 10, minute: 30, second: 0, millisecond: 0 });
        const slot07 = date.with({ hour: 11, minute: 0, second: 0, millisecond: 0 });
        const slot08 = date.with({ hour: 11, minute: 30, second: 0, millisecond: 0 });
        const slot09 = date.with({ hour: 13, minute: 0, second: 0, millisecond: 0 });
        const slot10 = date.with({ hour: 13, minute: 30, second: 0, millisecond: 0 });
        const slot11 = date.with({ hour: 14, minute: 0, second: 0, millisecond: 0 });
        const slot12 = date.with({ hour: 14, minute: 30, second: 0, millisecond: 0 });
        const slot13 = date.with({ hour: 15, minute: 0, second: 0, millisecond: 0 });
        const slot14 = date.with({ hour: 15, minute: 30, second: 0, millisecond: 0 });
        const slot15 = date.with({ hour: 16, minute: 0, second: 0, millisecond: 0 });
        const slot16 = date.with({ hour: 16, minute: 30, second: 0, millisecond: 0 });
        const slot17 = date.with({ hour: 17, minute: 0, second: 0, millisecond: 0 });
        const slot18 = date.with({ hour: 17, minute: 30, second: 0, millisecond: 0 });

        calendarEvents.forEach(calendarEvent => {
            if ((Temporal.ZonedDateTime.compare(calendarEvent.start, slot01) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot02) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot01) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot02) <= 0))
                slot1Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot02) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot03) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot02) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot03) <= 0))
                slot2Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot03) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot04) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot03) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot04) <= 0))
                slot3Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot04) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot05) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot04) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot05) <= 0))
                slot4Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot05) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot06) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot05) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot06) <= 0))
                slot5Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot06) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot07) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot06) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot07) <= 0))
                slot6Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot07) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot08) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot07) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot08) <= 0))
                slot7Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot08) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot09) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot08) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot09) <= 0))
                slot8Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot09) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot10) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot09) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot10) <= 0))
                slot9Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot10) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot11) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot10) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot11) <= 0))
                slot10Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot11) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot12) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot11) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot12) <= 0))
                slot11Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot12) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot13) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot12) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot13) <= 0))
                slot12Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot13) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot14) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot13) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot14) <= 0))
                slot13Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot14) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot15) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot14) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot15) <= 0))
                slot14Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot15) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot16) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot15) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot16) <= 0))
                slot15Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot16) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot17) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot16) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot17) <= 0))
                slot16Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot17) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, slot18) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot17) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, slot18) <= 0))
                slot17Free = false;
            if((Temporal.ZonedDateTime.compare(calendarEvent.start, slot18) >= 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.start, date.with({ hour: 18, minute: 0, second: 0, millisecond: 0 })) < 0) ||
                (Temporal.ZonedDateTime.compare(calendarEvent.end, slot18) > 0 &&
                Temporal.ZonedDateTime.compare(calendarEvent.end, date.with({ hour: 18, minute: 0, second: 0, millisecond: 0 })) <= 0))
                slot18Free = false;
        });

        if (slot1Free == true)
            freeSlots.push(slot01);
        if (slot2Free == true)
            freeSlots.push(slot02);
        if (slot3Free == true)      
            freeSlots.push(slot03);
        if (slot4Free == true)
            freeSlots.push(slot04);
        if (slot5Free == true)
            freeSlots.push(slot05);
        if (slot6Free == true)
            freeSlots.push(slot06);
        if (slot7Free == true)
            freeSlots.push(slot07);
        if (slot8Free == true)
            freeSlots.push(slot08);
        if (slot9Free == true)  
            freeSlots.push(slot09);
        if (slot10Free == true)
            freeSlots.push(slot10);
        if (slot11Free == true)
            freeSlots.push(slot11);
        if (slot12Free == true)
            freeSlots.push(slot12);
        if (slot13Free == true)
            freeSlots.push(slot13);
        if (slot14Free == true) 
            freeSlots.push(slot14);
        if (slot15Free == true)
            freeSlots.push(slot15);
        if (slot16Free == true)
            freeSlots.push(slot16);
        if (slot17Free == true)
            freeSlots.push(slot17);
        if (slot18Free == true)
            freeSlots.push(slot18);
        return { ok: true, value: freeSlots };
    }

    public async createNewBooking(username: string, password: string, clientName: string, clientEmail: string, start: Temporal.ZonedDateTime): Promise<Result<boolean, Error>> {
        try{
            const client = await createDAVClient({
                serverUrl: 'https://caldav.icloud.com',
                credentials: {
                    username: username,
                    password: password,
                },
                authMethod: 'Basic',
                defaultAccountType: 'caldav',
            });

            const iCalString = this.createICalString(clientName, start);

            await client.createCalendarObject({
                calendar: this.DCal,
                filename: 'Introduction.ics',
                iCalString: iCalString,
            });
            this.sendBookingConfirmation(clientEmail, clientName, start, 'testurl.test', iCalString);
        }
        catch(error){
            console.error('Error creating calendar object:', error);
            return { ok: false, error: new CalendarError('Failed to create calendar object', 'CREATE_CALENDAR_OBJECT_ERROR', { cause: error }) };
        }
        
        return { ok: true, value: true };
    }

    private async fetchCalendarObjects(username: string, password: string, date: Temporal.ZonedDateTime): Promise<Result<CalendarEvent[], Error>> {
        try{
            let events: CalendarEvent[] = [];

            const client = await createDAVClient({
                serverUrl: 'https://caldav.icloud.com',
                credentials: {
                    username: username,
                    password: password,
                },
                authMethod: 'Basic',
                defaultAccountType: 'caldav',
            });

            let DCalObjects = await client.fetchCalendarObjects({
                calendar: this.DCal, 
                timeRange: { 
                    start: date.toPlainDate().toString(), 
                    end:   date.add({ days: 1 }).toPlainDate().toString()
                }
            });

            DCalObjects.forEach((obj, index) => {
                let data: string[] = obj.data.toString().split(/\r?\n/);
                let name = '';
                let start = '';
                let end = '';
                
                data.forEach((line) => {
                    if(line.startsWith('SUMMARY:'))
                        name = line.replace('SUMMARY:','');
                    else if(line.startsWith('DTSTART;'))
                        start = line.replace('DTSTART;','');
                    else if(line.startsWith('DTEND;'))
                        end = line.replace('DTEND;','');
                });

                events.push(new CalendarEvent(name, CalendarEvent.CalendarDateParse(start), CalendarEvent.CalendarDateParse(end), obj));
            });
            return { ok: true, value: events };
        } catch (error) {
            return { ok: false, error: new CalendarError('Failed to fetch calendar objects', 'FETCH_CALENDAR_OBJECTS_ERROR', { cause: error }) };
        }
    }

    private createICalString(clientName: string, start: Temporal.ZonedDateTime): string {
        const uid = `booking-${start.toString()}-${Math.random().toString(36).slice(2)}@merelscapital.com`;
        const now = Temporal.Now.zonedDateTimeISO('UTC');
        const tz = start.timeZoneId;

        let iCalString = "BEGIN:VCALENDAR\n";
        iCalString += "VERSION:2.0\n";
        iCalString += 'PRODID:-//Merels Capital//Bookings v1.0//EN\r\n';
        iCalString += "METHOD:PUBLISH\n";
        iCalString += "BEGIN:VEVENT\n";
        iCalString += `UID:${uid}\n`;
        iCalString += `SUMMARY:${clientName} - Introductory Meeting\n`;
        iCalString += `DTSTART;TZID=${start.timeZoneId}:${start.toPlainDateTime().toString().replace(/[-:]/g, '')}\n`;
        iCalString += `DTEND;TZID=${start.timeZoneId}:${start.add({ minutes: 30 }).toPlainDateTime().toString().replace(/[-:]/g, '')}\n`;
        iCalString += `DTSTAMP:${now.toPlainDate().toString().replace(/[-:]/g, '')}Z\n`;
        iCalString += "LOCATION:<Teams link>>\n";
        iCalString += `DESCRIPTION:Introductory meeting with ${clientName}\n`;
        iCalString += "CLASS:PUBLIC\n";
        iCalString += "END:VEVENT\n";
        iCalString += "END:VCALENDAR\n";
        return iCalString;
    }

    private async sendBookingConfirmation(clientEmail: string, clientName: string, start: Temporal.ZonedDateTime, teamsJoinUrl: string, iCalString?: string): Promise<Result<boolean, Error>> {
        const emailService = new Email();
        if(!iCalString === null || !iCalString === undefined || iCalString === "")
            iCalString = this.createICalString(clientName, start);

        try{
            await emailService.sendBookingConfirmation(clientEmail, clientName, start, teamsJoinUrl, iCalString);
        }
        catch(error){
            return { ok: false, error: new CalendarError('Failed to send booking confirmation email', 'SEND_EMAIL_ERROR', { cause: error }) };
        }
        return { ok: true, value: true };
    }
}