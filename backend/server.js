require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { connectDatabase } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/error');
const systemConfigCache = require('./utils/systemConfigCache');
const systemAdminScope = require('./middleware/systemAdminScope');

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

// ---- API ----
app.use('/api', systemAdminScope, require('./routes'));

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDatabase();
    await systemConfigCache.load();
    app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
      console.log(`[api] base url: ${process.env.API_BASE_URL || `http://localhost:${PORT}/api`}`);
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
