import { setErrors, useForm, type SubmitHandler } from '@formisch/react';
import { useState } from 'react';

import { authClient } from '#/integrates/auth';
import { forgotPasswordSchema, type ForgotPasswordSchema } from '#/schemas/forgot-password.schema';

const useForgotPassword = () => {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm({
    schema: forgotPasswordSchema,
    validate: 'submit',
    revalidate: 'blur',
  });

  const onSubmit: SubmitHandler<ForgotPasswordSchema> = async ({ email }) => {
    setErrors(form, { errors: null });

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (resetError) {
      setErrors(form, {
        errors: [resetError.message ?? 'Could not send a reset email. Try again.'],
      });
      return;
    }

    setSubmitted(true);
  };

  return { form, onSubmit, submitted };
};

export default useForgotPassword;
