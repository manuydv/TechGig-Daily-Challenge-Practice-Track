import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import ExpenseForm, { validateExpenseForm } from "@/components/forms/ExpenseForm";
import type { ExpenseFormValues } from "@/components/forms/ExpenseForm";
import { Button } from "@/components/ui";
import TopBar from "@/components/TopBar";
import LoadingScreen from "@/components/LoadingScreen";
import type { Expense } from "@/types/database";

function toFormValues(expense: Expense): ExpenseFormValues {
  return {
    category: expense.category,
    description: expense.description ?? "",
    amount: String(expense.amount),
    expenseDate: expense.expense_date,
  };
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [values, setValues] = useState<ExpenseFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const { data, error: fetchError } = await supabase.from("expenses").select("*").eq("id", id).single();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setExpense(data);
    setValues(toFormValues(data));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !values) return <LoadingScreen />;
  if (error || !expense) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-danger">{error ?? "Expense not found."}</p>
      </div>
    );
  }

  const handleChange = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateExpenseForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setSavedMessage(null);
    const { error: updateError } = await supabase
      .from("expenses")
      .update({
        category: values.category,
        description: values.description.trim() || null,
        amount: Number(values.amount),
        expense_date: values.expenseDate,
      })
      .eq("id", expense.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    setSavedMessage("Expense updated.");
  };

  const handleDelete = async () => {
    if (!window.confirm("Remove this expense entry? This can't be undone.")) return;
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (deleteError) {
      window.alert(`Couldn't delete: ${deleteError.message}`);
      return;
    }
    navigate("/expenses");
  };

  return (
    <div>
      <TopBar title="Expense" back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <ExpenseForm values={values} errors={errors} onChange={handleChange} />
        {savedMessage ? <p className="mb-3 text-center text-sm text-success">{savedMessage}</p> : null}
        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} className="mt-3 w-full">
          Delete expense
        </Button>
      </form>
    </div>
  );
}
