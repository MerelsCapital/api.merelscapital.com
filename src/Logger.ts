import pino from 'pino';

export const Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production'
        ? { target: 'pino/file', options: { destination: '/var/log/api.merelscapital/app.log' } }
        : { target: 'pino-pretty' }, // human-readable in dev
});