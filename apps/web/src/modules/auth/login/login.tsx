import { Field as FormischField, Form } from '@formisch/react';
import { Link } from '@tanstack/react-router';
import { CircleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@crossfade/ui/components/alert';
import { Button } from '@crossfade/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crossfade/ui/components/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@crossfade/ui/components/field';
import { Input } from '@crossfade/ui/components/input';

import useLogin from './login.actions';

function fieldErrors(messages: readonly string[] | null) {
  return messages?.map((message) => ({ message }));
}

function Login() {
  const { form, onSubmit } = useLogin();

  return (
    <main className="flex flex-col min-h-dvh items-center justify-center bg-background px-4 py-8 gap-8">
      <div className="flex flex-col items-center justify-center gap-2">
        <img src="/favicon.png" alt="Crossfade" className="size-12" />
        <h1 className="text-xl font-bold">Crossfade</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your operator account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form of={form} className="flex flex-col gap-5" onSubmit={onSubmit}>
            {form.errors ? (
              <Alert variant="destructive" tabIndex={-1}>
                <CircleAlertIcon />
                <AlertTitle>There is a problem</AlertTitle>
                <AlertDescription>{form.errors[0]}</AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup>
              <FormischField of={form} path={['email']}>
                {(field) => (
                  <Field data-invalid={field.errors ? true : undefined}>
                    <FieldLabel htmlFor="login-email">Email</FieldLabel>
                    <Input
                      {...field.props}
                      id="login-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={field.input}
                      aria-invalid={Boolean(field.errors)}
                      aria-describedby={field.errors ? 'login-email-error' : undefined}
                      className="min-h-11 md:text-sm"
                      placeholder="Enter your email address"
                    />
                    <FieldError id="login-email-error" errors={fieldErrors(field.errors)} />
                  </Field>
                )}
              </FormischField>

              <FormischField of={form} path={['password']}>
                {(field) => (
                  <Field data-invalid={field.errors ? true : undefined}>
                    <FieldLabel htmlFor="login-password">Password</FieldLabel>
                    <Input
                      {...field.props}
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={field.input}
                      aria-invalid={Boolean(field.errors)}
                      aria-describedby={field.errors ? 'login-password-error' : undefined}
                      className="min-h-11 md:text-sm"
                      placeholder="Enter your password"
                    />
                    <FieldError id="login-password-error" errors={fieldErrors(field.errors)} />
                  </Field>
                )}
              </FormischField>
            </FieldGroup>

            <Field className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full min-h-11"
                disabled={form.isSubmitting}
                aria-busy={form.isSubmitting}
              >
                {form.isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
              <Button
                nativeButton={false}
                variant="ghost"
                className="w-full min-h-11"
                render={<Link to="/auth/forgot-password">Forgot password?</Link>}
              />
            </Field>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

export default Login;
