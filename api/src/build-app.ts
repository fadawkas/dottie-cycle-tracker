import Fastify from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Pool } from 'pg';
import { createAuth } from './auth.ts';
import { appConfig } from './config.ts';
import { signinLimit } from './signin-limit.ts';
import { trackerRoutes } from './tracker.ts';

export function buildApp(database: Pool) {
  const { appOrigin, secret, production } = appConfig();
  const auth = createAuth(database);
  const app = Fastify({
    bodyLimit: 16_384,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    if (production) reply.header('Strict-Transport-Security', 'max-age=31536000');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== appOrigin) {
      return reply.code(403).send({ error: 'Request origin is not allowed.' });
    }
  });

  app.setErrorHandler(async (error, _request, reply) => {
    const issue = error as { validation?: unknown; statusCode?: number; code?: string };
    if (issue.validation) return reply.code(400).send({ error: 'Check the values and try again.' });
    if (issue.code === '23P01') return reply.code(409).send({ error: 'Those dates overlap an existing period.' });
    if (issue.code === '23514' || issue.code === '22000' || issue.code === '22008') {
      return reply.code(400).send({ error: 'Check the date range and try again.' });
    }
    if (issue.statusCode && issue.statusCode >= 400 && issue.statusCode < 500) {
      return reply.code(issue.statusCode).send({ error: 'The request could not be accepted.' });
    }
    return reply.code(500).send({ error: 'Something went wrong. Please try again.' });
  });

  app.get('/api/health', async (_request, reply) => {
    try {
      await database.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, appOrigin);
      const allowed = request.method === 'GET'
        ? ['/api/auth/get-session']
        : ['/api/auth/sign-in/email', '/api/auth/sign-out'];
      if (!allowed.includes(url.pathname)) return reply.code(404).send({ error: 'Not found.' });
      if (url.pathname === '/api/auth/sign-in/email') {
        const body = request.body as { email?: unknown; password?: unknown } | null | undefined;
        if (typeof body?.email !== 'string' || !body.email.trim() || body.email.length > 254
          || typeof body.password !== 'string' || !body.password || body.password.length > 128) {
          return reply.code(400).send({ error: 'Enter a valid email and password.' });
        }
        const retry = await signinLimit(database, secret, body.email);
        if (retry) {
          return reply.header('Retry-After', retry).code(429).send({ error: 'Too many sign-in attempts. Try again later.' });
        }
      }

      const headers = fromNodeHeaders(request.headers);
      headers.delete('content-length');
      const response = await auth.handler(new Request(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      }));

      reply.code(response.status);
      response.headers.forEach((value, name) => {
        if (!['set-cookie', 'cache-control', 'content-length'].includes(name)) reply.header(name, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('Set-Cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });

  app.register(trackerRoutes, { prefix: '/api', database, auth });
  return app;
}
