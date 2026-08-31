import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { currentMonth, formatDate, recentMonths } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { colors } from "@/lib/theme";
import type { Employee, Expense, Member, Payment, Visit } from "@/types/database";

interface LedgerEntry {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: "income" | "expense";
}

const LOOKBACK_MONTHS = 6;

export default function FinancialsScreen() {
  const { staffUser, studio } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TEMPORARY diagnostic logging while chasing a "gets stuck on Financials"
  // report — remove once resolved. Each query is timed and logged
  // individually (instead of one bare Promise.all) so a hang shows up as a
  // specific query that never logs "done", rather than just silence.
  const load = useCallback(async () => {
    console.log("[financials] load: called, staffUser =", staffUser?.id ?? null);
    if (!staffUser) {
      console.log("[financials] load: no staffUser yet, bailing without clearing loading");
      return;
    }
    setError(null);
    const months = recentMonths(LOOKBACK_MONTHS);
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - LOOKBACK_MONTHS);
    const since = sinceDate.toISOString().slice(0, 10);

    const timed = <T,>(label: string, p: PromiseLike<T>): Promise<T> => {
      console.log(`[financials] ${label}: starting`);
      const start = Date.now();
      return Promise.resolve(p).then(
        (res) => {
          console.log(`[financials] ${label}: done in ${Date.now() - start}ms`);
          return res;
        },
        (err) => {
          console.log(`[financials] ${label}: threw after ${Date.now() - start}ms`, err);
          throw err;
        }
      );
    };

    const [membersRes, paymentsRes, visitsRes, expensesRes, employeesRes] = await Promise.all([
      timed("members query", supabase.from("members").select("*")),
      timed("payments query", supabase.from("payments").select("*").eq("paid", true).in("month", months)),
      timed(
        "visits query",
        supabase.from("visits").select("*").gte("visited_on", since).not("amount", "is", null)
      ),
      timed(
        "expenses query",
        supabase.from("expenses").select("*").gte("expense_date", since).order("expense_date", { ascending: false })
      ),
      timed("employees query", supabase.from("employees").select("*").eq("status", "active")),
    ]);
    console.log("[financials] load: all queries settled");

    if (membersRes.error) setError(membersRes.error.message);
    if (paymentsRes.error) console.log("[financials] payments query error:", paymentsRes.error.message);
    if (visitsRes.error) console.log("[financials] visits query error:", visitsRes.error.message);
    if (expensesRes.error) console.log("[financials] expenses query error:", expensesRes.error.message);
    if (employeesRes.error) console.log("[financials] employees query error:", employeesRes.error.message);
    setMembers(membersRes.data ?? []);
    setPayments(paymentsRes.data ?? []);
    setVisits(visitsRes.data ?? []);
    setExpenses(expensesRes.data ?? []);
    setEmployees(employeesRes.data ?? []);
    setLoading(false);
    console.log("[financials] load: finished");
  }, [staffUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const memberName = useCallback(
    (memberId: string) => members.find((m) => m.id === memberId)?.name ?? "Unknown",
    [members]
  );

  const thisMonth = currentMonth();
  const monthlyPayroll = employees.reduce((sum, e) => sum + e.monthly_pay, 0);

  const thisMonthIncome =
    payments.filter((p) => p.month === thisMonth).reduce((sum, p) => sum + (p.amount ?? 0), 0) +
    visits
      .filter((v) => v.visited_on.startsWith(thisMonth))
      .reduce((sum, v) => sum + (v.amount ?? 0), 0);

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
    <View style={styles.flex}>
      <FlatList
        data={ledger}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.summaryCardLeft]}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, styles.income]}>
                  {formatMoney(thisMonthIncome, studio?.currency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, styles.expense]}>
                  {formatMoney(thisMonthExpenses + monthlyPayroll, studio?.currency)}
                </Text>
              </View>
            </View>
            <View style={styles.netCard}>
              <Text style={styles.summaryLabel}>Net this month</Text>
              <Text style={[styles.netValue, net >= 0 ? styles.income : styles.expense]}>
                {formatMoney(net, studio?.currency)}
              </Text>
              <Text style={styles.netHint}>
                Includes {formatMoney(monthlyPayroll, studio?.currency)} payroll for{" "}
                {employees.length} active {employees.length === 1 ? "employee" : "employees"}.
              </Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>Recent transactions</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nothing recorded yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={[styles.rowAmount, item.type === "income" ? styles.income : styles.expense]}>
              {item.type === "income" ? "+" : "-"}
              {formatMoney(item.amount, studio?.currency)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 48 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  summaryCardLeft: {},
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  netCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  netValue: { fontSize: 26, fontWeight: "700", marginTop: 4 },
  netHint: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  income: { color: colors.success },
  expense: { color: colors.danger },
  error: { color: colors.danger, textAlign: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  rowMain: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text, textTransform: "capitalize" },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: "700" },
});
