import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import BusinessTypePicker from "@/components/BusinessTypePicker";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import type { BusinessType } from "@/types/database";

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function SettingsScreen() {
  const { studio } = useAuth();

  if (!studio) return <LoadingScreen />;

  return <SettingsForm key={studio.id} />;
}

function SettingsForm() {
  const { studio, refreshStudio } = useAuth();

  const [businessType, setBusinessType] = useState<BusinessType>(studio!.business_type);
  const [reminderDays, setReminderDays] = useState(String(studio!.reminder_days));
  const [reminderMessage, setReminderMessage] = useState(studio!.reminder_message ?? "");
  const [intakeEnabled, setIntakeEnabled] = useState(studio!.public_intake_enabled);
  const [intakeSlug, setIntakeSlug] = useState(studio!.public_intake_slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleIntake = (next: boolean) => {
    setIntakeEnabled(next);
    if (next && !intakeSlug) setIntakeSlug(randomSlug());
  };

  const handleSave = async () => {
    const days = Number(reminderDays);
    if (!Number.isFinite(days) || days <= 0) {
      setError("Reminder days must be a positive number.");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from("studios")
      .update({
        business_type: businessType,
        reminder_days: days,
        reminder_message: reminderMessage.trim() || null,
        public_intake_enabled: intakeEnabled,
        public_intake_slug: intakeEnabled ? intakeSlug : studio!.public_intake_slug,
      })
      .eq("id", studio!.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshStudio();
    Alert.alert("Saved", "Shop settings updated.");
  };

  const intakeConfig = getBusinessTypeConfig(businessType);
  const intakeLink = intakeSlug ? Linking.createURL(`intake/${intakeSlug}`) : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Shop settings</Text>

        <BusinessTypePicker value={businessType} onChange={setBusinessType} />

        {intakeConfig.mode === "visit" ? (
          <>
            <TextField
              label="Remind after (days since last visit)"
              value={reminderDays}
              onChangeText={setReminderDays}
              keyboardType="number-pad"
              placeholder="30"
            />
            <TextField
              label="Reminder message (optional)"
              value={reminderMessage}
              onChangeText={setReminderMessage}
              placeholder="e.g. Time for a fresh cut! Show this text for 10% off."
              multiline
            />

            <View style={styles.card}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Self-serve sign-up form</Text>
                <Switch value={intakeEnabled} onValueChange={handleToggleIntake} />
              </View>
              <Text style={styles.hint}>
                Let a walk-in {intakeConfig.personLabelSingular.toLowerCase()} fill in their own name and
                phone number, without a staff member typing it in.
              </Text>
              {intakeEnabled && intakeLink ? (
                <>
                  <Text style={styles.linkLabel}>Share this link:</Text>
                  <Text selectable style={styles.link}>
                    {intakeLink}
                  </Text>
                  <Text style={styles.hint}>
                    Opens the sign-up form for whoever taps it on a phone with Studio Ledger installed. A
                    scannable QR code for walk-ins who don't have the app needs a hosted web version — not
                    built yet, see the roadmap.
                  </Text>
                </>
              ) : null}
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Save settings" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8, lineHeight: 17 },
  linkLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 12 },
  link: { fontSize: 13, color: colors.primary, marginTop: 4 },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
});
