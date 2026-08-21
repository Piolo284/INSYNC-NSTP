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

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
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
