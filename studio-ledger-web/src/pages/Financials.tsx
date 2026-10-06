import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { currentMonth, formatDate, recentMonths } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui";
import TopBar from "@/components/TopBar";
import type { Employee, Expense, Member, Payment, Visit } from "@/types/database";

interface LedgerEntry {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: "income" | "expense";
}

const LOOKBACK_MONTHS = 6;

export default function Financials() {
  const { staffUser, studio } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const months = recentMonths(LOOKBACK_MONTHS);
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - LOOKBACK_MONTHS);
    const since = sinceDate.toISOString().slice(0, 10);

    const [membersRes, paymentsRes, visitsRes, expensesRes, employeesRes] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.from("payments").select("*").eq("paid", true).in("month", months),
      supabase.from("visits").select("*").gte("visited_on", since).not("amount", "is", null),
      supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", since)
        .order("expense_date", { ascending: false }),
      supabase.from("employees").select("*").eq("status", "active"),
    ]);

    if (membersRes.error) setError(membersRes.error.message);
    setMembers(membersRes.data ?? []);
    setPayments(paymentsRes.data ?? []);
    setVisits(visitsRes.data ?? []);
    setExpenses(expensesRes.data ?? []);
    setEmployees(employeesRes.data ?? []);
  }, [staffUser]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = useCallback(
    (memberId: string) => members.find((m) => m.id === memberId)?.name ?? "Unknown",
    [members]
  );

  const thisMonth = currentMonth();
  const monthlyPayroll = employees.reduce((sum, e) => sum + e.monthly_pay, 0);

  const thisMonthIncome =
    payments.filter((p) => p.month === thisMonth).reduce((sum, p) => sum + (p.amount ?? 0), 0) +
    visits.filter((v) => v.visited_on.startsWith(thisMonth)).reduce((sum, v) => sum + (v.amount ?? 0), 0);

  const thisMonthExpenses = expenses
    .filter((e) => e.expense_date.startsWith(thisMonth))
    .reduce((sum, e) => sum + e.amount, 0);

  const net = thisMonthIncome - thisMonthExpenses - monthlyPayroll;

  const ledger: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];
    for (const p of payments) {
      entries.push({
        id: `payment-${p.id}`,
        date: p.paid_on ?? p.created_at.slice(0, 10),
        label: `${memberName(p.member_id)} · membership`,
        amount: p.amount ?? 0,
        type: "income",
      });
    }
    for (const v of visits) {
      entries.push({
        id: `visit-${v.id}`,
        date: v.visited_on,
        label: `${memberName(v.member_id)}${v.service ? ` · ${v.service}` : ""}`,
        amount: v.amount ?? 0,
        type: "income",
      });
    }
    for (const e of expenses) {
      entries.push({
        id: `expense-${e.id}`,
        date: e.expense_date,
        label: e.description ? `${e.category} · ${e.description}` : e.category,
        amount: e.amount,
        type: "expense",
      });
    }
    return entries.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  }, [payments, visits, expenses, memberName]);

  return (
    <div>
      <TopBar title="Financials" />
      <div className="p-4 pb-10">
        <div className="mb-2.5 flex gap-2.5">
          <Card className="flex-1">
            <div className="text-xs text-text-muted">Income</div>
            <div className="mt-1 text-lg font-bold text-success">{formatMoney(thisMonthIncome, studio?.currency)}</div>
          </Card>
          <Card className="flex-1">
            <div className="text-xs text-text-muted">Expenses</div>
            <div className="mt-1 text-lg font-bold text-danger">
              {formatMoney(thisMonthExpenses + monthlyPayroll, studio?.currency)}
            </div>
          </Card>
        </div>

        <Card className="mb-5">
          <div className="text-xs text-text-muted">Net this month</div>
          <div className={`mt-1 text-[26px] font-bold ${net >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(net, studio?.currency)}
          </div>
          <div className="mt-2 text-xs text-text-muted">
            Includes {formatMoney(monthlyPayroll, studio?.currency)} payroll for {employees.length} active{" "}
            {employees.length === 1 ? "employee" : "employees"}.
          </div>
        </Card>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        <h2 className="mb-2.5 text-[15px] font-bold text-text">Recent transactions</h2>
        {ledger.length === 0 ? (
          <p className="mt-5 text-center text-sm text-text-muted">Nothing recorded yet.</p>
        ) : (
          ledger.map((item) => (
            <div
              key={item.id}
              className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="truncate text-sm font-semibold capitalize text-text">{item.label}</div>
                <div className="mt-0.5 text-xs text-text-muted">{formatDate(item.date)}</div>
              </div>
              <div className={`text-[15px] font-bold ${item.type === "income" ? "text-success" : "text-danger"}`}>
                {item.type === "income" ? "+" : "-"}
                {formatMoney(item.amount, studio?.currency)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
