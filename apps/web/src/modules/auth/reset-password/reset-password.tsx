import { Field as FormischField, Form } from '@formisch/react';
import { Link } from '@tanstack/react-router';
import { CircleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@crossfade/ui/components/alert';
import { Button } from '@crossfade/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crossfade/ui/components/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@crossfade/ui/components/field';
import { Input } from '@crossfade/ui/components/input';

import useResetPassword from './reset-password.actions';

function fieldErrors(messages: readonly string[] | null) {
  return messages?.map((message) => ({ message }));
}

function ResetPassword() {
  const { form, onSubmit, token, tokenError } = useResetPassword();
  const linkInvalid = Boolean(tokenError) || !token;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-2">
        <img src="/favicon.png" alt="Crossfade" className="size-12" />
        <h1 className="text-xl font-bold">Crossfade</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            {linkInvalid
              ? 'This reset link is invalid or has expired.'
              : 'Choose a new password for your operator account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkInvalid ? (
            <div className="flex flex-col gap-5">
              <Alert variant="destructive" tabIndex={-1}>
                <CircleAlertIcon />
                <AlertTitle>Link not valid</AlertTitle>
                <AlertDescription>
                  Request a new reset email and open the latest link from that message.
                </AlertDescription>
              </Alert>
              <Button
                nativeButton={false}
                className="w-full min-h-11"
                render={<Link to="/auth/forgot-password">Request a new link</Link>}
              />
              <Button
                nativeButton={false}
                variant="ghost"
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
                <FormischField of={form} path={['password']}>
                  {(field) => (
                    <Field data-invalid={field.errors ? true : undefined}>
                      <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                      <Input
                        {...field.props}
                        id="reset-password"
                        type="password"
                        autoComplete="new-password"
                        value={field.input}
                        aria-invalid={Boolean(field.errors)}
                        aria-describedby={field.errors ? 'reset-password-error' : 'reset-password-hint'}
                        className="min-h-11 md:text-sm"
                        placeholder="Enter a new password"
                      />
                      {field.errors ? (
                        <FieldError id="reset-password-error" errors={fieldErrors(field.errors)} />
                      ) : (
                        <p id="reset-password-hint" className="text-xs text-muted-foreground">
                          Use at least 8 characters.
                        </p>
                      )}
                    </Field>
                  )}
                </FormischField>

                <FormischField of={form} path={['confirmPassword']}>
                  {(field) => (
                    <Field data-invalid={field.errors ? true : undefined}>
                      <FieldLabel htmlFor="reset-password-confirm">Confirm password</FieldLabel>
                      <Input
                        {...field.props}
                        id="reset-password-confirm"
                        type="password"
                        autoComplete="new-password"
                        value={field.input}
                        aria-invalid={Boolean(field.errors)}
                        aria-describedby={field.errors ? 'reset-password-confirm-error' : undefined}
                        className="min-h-11 md:text-sm"
                        placeholder="Enter the same password again"
                      />
                      <FieldError id="reset-password-confirm-error" errors={fieldErrors(field.errors)} />
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
                  {form.isSubmitting ? 'Saving…' : 'Save new password'}
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

export default ResetPassword;
