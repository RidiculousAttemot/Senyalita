"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginWithPassword } from "./actions";

type FormState = { error: string | null };

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Verifying..." : "Sign in"}
    </button>
  );
};

export default function AdminPasswordForm({
  error: initialError,
}: {
  error?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(
    loginWithPassword,
    { error: initialError ?? null },
  );

  return (
    <form className="auth-form" action={formAction}>
      <h1>Admin Login</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        Local developer admin. Enter the ADMIN_PASSWORD set in .env.local.
      </p>

      {state?.error && <p className="auth-error">{state.error}</p>}

      <label className="auth-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <div className="auth-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
