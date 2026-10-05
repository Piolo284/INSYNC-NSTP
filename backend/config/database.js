const dns = require('dns');
const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGODB_URI from the environment.
 * The connection string is never hard-coded anywhere else in the app,
 * so swapping the local URI for a MongoDB Atlas URI is a .env change only.
 */
async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy backend/.env.example to backend/.env first.'
    );
  }

  // Atlas "mongodb+srv://" URIs need a DNS SRV lookup. On some Windows setups
  // Node's resolver only sees 127.0.0.1, which refuses the query
  // (querySrv ECONNREFUSED). Fall back to public DNS in that case.
  if (uri.startsWith('mongodb+srv://')) {
    const servers = dns.getServers();
    const loopbackOnly = servers.every((s) => s === '127.0.0.1' || s === '::1');
    if (loopbackOnly) dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  mongoose.set('strictQuery', true);

  // MONGODB_DB_NAME picks the database even when the URI names none (Atlas
  // URIs often don't, which would otherwise fall back to the shared "test" db).
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    dbName: process.env.MONGODB_DB_NAME || 'nstp_management_system',
  });

  const { host, port, name } = mongoose.connection;
  console.log(`[db] connected to mongodb://${host}:${port}/${name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });

  return mongoose.connection;
}

module.exports = { connectDatabase };
