import { createDAVClient } from 'tsdav';
import type { DAVCalendar, DAVCalendarObject } from 'tsdav';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarEvent } from './CalendarEvent.js';
import { Email } from './Email.js';
import { Logger } from './Logger.js';
import { CalendarError, InvalidBookingDateError } from './CalendarError.js';
import type { Result } from './Result.js';
import { Meeting, MeetingType } from './Meeting.js';

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
            Logger.error({
                err: error,
                msg: 'Failed to fetch calendars from ICloud.',
            });
            return { ok: false, error: new CalendarError('Failed to fetch calendars', 'FETCH_CALENDARS_ERROR', { cause: error }) };
        }
    }

    public async fetchFreeBookingSlots(username: string, password: string, date: Temporal.ZonedDateTime): Promise<Result<Temporal.ZonedDateTime[], Error>> {
        const tomorrow = Temporal.Now.zonedDateTimeISO('America/Denver').add({ days: 1 });
        if (Temporal.ZonedDateTime.compare(date, tomorrow) < 0 || date.dayOfWeek === 6 || date.dayOfWeek === 7){
            Logger.error({
                err: new Error('Booking date must be at least 24 hours in the future and cannot be on a weekend.'),
                msg: 'Invalid time provided.',
            });
            return { ok: false, error: new InvalidBookingDateError('Booking date must be at least 24 hours in the future and cannot be on a weekend.') };
        }

        const calendarResult = await this.fetchCalendarObjects(username, password, date);
        if (!calendarResult.ok) {
            Logger.error({
                err: new Error('Booking date must be at least 24 hours in the future and cannot be on a weekend.'),
                msg: 'Failed to fetch calendar objects.',
            });
            return { ok: false, error: calendarResult.error };
        }
        const calendarEvents = calendarResult.value;

        const slotTimes = [
            { hour: 8,  minute: 0  },
            { hour: 8,  minute: 30 },
            { hour: 9,  minute: 0  },
            { hour: 9,  minute: 30 },
            { hour: 10, minute: 0  },
            { hour: 10, minute: 30 },
            { hour: 11, minute: 0  },
            { hour: 11, minute: 30 },
            { hour: 13, minute: 0  },
            { hour: 13, minute: 30 },
            { hour: 14, minute: 0  },
            { hour: 14, minute: 30 },
            { hour: 15, minute: 0  },
            { hour: 15, minute: 30 },
            { hour: 16, minute: 0  },
            { hour: 16, minute: 30 },
            { hour: 17, minute: 0  },
            { hour: 17, minute: 30 },
        ];

        const slots = slotTimes.map(t => date.with({ ...t, second: 0, millisecond: 0 }));
        const slotEnd = date.with({ hour: 18, minute: 0, second: 0, millisecond: 0 });

        const free = new Array(slots.length).fill(true);

        calendarEvents.forEach(calendarEvent => {
            slots.forEach((slotStart, i) => {
                const nextSlot = i + 1 < slots.length ? slots[i + 1] : slotEnd;
                // Standard interval overlap: event overlaps slot if event.start < slotEnd AND event.end > slotStart
                if (Temporal.ZonedDateTime.compare(calendarEvent.start, nextSlot) < 0 &&
                    Temporal.ZonedDateTime.compare(calendarEvent.end, slotStart) > 0)
                    free[i] = false;
            });
        });

        const freeSlots = slots.filter((_, i) => free[i]);
        return { ok: true, value: freeSlots };
    }

    public async createNewBooking(username: string, password: string, clientName: string, clientEmail: string, time: Temporal.ZonedDateTime, details: string, meetingType: MeetingType): Promise<Result<boolean, Error>> {
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

            if(meetingType !== MeetingType.Phone){
                const meetingLink = await Meeting.generateMeetingLink(meetingType);
                if((meetingLink).ok){
                    const iCalString = this.createICalString(clientName, time, details, meetingLink.value.toString());
                    if(iCalString.ok){
                        try{
                            await client.createCalendarObject({
                                calendar: this.DCal,
                                filename: 'Introduction.ics',
                                iCalString: iCalString.value,
                            });
                        }
                        catch(error){
                            Logger.error({
                                err: error,
                                msg: 'An error occoured createing a calendar object.',
                            });
                        }
                    }
                    this.sendBookingConfirmation(clientEmail, clientName, time, details, meetingLink.value, iCalString);
                }
                else{
                    Logger.error({
                        err: meetingLink.error,
                        msg: 'An error occurred creating the meeting URL.',
                    });
                    return { ok: false, error: meetingLink.error };
                }
                
            }
            else {
                const iCalString = this.createICalString(clientName, time, details, clientEmail);
                if(iCalString.ok){
                    try{
                        await client.createCalendarObject({
                            calendar: this.DCal,
                            filename: 'Introduction.ics',
                            iCalString: iCalString.value,
                        });
                    }
                    catch(error){
                        Logger.error({
                            err: error,
                            msg: 'An error occoured createing a calendar object.',
                        });
                    }
                }
                //add some code to send a text here.
            }
        }
        catch(error){
            Logger.error({
                err: error,
                msg: 'An error occoured createing a calendar object.',
            });
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
            Logger.error({
                err: error,
                msg: 'Failed to fetch calendar objects.',
            });
            return { ok: false, error: new CalendarError('Failed to fetch calendar objects', 'FETCH_CALENDAR_OBJECTS_ERROR', { cause: error }) };
        }
    }

    private createICalString(clientName: string, time: Temporal.ZonedDateTime, details: string, meetingLink: string): Result<string> {
        try{
            const uid = `booking-${time.toString()}-${Math.random().toString(36).slice(2)}@merelscapital.com`;
            const now = Temporal.Now.zonedDateTimeISO('UTC');
            const start = Temporal.ZonedDateTime.from(time);
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
            iCalString += `LOCATION:${meetingLink}\n`;
            iCalString += `DESCRIPTION:Introductory meeting with ${clientName} - ${details}\n`;
            iCalString += "CLASS:PUBLIC\n";
            iCalString += "END:VEVENT\n";
            iCalString += "END:VCALENDAR\n";
            return { ok: true, value: iCalString };
        }
        catch(error){
            Logger.error({
                err: error,
                msg: 'An error occurred creating the iCal string.',
            });
            return { ok: false, error: new Error('An error occurred creating the iCal string.') };
        }
    }

    private async sendBookingConfirmation(clientEmail: string, clientName: string, start: Temporal.ZonedDateTime, details: string, meetingLink: URL, iCalString?: Result<string>): Promise<Result<boolean, Error>> {
        const emailService = new Email();
        if(iCalString === null || iCalString === undefined || !iCalString.ok || iCalString.value === "")
            iCalString = this.createICalString(clientName, start, details, meetingLink.toString());

        try{
            if(iCalString !== undefined && iCalString.ok){
                await emailService.sendBookingConfirmation(clientEmail, clientName, start, meetingLink, iCalString.value);
            }
        }
        catch(error){
            Logger.error({
                err: error,
                msg: 'An error occurred sending the confirmation email.',
            });
            return { ok: false, error: new CalendarError('Failed to send booking confirmation email', 'SEND_EMAIL_ERROR', { cause: error }) };
        }
        return { ok: true, value: true };
    }
}