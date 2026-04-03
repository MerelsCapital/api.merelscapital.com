export class CalendarError extends Error {
    code: string;
    constructor(message: string, code: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "CalendarError";
        this.code = code;
    }
}

export class InvalidBookingDateError extends CalendarError {
    constructor(message: string) {
        super(message, 'INVALID_BOOKING_DATE: Booking date is invalid or not available.');
        this.name = "InvalidBookingDateError";
    }
}

export class DAVClientError extends CalendarError {
    constructor(message: string) {
        super(message, 'DAV_CLIENT_ERROR: An error occurred while communicating with the DAV server.');
        this.name = "DAVClientError";
    }
}