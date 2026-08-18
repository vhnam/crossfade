import * as v from 'valibot';

export const loginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter your email address.'),
    v.email('Enter a valid email address, like name@company.com.'),
  ),
  password: v.pipe(v.string(), v.nonEmpty('Enter your password.')),
});

export type LoginSchema = typeof loginSchema;
