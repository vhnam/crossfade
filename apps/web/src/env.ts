import { createEnv } from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:4000'),
  },
  runtimeEnv: {
    VITE_API_URL: import.meta.env.VITE_API_URL,
  },
  emptyStringAsUndefined: true,
});
