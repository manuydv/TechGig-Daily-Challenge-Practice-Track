import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import { currentMonth, daysSince } from "@/lib/dates";
import { Badge, Input } from "@/components/ui";
import { Segmented } from "@/components/Field";
import { IconPlus } from "@/components/icons";
import TopBar from "@/components/TopBar";
import type { Gender, Member, MemberStatus } from "@/types/database";

type StatusFilter = MemberStatus | "all";
type GenderFilter = Gender | "all";

export default function ClientsList() {
  const { staffUser, studio } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");
  const reminderDays = studio?.reminder_days ?? 30;

  const [members, setMembers] = useState<Member[]>([]);
  const [paidMemberIds, setPaidMemberIds] = useState<Set<string>>(new Set());
  const [lastVisitByMember, setLastVisitByMember] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const membersRes = await supabase.from("members").select("*").order("name", { ascending: true });

    if (membersRes.error) {
      setError(membersRes.error.message);
    } else {
      setMembers(membersRes.data ?? []);
    }

    if (config.mode === "membership") {
      const paymentsRes = await supabase
        .from("payments")
        .select("member_id")
        .eq("month", currentMonth())
        .eq("paid", true);
      if (!paymentsRes.error) {
        setPaidMemberIds(new Set((paymentsRes.data ?? []).map((p) => p.member_id)));
      }
    } else {
      const visitsRes = await supabase
        .from("visits")
        .select("member_id, visited_on")
        .order("visited_on", { ascending: false });
      if (!visitsRes.error) {
        const latest: Record<string, string> = {};
        for (const visit of visitsRes.data ?? []) {
          if (!latest[visit.member_id]) latest[visit.member_id] = visit.visited_on;
        }
        setLastVisitByMember(latest);
      }
    }

    setLoading(false);
  }, [staffUser, config.mode]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (term && !m.name.toLowerCase().includes(term)) return false;
      if (config.mode === "membership" && statusFilter !== "all" && m.status !== statusFilter) return false;
      if (genderFilter !== "all" && m.gender !== genderFilter) return false;
      return true;
    });
  }, [members, search, statusFilter, genderFilter, config.mode]);

  return (
    <div className="relative min-h-[calc(100vh-6rem)]">
      <TopBar title={config.personLabelPlural} />

      <div className="px-4 pt-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${config.personLabelPlural.toLowerCase()}`}
          className="mb-3"
        />

        {config.mode === "membership" ? (
          <Segmented
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Paused", value: "paused" },
              { label: "Inactive", value: "inactive" },
            ]}
          />
        ) : null}
        <Segmented
          label="Gender"
          value={genderFilter}
          onChange={setGenderFilter}
          options={[
            { label: "All", value: "all" },
            { label: "Female", value: "female" },
            { label: "Male", value: "male" },
            { label: "Other", value: "other" },
          ]}
        />
      </div>

      {error ? <p className="px-4 text-center text-sm text-danger">{error}</p> : null}

      <div className="px-4 pb-4">
        {!loading && filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-text-muted">
            No {config.personLabelPlural.toLowerCase()} yet. Add your first one.
          </p>
        ) : (
          filtered.map((item) => {
            if (config.mode === "visit") {
              const lastVisit = lastVisitByMember[item.id];
              const since = lastVisit ? daysSince(lastVisit) : null;
              const isDue = since !== null && since >= reminderDays;
              const badgeLabel = lastVisit ? (isDue ? "Due" : `${since}d ago`) : "New";
              return (
                <Link
                  key={item.id}
                  to={`/clients/${item.id}`}
                  className="mb-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="truncate text-[15px] font-semibold text-text">{item.name}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{item.phone ?? "No phone on file"}</div>
                  </div>
                  <Badge tone={isDue || !lastVisit ? "danger" : "success"}>{badgeLabel}</Badge>
                </Link>
              );
            }

            const paid = paidMemberIds.has(item.id);
            return (
              <Link
                key={item.id}
                to={`/clients/${item.id}`}
                className="mb-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="truncate text-[15px] font-semibold text-text">{item.name}</div>
                  <div className="mt-0.5 text-xs capitalize text-text-muted">
                    {item.status} · fee {item.monthly_fee}
                  </div>
                </div>
                <Badge tone={paid ? "success" : "danger"}>{paid ? "Paid" : "Unpaid"}</Badge>
              </Link>
            );
          })
        )}
      </div>

      <Link
        to="/clients/new"
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <IconPlus />
      </Link>
    </div>
  );
}
