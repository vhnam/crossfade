import * as v from 'valibot';

export const forgotPasswordSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter your email address.'),
    v.email('Enter a valid email address, like name@company.com.'),
  ),
});

export type ForgotPasswordSchema = typeof forgotPasswordSchema;
