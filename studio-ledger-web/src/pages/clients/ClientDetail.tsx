import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import MemberForm, { validateMemberForm } from "@/components/forms/MemberForm";
import type { MemberFormValues } from "@/components/forms/MemberForm";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Field } from "@/components/Field";
import TopBar from "@/components/TopBar";
import LoadingScreen from "@/components/LoadingScreen";
import {
  currentMonth,
  daysSince,
  dueDateForMonth,
  formatDate,
  formatMonth,
  recentMonths,
  today,
} from "@/lib/dates";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import type { Member, Payment, Visit } from "@/types/database";

const HISTORY_MONTHS = 6;
const VISIT_HISTORY_LIMIT = 10;

function toFormValues(member: Member): MemberFormValues {
  return {
    name: member.name,
    gender: member.gender ?? "",
    phone: member.phone ?? "",
    email: member.email ?? "",
    joinedOn: member.joined_on,
    monthlyFee: String(member.monthly_fee),
    status: member.status,
  };
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { studio } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");
  const reminderDays = studio?.reminder_days ?? 30;

  const [member, setMember] = useState<Member | null>(null);
  const [values, setValues] = useState<MemberFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateMemberForm>>({});
  const [paymentsByMonth, setPaymentsByMonth] = useState<Record<string, Payment>>({});
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitService, setVisitService] = useState("");
  const [visitAmount, setVisitAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [loggingVisit, setLoggingVisit] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);

    const memberRes = await supabase.from("members").select("*").eq("id", id).single();
    if (memberRes.error) {
      setError(memberRes.error.message);
      setLoading(false);
      return;
    }
    setMember(memberRes.data);
    setValues(toFormValues(memberRes.data));

    if (config.mode === "membership") {
      const months = recentMonths(HISTORY_MONTHS);
      const paymentsRes = await supabase.from("payments").select("*").eq("member_id", id).in("month", months);
      const map: Record<string, Payment> = {};
      for (const payment of paymentsRes.data ?? []) {
        map[payment.month] = payment;
      }
      setPaymentsByMonth(map);
    } else {
      const visitsRes = await supabase
        .from("visits")
        .select("*")
        .eq("member_id", id)
        .order("visited_on", { ascending: false })
        .limit(VISIT_HISTORY_LIMIT);
      setVisits(visitsRes.data ?? []);
    }

    setLoading(false);
  }, [id, config.mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !values) return <LoadingScreen />;
  if (error || !member) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-danger">{error ?? `${config.personLabelSingular} not found.`}</p>
      </div>
    );
  }

  const handleChange = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateMemberForm(values, config.mode);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setSavedMessage(null);
    const { error: updateError } = await supabase
      .from("members")
      .update({
        name: values.name.trim(),
        gender: values.gender || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        joined_on: values.joinedOn,
        monthly_fee: config.mode === "membership" ? Number(values.monthlyFee) : 0,
        status: config.mode === "membership" ? values.status : "active",
      })
      .eq("id", member.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    setSavedMessage(`${config.personLabelSingular} details updated.`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${member.name} and their history? This can't be undone.`)) return;
    const { error: deleteError } = await supabase.from("members").delete().eq("id", member.id);
    if (deleteError) {
      window.alert(`Couldn't delete: ${deleteError.message}`);
      return;
    }
    navigate("/clients");
  };

  const togglePaid = async (month: string, nextPaid: boolean) => {
    setMarkingPaid(true);
    const { error: upsertError } = await supabase.from("payments").upsert(
      {
        member_id: member.id,
        month,
        paid: nextPaid,
        amount: nextPaid ? member.monthly_fee : null,
      },
      { onConflict: "member_id,month" }
    );
    setMarkingPaid(false);
    if (upsertError) {
      window.alert(`Couldn't update payment: ${upsertError.message}`);
      return;
    }
    await load();
  };

  const handleLogVisit = async () => {
    setLoggingVisit(true);
    const { error: insertError } = await supabase.from("visits").insert({
      member_id: member.id,
      visited_on: today(),
      service: visitService.trim() || null,
      amount: visitAmount.trim() ? Number(visitAmount) : null,
    });
    setLoggingVisit(false);
    if (insertError) {
      window.alert(`Couldn't log visit: ${insertError.message}`);
      return;
    }
    setVisitService("");
    setVisitAmount("");
    await load();
  };

  const handleSetPin = async () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setSavingPin(true);
    const { error: pinError } = await supabase.from("members").update({ check_in_pin: pin }).eq("id", member.id);
    setSavingPin(false);
    if (pinError) {
      window.alert(`Couldn't set PIN: ${pinError.message}`);
      return;
    }
    await load();
  };

  const handleRemovePin = async () => {
    setSavingPin(true);
    const { error: pinError } = await supabase.from("members").update({ check_in_pin: null }).eq("id", member.id);
    setSavingPin(false);
    if (pinError) {
      window.alert(`Couldn't remove PIN: ${pinError.message}`);
      return;
    }
    await load();
  };

  const checkinPinCard = (
    <Card className="mb-6">
      <div className="text-[15px] font-bold text-text">Check-in PIN</div>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        Lets {member.name.split(" ")[0]} check themselves in on the shared check-in link using their phone number
        and this PIN, without needing an account.
      </p>
      {member.check_in_pin ? (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-[0.3em] text-text">{member.check_in_pin}</div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleSetPin} loading={savingPin}>
              Change
            </Button>
            <Button type="button" variant="danger" onClick={handleRemovePin} loading={savingPin}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={handleSetPin} loading={savingPin} className="mt-3 w-full">
          Set a PIN
        </Button>
      )}
    </Card>
  );

  const detailsForm = (
    <>
      <h2 className="mb-2.5 mt-6 text-[15px] font-bold text-text">{config.personLabelSingular} details</h2>
      <MemberForm values={values} errors={errors} mode={config.mode} onChange={handleChange} />
      {savedMessage ? <p className="mb-3 text-center text-sm text-success">{savedMessage}</p> : null}
      <Button type="submit" loading={saving} className="w-full">
        Save changes
      </Button>
      <Button type="button" variant="danger" onClick={handleDelete} className="mt-3 w-full">
        Delete {config.personLabelSingular.toLowerCase()}
      </Button>
    </>
  );

  if (config.mode === "visit") {
    const lastVisit = visits[0];
    const sinceLast = lastVisit ? daysSince(lastVisit.visited_on) : null;
    const isDue = sinceLast !== null && sinceLast >= reminderDays;

    return (
      <div>
        <TopBar title={config.personLabelSingular} back />
        <form onSubmit={handleSave} className="p-4 pb-10">
          <Card className="mb-6">
            <div className="text-lg font-bold text-text">Last visit</div>
            <div className="mb-3 mt-0.5 text-sm text-text-muted">
              {lastVisit ? `${formatDate(lastVisit.visited_on)} (${sinceLast} days ago)` : "No visits yet"}
            </div>
            <Badge tone={isDue || !lastVisit ? "danger" : "success"}>
              {lastVisit ? (isDue ? "Due for a reminder" : "Recently visited") : "New client"}
            </Badge>
          </Card>

          <h2 className="mb-2.5 text-[15px] font-bold text-text">Log a visit</h2>
          <Card className="mb-6">
            <Field label="Service (optional)">
              <Input value={visitService} onChange={(e) => setVisitService(e.target.value)} placeholder="e.g. Haircut + beard trim" />
            </Field>
            <Field label="Amount charged (optional)">
              <Input value={visitAmount} onChange={(e) => setVisitAmount(e.target.value)} placeholder="e.g. 300" inputMode="decimal" />
            </Field>
            <Button type="button" onClick={handleLogVisit} loading={loggingVisit} className="w-full">
              Log visit today
            </Button>
          </Card>

          <h2 className="mb-2.5 text-[15px] font-bold text-text">Visit history</h2>
          <Card className="mb-6 divide-y divide-border p-0">
            {visits.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-muted">No visits logged yet.</p>
            ) : (
              visits.map((visit) => (
                <div key={visit.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-text">{formatDate(visit.visited_on)}</div>
                    {visit.service ? <div className="mt-0.5 text-xs text-text-muted">{visit.service}</div> : null}
                  </div>
                  {visit.amount != null ? <div className="text-sm font-semibold text-text">{visit.amount}</div> : null}
                </div>
              ))
            )}
          </Card>

          {checkinPinCard}
          {detailsForm}
        </form>
      </div>
    );
  }

  const thisMonth = currentMonth();
  const thisMonthPaid = paymentsByMonth[thisMonth]?.paid ?? false;
  const dueDate = dueDateForMonth(member.joined_on, thisMonth);

  return (
    <div>
      <TopBar title={config.personLabelSingular} back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <Card className="mb-6">
          <div className="text-lg font-bold text-text">{formatMonth(thisMonth)}</div>
          <div className="mb-3 mt-0.5 text-sm text-text-muted">Due {dueDate}</div>
          <div className="flex items-center justify-between">
            <Badge tone={thisMonthPaid ? "success" : "danger"}>{thisMonthPaid ? "Paid" : "Unpaid"}</Badge>
            <Button
              type="button"
              variant={thisMonthPaid ? "secondary" : "primary"}
              loading={markingPaid}
              onClick={() => togglePaid(thisMonth, !thisMonthPaid)}
            >
              {thisMonthPaid ? "Mark unpaid" : "Mark paid"}
            </Button>
          </div>
        </Card>

        <h2 className="mb-2.5 text-[15px] font-bold text-text">Payment history</h2>
        <Card className="mb-6 divide-y divide-border p-0">
          {recentMonths(HISTORY_MONTHS).map((month) => {
            const paid = paymentsByMonth[month]?.paid ?? false;
            return (
              <div key={month} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-semibold text-text">{formatMonth(month)}</div>
                <div className={`text-sm font-semibold ${paid ? "text-success" : "text-text-muted"}`}>
                  {paid ? "Paid" : "Unpaid"}
                </div>
              </div>
            );
          })}
        </Card>

        {checkinPinCard}
        {detailsForm}
      </form>
    </div>
  );
}
