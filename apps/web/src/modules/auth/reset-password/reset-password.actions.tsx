import { setErrors, useForm, type SubmitHandler } from '@formisch/react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';

import { authClient } from '#/integrates/auth';
import { resetPasswordSchema, type ResetPasswordSchema } from '#/schemas/reset-password.schema';

const resetPasswordRoute = getRouteApi('/auth/reset-password');

const useResetPassword = () => {
  const navigate = useNavigate();
  const { token, error: tokenError } = resetPasswordRoute.useSearch();
  const form = useForm({
    schema: resetPasswordSchema,
    validate: 'submit',
    revalidate: 'blur',
  });

  const onSubmit: SubmitHandler<ResetPasswordSchema> = async ({ password }) => {
    setErrors(form, { errors: null });

    if (!token) {
      setErrors(form, {
        errors: ['This reset link is invalid or has expired. Request a new one.'],
      });
      return;
    }

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (resetError) {
      setErrors(form, {
        errors: [resetError.message ?? 'Could not reset your password. Request a new link and try again.'],
      });
      return;
    }

    void navigate({ to: '/auth/login' });
  };

  return { form, onSubmit, token, tokenError };
};

export default useResetPassword;
