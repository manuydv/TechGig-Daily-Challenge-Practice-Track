import { Field, Segmented } from "@/components/Field";
import { Input } from "@/components/ui";
import { isValidDate } from "@/lib/dates";
import type { ExpenseCategory } from "@/types/database";

export interface ExpenseFormValues {
  category: ExpenseCategory;
  description: string;
  amount: string;
  expenseDate: string;
}

export interface ExpenseFormErrors {
  amount?: string;
  expenseDate?: string;
}

export function validateExpenseForm(values: ExpenseFormValues): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {};
  if (!isValidDate(values.expenseDate)) errors.expenseDate = "Use the format YYYY-MM-DD.";
  const amount = Number(values.amount);
  if (values.amount.trim() === "" || Number.isNaN(amount) || amount < 0) {
    errors.amount = "Enter an amount of 0 or more.";
  }
  return errors;
}

export default function ExpenseForm({
  values,
  errors,
  onChange,
}: {
  values: ExpenseFormValues;
  errors: ExpenseFormErrors;
  onChange: <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => void;
}) {
  return (
    <div>
      <Segmented
        label="Category"
        value={values.category}
        onChange={(v) => onChange("category", v)}
        options={[
          { label: "Rent", value: "rent" },
          { label: "Cleaning", value: "cleaning" },
          { label: "Utilities", value: "utilities" },
          { label: "Supplies", value: "supplies" },
          { label: "Other", value: "other" },
        ]}
      />

      <Field label="Description (optional)">
        <Input
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="e.g. August rent"
        />
      </Field>

      <Field label="Amount" error={errors.amount}>
        <Input
          value={values.amount}
          onChange={(e) => onChange("amount", e.target.value)}
          placeholder="e.g. 20000"
          inputMode="decimal"
        />
      </Field>

      <Field label="Date" error={errors.expenseDate}>
        <Input
          value={values.expenseDate}
          onChange={(e) => onChange("expenseDate", e.target.value)}
          placeholder="YYYY-MM-DD"
        />
      </Field>
    </div>
  );
}
