import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button, Card, Input } from "@/components/ui";
import { Field } from "@/components/Field";
import BusinessTypePicker from "@/components/BusinessTypePicker";
import TopBar from "@/components/TopBar";
import LoadingScreen from "@/components/LoadingScreen";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import type { BusinessType } from "@/types/database";

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function Settings() {
  const { studio } = useAuth();
  if (!studio) return <LoadingScreen />;
  return <SettingsForm key={studio.id} />;
}

function SettingsForm() {
  const { studio, refreshStudio } = useAuth();

  const [businessType, setBusinessType] = useState<BusinessType>(studio!.business_type);
  const [reminderDays, setReminderDays] = useState(String(studio!.reminder_days));
  const [reminderMessage, setReminderMessage] = useState(studio!.reminder_message ?? "");
  const [intakeEnabled, setIntakeEnabled] = useState(studio!.public_intake_enabled);
  const [intakeSlug, setIntakeSlug] = useState(studio!.public_intake_slug);
  const [checkinEnabled, setCheckinEnabled] = useState(studio!.public_checkin_enabled);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggleIntake = () => {
    const next = !intakeEnabled;
    setIntakeEnabled(next);
    if (next && !intakeSlug) setIntakeSlug(randomSlug());
  };

  const handleToggleCheckin = () => {
    const next = !checkinEnabled;
    setCheckinEnabled(next);
    if (next && !intakeSlug) setIntakeSlug(randomSlug());
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const days = Number(reminderDays);
    if (!Number.isFinite(days) || days <= 0) {
      setError("Reminder days must be a positive number.");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from("studios")
      .update({
        business_type: businessType,
        reminder_days: days,
        reminder_message: reminderMessage.trim() || null,
        public_intake_enabled: intakeEnabled,
        public_checkin_enabled: checkinEnabled,
        public_intake_slug: intakeEnabled || checkinEnabled ? intakeSlug : studio!.public_intake_slug,
      })
      .eq("id", studio!.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshStudio();
    setSavedMessage("Shop settings updated.");
  };

  const intakeConfig = getBusinessTypeConfig(businessType);
  const intakeLink = intakeSlug ? `${window.location.origin}/intake/${intakeSlug}` : null;
  const checkinLink = intakeSlug ? `${window.location.origin}/checkin/${intakeSlug}` : null;

  return (
    <div>
      <TopBar title="Settings" />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <BusinessTypePicker value={businessType} onChange={setBusinessType} />

        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold text-text">Self check-in link</div>
            <button
              type="button"
              onClick={handleToggleCheckin}
              className={`h-7 w-12 rounded-full transition ${checkinEnabled ? "bg-accent" : "bg-surface-raised"}`}
            >
              <span
                className={`block h-5 w-5 translate-y-1 rounded-full bg-white transition ${
                  checkinEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Let a {intakeConfig.personLabelSingular.toLowerCase()} check themselves in with their phone number and
            a PIN (set one from their profile), and see their own streak and attendance — no app install, no
            account.
          </p>
          {checkinEnabled && checkinLink ? (
            <>
              <p className="mt-3 text-xs font-semibold text-text-muted">Share this link:</p>
              <a href={checkinLink} className="mt-1 block break-all text-sm text-accent">
                {checkinLink}
              </a>
            </>
          ) : null}
        </Card>

        {intakeConfig.mode === "visit" ? (
          <>
            <Field label="Remind after (days since last visit)">
              <Input value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Reminder message (optional)">
              <textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="e.g. Time for a fresh cut! Show this text for 10% off."
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </Field>

            <Card className="mb-4">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-semibold text-text">Self-serve sign-up link</div>
                <button
                  type="button"
                  onClick={handleToggleIntake}
                  className={`h-7 w-12 rounded-full transition ${intakeEnabled ? "bg-accent" : "bg-surface-raised"}`}
                >
                  <span
                    className={`block h-5 w-5 translate-y-1 rounded-full bg-white transition ${
                      intakeEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Let a walk-in {intakeConfig.personLabelSingular.toLowerCase()} fill in their own name and phone
                number on their own phone, without a staff member typing it in.
              </p>
              {intakeEnabled && intakeLink ? (
                <>
                  <p className="mt-3 text-xs font-semibold text-text-muted">Share this link:</p>
                  <a href={intakeLink} className="mt-1 block break-all text-sm text-accent">
                    {intakeLink}
                  </a>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    Works on any phone's browser — no app install needed. Paste it into a QR code generator to
                    make a scannable poster for the front desk.
                  </p>
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}
        {savedMessage ? <p className="mb-3 text-center text-sm text-success">{savedMessage}</p> : null}

        <Button type="submit" loading={saving} className="w-full">
          Save settings
        </Button>
      </form>
    </div>
  );
}
