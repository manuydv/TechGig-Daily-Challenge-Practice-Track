import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import ExpenseForm, { ExpenseFormValues, validateExpenseForm } from "@/components/ExpenseForm";
import Button from "@/components/Button";
import { today } from "@/lib/dates";
import { colors } from "@/lib/theme";

const initialValues: ExpenseFormValues = {
  category: "rent",
  description: "",
  amount: "",
  expenseDate: today(),
};

export default function NewExpenseScreen() {
  const { staffUser } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
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
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ExpenseForm values={values} errors={errors} onChange={handleChange} />
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button title="Add expense" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
});
