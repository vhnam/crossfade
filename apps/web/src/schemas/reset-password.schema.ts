import * as v from 'valibot';

export const resetPasswordSchema = v.pipe(
  v.object({
    password: v.pipe(v.string(), v.nonEmpty('Enter a new password.'), v.minLength(8, 'Use at least 8 characters.')),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('Confirm your new password.')),
  }),
  v.forward(
    v.check((input) => input.password === input.confirmPassword, 'Passwords do not match.'),
    ['confirmPassword'],
  ),
);

export type ResetPasswordSchema = typeof resetPasswordSchema;
