import { View } from "react-native";
import TextField from "@/components/TextField";
import SegmentedControl from "@/components/SegmentedControl";
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

interface Props {
  values: ExpenseFormValues;
  errors: ExpenseFormErrors;
  onChange: <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => void;
}

export default function ExpenseForm({ values, errors, onChange }: Props) {
  return (
    <View>
      <SegmentedControl
        label="Category"
        value={values.category}
        onChange={(value) => onChange("category", value)}
        options={[
          { label: "Rent", value: "rent" },
          { label: "Cleaning", value: "cleaning" },
          { label: "Utilities", value: "utilities" },
          { label: "Supplies", value: "supplies" },
          { label: "Other", value: "other" },
        ]}
      />

      <TextField
        label="Description (optional)"
        value={values.description}
        onChangeText={(text) => onChange("description", text)}
        placeholder="e.g. August rent"
      />

      <TextField
        label="Amount"
        value={values.amount}
        onChangeText={(text) => onChange("amount", text)}
        placeholder="e.g. 20000"
        keyboardType="decimal-pad"
        error={errors.amount}
      />

      <TextField
        label="Date"
        value={values.expenseDate}
        onChangeText={(text) => onChange("expenseDate", text)}
        placeholder="YYYY-MM-DD"
        error={errors.expenseDate}
      />
    </View>
  );
}
