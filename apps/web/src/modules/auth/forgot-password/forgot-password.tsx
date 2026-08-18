import { Field as FormischField, Form } from '@formisch/react';
import { Link } from '@tanstack/react-router';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@crossfade/ui/components/alert';
import { Button } from '@crossfade/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crossfade/ui/components/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@crossfade/ui/components/field';
import { Input } from '@crossfade/ui/components/input';

import useForgotPassword from './forgot-password.actions';

function fieldErrors(messages: readonly string[] | null) {
  return messages?.map((message) => ({ message }));
}

function ForgotPassword() {
  const { form, onSubmit, submitted } = useForgotPassword();

  return (
    <main className="flex flex-col min-h-dvh items-center justify-center bg-background px-4 py-8 gap-8">
      <div className="flex flex-col items-center justify-center gap-2">
        <img src="/favicon.png" alt="Crossfade" className="size-12" />
        <h1 className="text-xl font-bold">Crossfade</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            {submitted
              ? 'Check your inbox for the next step.'
              : 'Enter the email for your operator account and we will send a reset link if it exists.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col gap-5">
              <Alert tabIndex={-1}>
                <CircleCheckIcon />
                <AlertTitle>If that account exists, we sent a reset email</AlertTitle>
                <AlertDescription>
                  Check your inbox and spam folder. The message may take a few minutes to arrive.
                </AlertDescription>
              </Alert>
              <Button
                nativeButton={false}
                className="w-full min-h-11"
                render={<Link to="/auth/login">Back to sign in</Link>}
              />
            </div>
          ) : (
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
                      <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
                      <Input
                        {...field.props}
                        id="forgot-password-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={field.input}
                        aria-invalid={Boolean(field.errors)}
                        aria-describedby={field.errors ? 'forgot-password-email-error' : undefined}
                        className="min-h-11 md:text-sm"
                        placeholder="Enter your email address"
                      />
                      <FieldError id="forgot-password-email-error" errors={fieldErrors(field.errors)} />
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
                  {form.isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
                <Button
                  nativeButton={false}
                  variant="ghost"
                  className="w-full min-h-11"
                  render={<Link to="/auth/login">Back to sign in</Link>}
                />
              </Field>
            </Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default ForgotPassword;
