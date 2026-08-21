require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const { connectDatabase } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/error');
const { uploadRoot } = require('./middleware/upload');

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

// ---- Static uploads (module files, submissions, activity photos) ----
app.use('/uploads', express.static(uploadRoot));

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

// ---- API ----
app.use('/api', require('./routes'));

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
      console.log(`[api] base url: ${process.env.API_BASE_URL || `http://localhost:${PORT}/api`}`);
      console.log(`[api] uploads served from ${path.relative(process.cwd(), uploadRoot)}`);
    });
  } catch (err) {
    console.error('[api] failed to start:', err.message);
    console.error(
      '[api] is MongoDB running? Try: mongod  (or start the MongoDB service)'
    );
    process.exit(1);
  }
}

start();

module.exports = app;
