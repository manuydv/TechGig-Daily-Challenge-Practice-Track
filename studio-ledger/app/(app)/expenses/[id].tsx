import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import ExpenseForm, { ExpenseFormValues, validateExpenseForm } from "@/components/ExpenseForm";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";
import type { Expense } from "@/types/database";

function toFormValues(expense: Expense): ExpenseFormValues {
  return {
    category: expense.category,
    description: expense.description ?? "",
    amount: String(expense.amount),
    expenseDate: expense.expense_date,
  };
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [values, setValues] = useState<ExpenseFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !values) return <LoadingScreen />;
  if (error || !expense) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Expense not found."}</Text>
      </View>
    );
  }

  const handleChange = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    const validationErrors = validateExpenseForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
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
    Alert.alert("Saved", "Expense updated.");
  };

  const handleDelete = () => {
    Alert.alert("Delete expense", "Remove this expense entry? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expense.id);
          if (deleteError) {
            Alert.alert("Couldn't delete", deleteError.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ExpenseForm values={values} errors={errors} onChange={handleChange} />
        <Button title="Save changes" onPress={handleSave} loading={saving} />
        <View style={styles.deleteSpacer} />
        <Button title="Delete expense" variant="danger" onPress={handleDelete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 20, paddingBottom: 48 },
  error: { color: colors.danger, textAlign: "center" },
  deleteSpacer: { height: 12 },
});
