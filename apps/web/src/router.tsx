import { createRouter } from '@tanstack/react-router';

import { createQueryClient, QueryProvider } from '#/integrates/query';

import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    Wrap: ({ children }) => <QueryProvider queryClient={queryClient}>{children}</QueryProvider>,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
