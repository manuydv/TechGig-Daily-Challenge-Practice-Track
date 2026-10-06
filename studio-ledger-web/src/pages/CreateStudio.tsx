import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button, Input } from "@/components/ui";
import { Field } from "@/components/Field";
import BusinessTypePicker from "@/components/BusinessTypePicker";
import LoadingScreen from "@/components/LoadingScreen";
import type { BusinessType } from "@/types/database";

export default function CreateStudio() {
  const { session, staffUser, loading, refreshStaffUser, signOut } = useAuth();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("yoga_studio");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (staffUser) return <Navigate to="/" replace />;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give your shop a name.");
      return;
    }
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("create_studio", {
      studio_name: name.trim(),
      business_type: businessType,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }
    await refreshStaffUser();
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6 py-10">
      <form onSubmit={handleCreate} className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-text">Set up your shop</h1>
        <p className="mb-7 mt-1 text-center text-sm text-text-muted">
          You can invite staff and customize settings later.
        </p>

        <Field label="Shop name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tara Shakti Yoga Studio" />
        </Field>

        <BusinessTypePicker value={businessType} onChange={setBusinessType} />

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        <Button type="submit" loading={submitting} disabled={!name.trim()} className="w-full">
          Create shop
        </Button>

        {signingOut ? (
          <div className="mt-5 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-text-muted" />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-5 block w-full text-center text-sm text-text-muted"
          >
            Sign out
          </button>
        )}
      </form>
    </div>
  );
}
