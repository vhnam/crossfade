# `@crossfade/ui`

Shared Tailwind and shadcn/ui primitives for Crossfade apps. This package must
not depend on Crossfade business concepts (no tenant cards, queues, or session
panes). Domain UI belongs in `apps/web`.

shadcn registry components are added **only** here. Apps import from
`@crossfade/ui`. Do not add a `components.json` in an app.

## Use in apps

Import CSS once at the app entry:

```tsx
import "@crossfade/ui/globals.css";
```

Import components and helpers by subpath:

```tsx
import { Button } from "@crossfade/ui/components/button";
import { cn } from "@crossfade/ui/lib/utils";
import { ThemeProvider } from "@crossfade/ui/lib/theme-provider";
```

Exports are defined in `package.json` (`./components/*`, `./lib/*`,
`./hooks/*`).

## Add a primitive

From this directory:

```bash
npx shadcn@latest add button
```

Config: `components.json` (style `base-lyra`, Tailwind in
`src/styles/globals.css`).
