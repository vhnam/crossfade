import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

import { Toaster } from '@crossfade/ui/components/toast';
import { TooltipProvider } from '@crossfade/ui/components/tooltip';
import { ThemeProvider } from '@crossfade/ui/lib/theme-provider';

import type { QueryRouterContext } from '#/integrates/query';

export const Route = createRootRouteWithContext<QueryRouterContext>()({
  component: Root,
  notFoundComponent: NotFound,
});

function NotFound() {
  return <p>Not Found</p>;
}

function Root() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
