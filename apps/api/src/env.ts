import './load-env';
import { createEnv } from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number), v.minValue(1), v.maxValue(65535))),
    BETTER_AUTH_SECRET: v.pipe(v.string(), v.minLength(1)),
    BETTER_AUTH_URL: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:4000'),
    CORS_ORIGIN: v.optional(v.pipe(v.string(), v.minLength(1)), 'http://localhost:3000'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
