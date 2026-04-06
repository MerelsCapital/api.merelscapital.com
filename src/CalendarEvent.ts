import { Temporal } from "@js-temporal/polyfill";
import type { DAVCalendarObject } from "tsdav";

export class CalendarEvent {
    name: string;
    start: Temporal.ZonedDateTime;
    end: Temporal.ZonedDateTime;
    DCALEvent: DAVCalendarObject;

    constructor(name: string, start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime, DCALEvent: DAVCalendarObject) {
        this.name = name;
        this.start = start;
        this.end = end;
        this.DCALEvent = DCALEvent;
    }

    public static CalendarDateParse(dateStr: string): Temporal.ZonedDateTime {
        if (!dateStr) {
            return Temporal.Now.zonedDateTimeISO('America/Denver');
        }

        const match = dateStr.match(/TZID=([^:]+):(\d{8}T\d{6})/);
        if (!match) {
            throw new Error(`Invalid iCal date format: ${dateStr}`);
        }

        const tz = match[1];
        const basic = match[2];
        const iso = basic.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6');

        return Temporal.ZonedDateTime.from(`${iso}[${tz}]`);
    }
}