import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import { appConfig } from './config.ts';

export function createAuth(database: Pool, provisioning = false) {
  const { appOrigin, secret, production } = appConfig();
  return betterAuth({
    database,
    secret,
    logger: { disabled: true },
    baseURL: appOrigin,
    basePath: '/api/auth',
    trustedOrigins: [appOrigin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provisioning,
      autoSignIn: false,
      minPasswordLength: 12,
    },
    advanced: { useSecureCookies: production },
  });
}

export async function provisionAccount(database: Pool, email: string, password: string) {
  const auth = createAuth(database, true);
  const result = await auth.api.signUpEmail({ body: { email, password, name: 'Dottie' } });
  return result.user.id;
}
