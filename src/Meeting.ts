import { Temporal } from '@js-temporal/polyfill';
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { Result } from './Result.js';
import { readFileSync } from 'fs';

export class Meeting {
    id: string = crypto.randomUUID();
    title: string;
    dateTime: Temporal.ZonedDateTime;
    meetingType: MeetingType;
    location: string;

    private constructor(title: string, dateTime: Temporal.ZonedDateTime, meetingType: MeetingType, location: string) {
        this.title = title;
        this.dateTime = dateTime;
        this.meetingType = meetingType;
        this.location = location;
    }

    public static async create(title: string, dateTime: Temporal.ZonedDateTime, meetingType: MeetingType, location: string): Promise<Meeting> {
        if (!title) throw new Error("Title is required");
        if (!dateTime) throw new Error("Date and Time is required");
        if (!meetingType) throw new Error("Meeting Type is required");

        if (meetingType === MeetingType.Phone) {
            if (isValidPhoneNumber(location, 'US') || isValidPhoneNumber(location, 'GB'))
                throw new Error("Location must be a valid phone number.");
        } else if (meetingType === MeetingType.Zoom || meetingType === MeetingType.Jitsi) {
            const link = await Meeting.generateMeetingLink(meetingType);
            if (link.ok)
                location = link.value.toString();
        }
        return new Meeting(title, dateTime, meetingType, location);
    }

    toString(): string {
        let output = "";
        output += `Meeting ID: ${this.id}\n`;
        output += `Title: ${this.title}\n`;
        output += `Date and Time: ${this.dateTime.toString()}\n`;
        output += `Type: ${this.meetingType}\n`;
        output += `Location: ${this.location}`;
        return output;
    }

    public static async generateMeetingLink(meetingType: MeetingType): Promise<Result<URL, Error>> {
        if(meetingType === MeetingType.Jitsi){
            const meetingId = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
            let jitsiLink = "https://meet.jit.si/" + meetingId;
            return { ok: true, value: new URL(jitsiLink) };
        }
        else if(meetingType === MeetingType.Zoom){
            return { ok: false, error: new Error("Zoom link generation is not yet implemented.") };
        }
        else {
            return { ok: false, error: new Error("Unsupported meeting type for link generation.") };
        }
    }
}

export enum MeetingType {
    Jitsi = "Jitsi",
    Zoom = "Zoom",
    Phone = "Phone"
}