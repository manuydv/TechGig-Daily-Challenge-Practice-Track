import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import EmployeeForm, { EmployeeFormValues, validateEmployeeForm } from "@/components/EmployeeForm";
import Button from "@/components/Button";
import { today } from "@/lib/dates";
import { colors } from "@/lib/theme";

const initialValues: EmployeeFormValues = {
  name: "",
  roleTitle: "",
  phone: "",
  email: "",
  monthlyPay: "",
  status: "active",
  joinedOn: today(),
};

export default function NewEmployeeScreen() {
  const { staffUser } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ReturnType<typeof validateEmployeeForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const validationErrors = validateEmployeeForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!staffUser) return;

    setSubmitError(null);
    setSaving(true);
    const { error } = await supabase.from("employees").insert({
      studio_id: staffUser.studio_id,
      name: values.name.trim(),
      role_title: values.roleTitle.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      monthly_pay: Number(values.monthlyPay),
      status: values.status,
      joined_on: values.joinedOn,
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
        <EmployeeForm values={values} errors={errors} onChange={handleChange} />
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button title="Add employee" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
});
