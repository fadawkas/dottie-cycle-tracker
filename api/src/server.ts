import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from './build-app.ts';
import { databaseUrl } from './config.ts';

const database = new pg.Pool({ connectionString: databaseUrl(), max: 5, connectionTimeoutMillis: 5000 });
database.on('error', () => console.error('An idle database connection was lost.'));
const app: FastifyInstance = buildApp(database);
app.addHook('onClose', () => database.end());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close());
}
// Vercel intercepts listen() while importing this module, so don't await it here.
app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }, (error) => {
  if (error) throw error;
  console.log('Dottie API listening.');
});
