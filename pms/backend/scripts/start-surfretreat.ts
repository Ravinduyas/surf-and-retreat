// Starts the API for Surf & Retreat: same server, its own settings and database.
//
//   npm run start:surfretreat
//
// HELIO_ENV_DIR has to be set before config.ts is imported, because it decides
// which .env files are read — so this sets it, then loads the server.
process.env.HELIO_ENV_DIR ||= 'surfretreat';
await import('../src/index.ts');
