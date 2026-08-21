/* eslint-disable no-console */
/**
 * DEVELOPMENT ONLY.
 *
 * Starts a throwaway in-memory MongoDB and prints its URI. Useful for trying
 * the API on a machine where MongoDB is not installed yet:
 *
 *   node seed/devMongo.js            # keeps running, prints the URI
 *
 * For real use install MongoDB Community (or point MONGODB_URI at Atlas) —
 * data in this server disappears when the process exits.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const server = await MongoMemoryServer.create({
    instance: { port: Number(process.env.DEV_MONGO_PORT) || 27017, dbName: 'nstp_management_system' },
  });

  const uri = server.getUri();
  console.log(`[dev-mongo] listening at ${uri}`);
  console.log('[dev-mongo] press Ctrl+C to stop (all data is lost on exit)');

  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[dev-mongo] failed:', err.message);
  process.exit(1);
});
