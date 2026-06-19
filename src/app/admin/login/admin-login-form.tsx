"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInWithPassword } from "@/lib/supabase/actions";

type FormState = { error?: string } | null;

const initialState: FormState = null;

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
};

export default function AdminLoginForm() {
  const [state, formAction] = useFormState<FormState, FormData>(
    async (_prev: FormState, formData: FormData) => {
      formData.set("next", "/admin");
      return (await signInWithPassword(formData)) ?? null;
    },
    initialState
  );

  return (
    <form className="auth-form" action={formAction}>
      <h1>Admin Login</h1>

      {state?.error && <p className="auth-error">{state.error}</p>}

      <label className="auth-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <input type="hidden" name="next" value="/admin" />

      <div className="auth-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
