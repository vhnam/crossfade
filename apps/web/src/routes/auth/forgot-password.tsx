import { createFileRoute } from '@tanstack/react-router';

import ForgotPassword from '#/modules/auth/forgot-password/forgot-password';

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPassword,
});
