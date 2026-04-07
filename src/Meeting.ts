import { Temporal } from '@js-temporal/polyfill';
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { Result } from './Result.js';
import { Logger } from './Logger.js';
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
            if (isValidPhoneNumber(location, 'US') || isValidPhoneNumber(location, 'GB')){
                Logger.error({
                    err: new Error("Location must be a valid phone number."),
                    msg: 'Location must be a valid phone number.',
                });
                throw new Error("Location must be a valid phone number.");
            }
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
            // Step 1: get an access token
            try{
                const tokenRes = await fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + process.env.ZOOM_ACCOUNT_ID, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
                const { access_token } = await tokenRes.json();
                // Step 2: create the meeting
                const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        topic: 'Introductory Meeting',
                        type: 1, // instant meeting
                    })
                });
                const meeting = await meetingRes.json();
                return { ok: true, value: new URL(meeting.join_url) };
            }
            catch(error){
                Logger.error({
                    err: error,
                    msg: 'Generating the zoom link has failed.',
                });
                return { ok: false, error: new Error("Generating the zoom link has failed.") };
            }
        }
        else {
            Logger.error({
                err: new Error("Unsupported meeting type for link generation."),
                msg: 'Unsupported meeting type for link generation.',
            });
            return { ok: false, error: new Error("Unsupported meeting type for link generation.") };
        }
    }
}

export enum MeetingType {
    Jitsi = "Jitsi",
    Zoom = "Zoom",
    Phone = "Phone"
}