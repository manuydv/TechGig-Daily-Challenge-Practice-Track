import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import EmployeeForm, { EmployeeFormValues, validateEmployeeForm } from "@/components/EmployeeForm";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";
import type { Employee } from "@/types/database";

function toFormValues(employee: Employee): EmployeeFormValues {
  return {
    name: employee.name,
    roleTitle: employee.role_title ?? "",
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    monthlyPay: String(employee.monthly_pay),
    status: employee.status,
    joinedOn: employee.joined_on,
  };
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [values, setValues] = useState<EmployeeFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateEmployeeForm>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const { data, error: fetchError } = await supabase.from("employees").select("*").eq("id", id).single();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setEmployee(data);
    setValues(toFormValues(data));
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !values) return <LoadingScreen />;
  if (error || !employee) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Employee not found."}</Text>
      </View>
    );
  }

  const handleChange = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    const validationErrors = validateEmployeeForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        name: values.name.trim(),
        role_title: values.roleTitle.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        monthly_pay: Number(values.monthlyPay),
        status: values.status,
        joined_on: values.joinedOn,
      })
      .eq("id", employee.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    Alert.alert("Saved", "Employee details updated.");
  };

  const handleDelete = () => {
    Alert.alert("Delete employee", `Remove ${employee.name}? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase.from("employees").delete().eq("id", employee.id);
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
        <EmployeeForm values={values} errors={errors} onChange={handleChange} />
        <Button title="Save changes" onPress={handleSave} loading={saving} />
        <View style={styles.deleteSpacer} />
        <Button title="Delete employee" variant="danger" onPress={handleDelete} />
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
