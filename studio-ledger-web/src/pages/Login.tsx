import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button, Input } from "@/components/ui";
import { Field } from "@/components/Field";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError);
    // On success, RequireApp sends the user into the app automatically.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-text">Studio Ledger</h1>
        <p className="mb-7 mt-1 text-center text-sm text-text-muted">Sign in to your studio</p>

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
            autoComplete="current-password"
          />
        </Field>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        <Button type="submit" loading={loading} disabled={!email || !password} className="w-full">
          Sign in
        </Button>

        <p className="mt-5 text-center text-sm text-text-muted">
          New studio?{" "}
          <Link to="/signup" className="font-semibold text-accent">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
