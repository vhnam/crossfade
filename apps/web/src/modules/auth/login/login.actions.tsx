import { setErrors, useForm, type SubmitHandler } from '@formisch/react';
import { useNavigate } from '@tanstack/react-router';

import { authClient } from '#/integrates/auth';
import { loginSchema, type LoginSchema } from '#/schemas/login.schema';

const useLogin = () => {
  const navigate = useNavigate();
  const form = useForm({
    schema: loginSchema,
    validate: 'submit',
    revalidate: 'blur',
  });

  const onSubmit: SubmitHandler<LoginSchema> = async ({ email, password }) => {
    setErrors(form, { errors: null });

    const { error: signInError } = await authClient.signIn.email({ email, password });

    if (signInError) {
      setErrors(form, {
        errors: [signInError.message ?? 'Sign in failed. Check your email and password, then try again.'],
      });
      return;
    }

    void navigate({ to: '/' });
  };

  return { form, onSubmit };
};

export default useLogin;
