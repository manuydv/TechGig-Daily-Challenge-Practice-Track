import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button, Input } from "@/components/ui";
import { Field } from "@/components/Field";

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp(email.trim(), password);
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setInfo("Account created. Check your email to confirm it, then sign in.");
      return;
    }
    // On success with an immediate session, RequireApp sends the user to
    // /create-studio automatically.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-text">Create your account</h1>
        <p className="mb-7 mt-1 text-center text-sm text-text-muted">You'll set up your studio next</p>

        <Field label="Email">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoCapitalize="none"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </Field>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}
        {info ? <p className="mb-3 text-center text-sm text-success">{info}</p> : null}

        <Button type="submit" loading={loading} disabled={!email || !password} className="w-full">
          Sign up
        </Button>

        <p className="mt-5 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
