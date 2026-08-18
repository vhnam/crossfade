import { createFileRoute } from '@tanstack/react-router';

import ResetPassword from '#/modules/auth/reset-password/reset-password';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPassword,
});
