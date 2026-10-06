import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import TopBar from "@/components/TopBar";
import type { Expense } from "@/types/database";

export default function ExpensesList() {
  const { staffUser, studio } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(100);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }, [staffUser]);

  useEffect(() => {
    load();
  }, [load]);

  const thisMonthTotal = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return expenses.filter((e) => e.expense_date.startsWith(prefix)).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <div className="relative min-h-[calc(100vh-6rem)]">
      <TopBar title="Expenses" />
      <div className="p-4">
        <Card className="mb-4">
          <div className="text-xs text-text-muted">This month's expenses</div>
          <div className="mt-1 text-xl font-bold text-text">{formatMoney(thisMonthTotal, studio?.currency)}</div>
        </Card>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        {!loading && expenses.length === 0 ? (
          <p className="mt-10 text-center text-sm text-text-muted">No expenses logged yet.</p>
        ) : (
          expenses.map((item) => (
            <Link
              key={item.id}
              to={`/expenses/${item.id}`}
              className="mb-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="text-[15px] font-semibold capitalize text-text">{item.category}</div>
                {item.description ? <div className="mt-0.5 text-xs text-text-muted">{item.description}</div> : null}
                <div className="mt-0.5 text-xs text-text-muted">{formatDate(item.expense_date)}</div>
              </div>
              <div className="text-[15px] font-bold text-danger">{formatMoney(item.amount, studio?.currency)}</div>
            </Link>
          ))
        )}
      </div>

      <Link
        to="/expenses/new"
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <IconPlus />
      </Link>
    </div>
  );
}
