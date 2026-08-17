import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

export type QueryRouterContext = {
  queryClient: QueryClient;
};

export type QueryProviderProps = PropsWithChildren & {
  queryClient: QueryClient;
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

export function QueryProvider({ queryClient, children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
