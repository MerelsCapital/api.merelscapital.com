type LogPayload = {
    msg: string;
    err?: unknown;
    [key: string]: unknown;
};

function formatEntry(level: string, payload: LogPayload): string {
    const { msg, err, ...rest } = payload;
    const errStr = err instanceof Error
        ? { message: err.message, stack: err.stack }
        : err;
    return JSON.stringify({ level, msg, ...rest, ...(err !== undefined ? { err: errStr } : {}) });
}

export const Logger = {
    info:  (payload: LogPayload) => console.log(formatEntry('info', payload)),
    warn:  (payload: LogPayload) => console.warn(formatEntry('warn', payload)),
    error: (payload: LogPayload) => console.error(formatEntry('error', payload)),
};
