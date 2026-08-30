import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import MemberForm, { MemberFormValues, validateMemberForm } from "@/components/MemberForm";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import { currentMonth, dueDateForMonth, formatMonth, recentMonths } from "@/lib/dates";
import { colors } from "@/lib/theme";
import type { Member, Payment } from "@/types/database";

const HISTORY_MONTHS = 6;

function toFormValues(member: Member): MemberFormValues {
  return {
    name: member.name,
    gender: member.gender ?? "",
    phone: member.phone ?? "",
    email: member.email ?? "",
    joinedOn: member.joined_on,
    monthlyFee: String(member.monthly_fee),
    status: member.status,
  };
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [values, setValues] = useState<MemberFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateMemberForm>>({});
  const [paymentsByMonth, setPaymentsByMonth] = useState<Record<string, Payment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const months = recentMonths(HISTORY_MONTHS);
    const [memberRes, paymentsRes] = await Promise.all([
      supabase.from("members").select("*").eq("id", id).single(),
      supabase.from("payments").select("*").eq("member_id", id).in("month", months),
    ]);

    if (memberRes.error) {
      setError(memberRes.error.message);
      setLoading(false);
      return;
    }

    setMember(memberRes.data);
    setValues(toFormValues(memberRes.data));

    const map: Record<string, Payment> = {};
    for (const payment of paymentsRes.data ?? []) {
      map[payment.month] = payment;
    }
    setPaymentsByMonth(map);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !values) return <LoadingScreen />;
  if (error || !member) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Member not found."}</Text>
      </View>
    );
  }

  const handleChange = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    const validationErrors = validateMemberForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from("members")
      .update({
        name: values.name.trim(),
        gender: values.gender || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        joined_on: values.joinedOn,
        monthly_fee: Number(values.monthlyFee),
        status: values.status,
      })
      .eq("id", member.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    Alert.alert("Saved", "Member details updated.");
  };

  const handleDelete = () => {
    Alert.alert("Delete member", `Remove ${member.name} and their payment history? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase.from("members").delete().eq("id", member.id);
          if (deleteError) {
            Alert.alert("Couldn't delete", deleteError.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const togglePaid = async (month: string, nextPaid: boolean) => {
    setMarkingPaid(true);
    const { error: upsertError } = await supabase
      .from("payments")
      .upsert({ member_id: member.id, month, paid: nextPaid }, { onConflict: "member_id,month" });
    setMarkingPaid(false);
    if (upsertError) {
      Alert.alert("Couldn't update payment", upsertError.message);
      return;
    }
    await load();
  };

  const thisMonth = currentMonth();
  const thisMonthPaid = paymentsByMonth[thisMonth]?.paid ?? false;
  const dueDate = dueDateForMonth(member.joined_on, thisMonth);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{formatMonth(thisMonth)}</Text>
          <Text style={styles.cardMeta}>Due {dueDate}</Text>
          <View style={styles.cardRow}>
            <View style={[styles.badge, thisMonthPaid ? styles.badgePaid : styles.badgeUnpaid]}>
              <Text style={[styles.badgeText, thisMonthPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                {thisMonthPaid ? "Paid" : "Unpaid"}
              </Text>
            </View>
            <Button
              title={thisMonthPaid ? "Mark unpaid" : "Mark paid"}
              variant={thisMonthPaid ? "secondary" : "primary"}
              loading={markingPaid}
              onPress={() => togglePaid(thisMonth, !thisMonthPaid)}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment history</Text>
        <View style={styles.historyCard}>
          {recentMonths(HISTORY_MONTHS).map((month) => {
            const paid = paymentsByMonth[month]?.paid ?? false;
            return (
              <View key={month} style={styles.historyRow}>
                <Text style={styles.historyMonth}>{formatMonth(month)}</Text>
                <Text style={paid ? styles.historyPaid : styles.historyUnpaid}>{paid ? "Paid" : "Unpaid"}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Member details</Text>
        <MemberForm values={values} errors={errors} onChange={handleChange} />

        <Button title="Save changes" onPress={handleSave} loading={saving} />
        <View style={styles.deleteSpacer} />
        <Button title="Delete member" variant="danger" onPress={handleDelete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 20, paddingBottom: 48 },
  error: { color: colors.danger, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgePaid: { backgroundColor: "#E4F7EC" },
  badgeUnpaid: { backgroundColor: "#FBEAEA" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextPaid: { color: colors.success },
  badgeTextUnpaid: { color: colors.danger },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyMonth: { color: colors.text, fontSize: 14 },
  historyPaid: { color: colors.success, fontWeight: "600" },
  historyUnpaid: { color: colors.textMuted, fontWeight: "600" },
  deleteSpacer: { height: 12 },
});
