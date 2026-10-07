import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { computeCheckinStats } from "@/lib/checkin";
import { today } from "@/lib/dates";
import { Button, Input, StatTile } from "@/components/ui";
import { Field } from "@/components/Field";
import { IconCalendarCheck, IconClock, IconFlame, IconPercent } from "@/components/icons";
import LoadingScreen from "@/components/LoadingScreen";
import type { BusinessType } from "@/types/database";

interface CheckinResult {
  member_name: string;
  recent_visits: string[];
}

export default function Checkin() {
  const { slug } = useParams<{ slug: string }>();
  const [studioInfo, setStudioInfo] = useState<{ name: string; business_type: BusinessType } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .rpc("get_checkin_studio", { intake_slug: slug ?? "" })
      .then(({ data, error: rpcError }) => {
        if (!mounted) return;
        if (rpcError || !data || data.length === 0) {
          setNotFound(true);
        } else {
          setStudioInfo(data[0]);
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) return <LoadingScreen />;

  if (notFound || !studioInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
        <h1 className="text-xl font-bold text-text">Check-in not active</h1>
        <p className="mt-2 text-sm text-text-muted">This link isn't set up for check-in. Ask the front desk.</p>
      </div>
    );
  }

  if (result) {
    const stats = computeCheckinStats(result.recent_visits, today());
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold text-text">Welcome back, {result.member_name.split(" ")[0]}!</h1>
          <p className="mb-6 mt-1 text-center text-sm text-text-muted">You're checked in at {studioInfo.name}.</p>

          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={<IconFlame />} value={stats.weekStreak} label="Week streak" />
            <StatTile icon={<IconCalendarCheck />} value={stats.thisWeekVisits} label="This week" />
            <StatTile icon={<IconPercent />} value={`${stats.attendancePct}%`} label="Attendance" />
            <StatTile icon={<IconClock />} value={stats.totalVisits} label="Visits (10 wks)" />
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !pin.trim()) {
      setError("Enter your phone number and PIN.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc("public_check_in", {
      intake_slug: slug ?? "",
      client_phone: phone.trim(),
      pin: pin.trim(),
    });
    setSubmitting(false);
    if (rpcError || !data || data.length === 0) {
      setError(rpcError?.message ?? "Couldn't check you in.");
      return;
    }
    setResult({ member_name: data[0].member_name, recent_visits: data[0].recent_visits });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-text">Check in at {studioInfo.name}</h1>
        <p className="mb-7 mt-2 text-center text-sm text-text-muted">
          Enter your phone number and the PIN the front desk gave you.
        </p>

        <Field label="Phone number">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoFocus />
        </Field>
        <Field label="PIN">
          <Input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />
        </Field>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        <Button type="submit" loading={submitting} disabled={!phone.trim() || !pin.trim()} className="w-full">
          Check in
        </Button>
      </form>
    </div>
  );
}
