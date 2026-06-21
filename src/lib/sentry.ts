import * as Sentry from '@sentry/node';
import 'dotenv/config';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn: dsn,
        tracesSampleRate: 1.0,
        environment: process.env.NODE_ENV || 'development',
    });
    console.log("🛡️  Sentry initialized successfully.");
} else {
    console.log("⚠️  SENTRY_DSN not set. Sentry telemetry is disabled.");
}

export { Sentry };
export default Sentry;
