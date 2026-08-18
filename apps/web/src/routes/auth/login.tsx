import { createFileRoute } from '@tanstack/react-router';

import Login from '#/modules/auth/login/login';

export const Route = createFileRoute('/auth/login')({
  component: Login,
});
