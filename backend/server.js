require('dotenv').config();

// Every user is in the Philippines — pin the process to PHT (UTC+8) so any
// local-time Date math behaves the same on a PHT PC and on Vercel (UTC).
// utils/datetime.js is explicit about PHT on its own; this covers the rest.
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Manila';

const express = require('express');
const cors = require('cors');

const { connectDatabase } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/error');
const systemConfigCache = require('./utils/systemConfigCache');
const systemAdminScope = require('./middleware/systemAdminScope');
const { maybeSweepEndedSessions, sweepEndedSessions } = require('./utils/attendanceSweep');

const app = express();

// ---- CORS ----
const origins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  })
);

// ---- Body parsing ----
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ---- Request log (tiny, no extra dependency) ----
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

// ---- DB readiness ----
// On Vercel there is no start() step — each cold-started function connects on
// its first request and reuses the connection while it stays warm.
let ready = null;
function ensureReady() {
  if (!ready) {
    ready = connectDatabase()
      .then(() => systemConfigCache.load())
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

app.use((_req, _res, next) => {
  ensureReady().then(() => next(), next);
});

// ---- Automatic end-of-session absences ----
// Trainees who never scanned before a session's scheduled end time are
// marked Absent (utils/attendanceSweep.js). Checked at most once a minute,
// both from the timer in start() (long-running server) and here on incoming
// requests — Vercel has no background timer, so this is what keeps it
// running there. Never fails the request.
app.use((_req, _res, next) => {
  maybeSweepEndedSessions().finally(() => next());
});

// Optional: an external scheduler (Vercel Cron, cron-job.org, ...) can call
// this so the sweep runs on time even when nobody is using the app.
// Requires CRON_SECRET in .env, sent as "Authorization: Bearer <secret>".
app.get('/api/cron/attendance-sweep', async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  try {
    res.json({ success: true, data: await sweepEndedSessions() });
  } catch (err) {
    next(err);
  }
});

// ---- API ----
app.use('/api', systemAdminScope, require('./routes'));

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

// A stray async error must never take the whole API down — log it instead.
process.on('unhandledRejection', (err) => {
  console.error('[api] unhandled rejection:', err && err.message ? err.message : err);
});

const RETRY_DELAY_MS = 5000;

/**
 * Starts listening right away and keeps retrying the database until it
 * connects. The Atlas connection can drop for a few seconds on this network
 * (DNS / ENOTFOUND blips); exiting on the first failed attempt used to leave
 * the backend dead until someone restarted it by hand. Requests that arrive
 * before the database is ready retry the connection too (see ensureReady).
 */
async function start() {
  const server = app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    console.log(`[api] base url: ${process.env.API_BASE_URL || `http://localhost:${PORT}/api`}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] port ${PORT} is already in use — the backend is probably already running in another terminal. Stop that one first (Ctrl+C) or set a different PORT.`);
    } else {
      console.error('[api] server error:', err.message);
    }
    process.exit(1);
  });

  for (let attempt = 1; ; attempt += 1) {
    try {
      await ensureReady();
      break;
    } catch (err) {
      console.error(`[api] database connection failed (attempt ${attempt}): ${err.message}`);
      console.error(`[api] retrying in ${RETRY_DELAY_MS / 1000}s — check the internet connection / MONGODB_URI.`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  setInterval(() => maybeSweepEndedSessions(), 60 * 1000);
}

// Only listen when run directly (npm start / nodemon); Vercel imports `app`.
if (require.main === module) start();

module.exports = app;
