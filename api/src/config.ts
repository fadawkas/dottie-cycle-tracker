export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required.');
  return value;
}

export function appConfig() {
  const appOrigin = process.env.APP_ORIGIN;
  const secret = process.env.BETTER_AUTH_SECRET;
  const production = process.env.NODE_ENV === 'production';
  if (!appOrigin || new URL(appOrigin).origin !== appOrigin || !/^https?:\/\//.test(appOrigin)) {
    throw new Error('APP_ORIGIN must be a complete HTTP(S) origin with no path.');
  }
  if (production && !appOrigin.startsWith('https://')) {
    throw new Error('Production sign-in requires HTTPS.');
  }
  if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  return { appOrigin, secret, production };
}
