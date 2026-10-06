import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import TopBar from "@/components/TopBar";
import type { Employee } from "@/types/database";

export default function EmployeesList() {
  const { staffUser, studio } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const { data, error: fetchError } = await supabase.from("employees").select("*").order("name", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEmployees(data ?? []);
    }
    setLoading(false);
  }, [staffUser]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMonthlyPay = employees.filter((e) => e.status === "active").reduce((sum, e) => sum + e.monthly_pay, 0);

  return (
    <div className="relative min-h-[calc(100vh-6rem)]">
      <TopBar title="Employees" back />
      <div className="p-4">
        <Card className="mb-4">
          <div className="text-xs text-text-muted">Active payroll / month</div>
          <div className="mt-1 text-xl font-bold text-text">{formatMoney(totalMonthlyPay, studio?.currency)}</div>
        </Card>

        {error ? <p className="mb-3 text-center text-sm text-danger">{error}</p> : null}

        {!loading && employees.length === 0 ? (
          <p className="mt-10 text-center text-sm text-text-muted">No employees yet. Add your first one.</p>
        ) : (
          employees.map((item) => (
            <Link
              key={item.id}
              to={`/employees/${item.id}`}
              className="mb-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="text-[15px] font-semibold text-text">{item.name}</div>
                <div className="mt-0.5 text-xs text-text-muted">{item.role_title || "No title"}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-text">{formatMoney(item.monthly_pay, studio?.currency)}</div>
                <div className={`mt-0.5 text-xs capitalize ${item.status === "inactive" ? "text-text-muted" : "text-success"}`}>
                  {item.status}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <Link
        to="/employees/new"
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <IconPlus />
      </Link>
    </div>
  );
}
