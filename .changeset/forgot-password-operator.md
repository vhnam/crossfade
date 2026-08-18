---
"@crossfade/web": minor
"@crossfade/ui": minor
"@crossfade/api": patch
---

Let operators request and complete a password reset through Better Auth.

`@crossfade/web` adds forgot-password and reset-password pages. `@crossfade/ui`
adds Alert, Field, and Label used by those forms. `@crossfade/api` enables
`sendResetPassword` so reset emails can be issued (currently logged in the API
process until a mail provider is configured).
