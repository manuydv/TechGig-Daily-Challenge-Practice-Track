import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import ExpenseForm, { validateExpenseForm } from "@/components/forms/ExpenseForm";
import type { ExpenseFormValues } from "@/components/forms/ExpenseForm";
import { Button } from "@/components/ui";
import TopBar from "@/components/TopBar";
import { today } from "@/lib/dates";

const initialValues: ExpenseFormValues = {
  category: "rent",
  description: "",
  amount: "",
  expenseDate: today(),
};

export default function ExpenseNew() {
  const navigate = useNavigate();
  const { staffUser } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateExpenseForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!staffUser) return;

    setSubmitError(null);
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      studio_id: staffUser.studio_id,
      category: values.category,
      description: values.description.trim() || null,
      amount: Number(values.amount),
      expense_date: values.expenseDate,
    });
    setSaving(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }
    navigate("/expenses");
  };

  return (
    <div>
      <TopBar title="Add expense" back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <ExpenseForm values={values} errors={errors} onChange={handleChange} />
        {submitError ? <p className="mb-3 text-center text-sm text-danger">{submitError}</p> : null}
        <Button type="submit" loading={saving} className="w-full">
          Add expense
        </Button>
      </form>
    </div>
  );
}
