import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import MemberForm, { MemberFormValues, validateMemberForm } from "@/components/MemberForm";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import { currentMonth, dueDateForMonth, daysSince, formatDate, formatMonth, recentMonths, today } from "@/lib/dates";
import { colors } from "@/lib/theme";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import type { Member, Payment, Visit } from "@/types/database";

const HISTORY_MONTHS = 6;
const VISIT_HISTORY_LIMIT = 10;

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
  const { studio } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");
  const reminderDays = studio?.reminder_days ?? 30;

  const [member, setMember] = useState<Member | null>(null);
  const [values, setValues] = useState<MemberFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateMemberForm>>({});
  const [paymentsByMonth, setPaymentsByMonth] = useState<Record<string, Payment>>({});
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitService, setVisitService] = useState("");
  const [visitAmount, setVisitAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [loggingVisit, setLoggingVisit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);

    const memberRes = await supabase.from("members").select("*").eq("id", id).single();
    if (memberRes.error) {
      setError(memberRes.error.message);
      setLoading(false);
      return;
    }
    setMember(memberRes.data);
    setValues(toFormValues(memberRes.data));

    if (config.mode === "membership") {
      const months = recentMonths(HISTORY_MONTHS);
      const paymentsRes = await supabase.from("payments").select("*").eq("member_id", id).in("month", months);
      const map: Record<string, Payment> = {};
      for (const payment of paymentsRes.data ?? []) {
        map[payment.month] = payment;
      }
      setPaymentsByMonth(map);
    } else {
      const visitsRes = await supabase
        .from("visits")
        .select("*")
        .eq("member_id", id)
        .order("visited_on", { ascending: false })
        .limit(VISIT_HISTORY_LIMIT);
      setVisits(visitsRes.data ?? []);
    }

    setLoading(false);
  }, [id, config.mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !values) return <LoadingScreen />;
  if (error || !member) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? `${config.personLabelSingular} not found.`}</Text>
      </View>
    );
  }

  const handleChange = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    const validationErrors = validateMemberForm(values, config.mode);
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
        monthly_fee: config.mode === "membership" ? Number(values.monthlyFee) : 0,
        status: config.mode === "membership" ? values.status : "active",
      })
      .eq("id", member.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    Alert.alert("Saved", `${config.personLabelSingular} details updated.`);
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${config.personLabelSingular.toLowerCase()}`,
      `Remove ${member.name} and their history? This can't be undone.`,
      [
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
      ]
    );
  };

  const togglePaid = async (month: string, nextPaid: boolean) => {
    setMarkingPaid(true);
    const { error: upsertError } = await supabase.from("payments").upsert(
      {
        member_id: member.id,
        month,
        paid: nextPaid,
        amount: nextPaid ? member.monthly_fee : null,
      },
      { onConflict: "member_id,month" }
    );
    setMarkingPaid(false);
    if (upsertError) {
      Alert.alert("Couldn't update payment", upsertError.message);
      return;
    }
    await load();
  };

  const handleLogVisit = async () => {
    setLoggingVisit(true);
    const { error: insertError } = await supabase.from("visits").insert({
      member_id: member.id,
      visited_on: today(),
      service: visitService.trim() || null,
      amount: visitAmount.trim() ? Number(visitAmount) : null,
    });
    setLoggingVisit(false);
    if (insertError) {
      Alert.alert("Couldn't log visit", insertError.message);
      return;
    }
    setVisitService("");
    setVisitAmount("");
    await load();
  };

  if (config.mode === "visit") {
    const lastVisit = visits[0];
    const sinceLast = lastVisit ? daysSince(lastVisit.visited_on) : null;
    const isDue = sinceLast !== null && sinceLast >= reminderDays;

    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last visit</Text>
            <Text style={styles.cardMeta}>
              {lastVisit ? `${formatDate(lastVisit.visited_on)} (${sinceLast} days ago)` : "No visits yet"}
            </Text>
            <View style={[styles.badge, isDue ? styles.badgeUnpaid : styles.badgePaid]}>
              <Text style={[styles.badgeText, isDue ? styles.badgeTextUnpaid : styles.badgeTextPaid]}>
                {lastVisit ? (isDue ? "Due for a reminder" : "Recently visited") : "New client"}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Log a visit</Text>
          <View style={styles.card}>
            <TextField
              label="Service (optional)"
              value={visitService}
              onChangeText={setVisitService}
              placeholder="e.g. Haircut + beard trim"
            />
            <TextField
              label="Amount charged (optional)"
              value={visitAmount}
              onChangeText={setVisitAmount}
              placeholder="e.g. 300"
              keyboardType="decimal-pad"
            />
            <Button title="Log visit today" onPress={handleLogVisit} loading={loggingVisit} />
          </View>

          <Text style={styles.sectionTitle}>Visit history</Text>
          <View style={styles.historyCard}>
            {visits.length === 0 ? (
              <Text style={styles.emptyHistory}>No visits logged yet.</Text>
            ) : (
              visits.map((visit) => (
                <View key={visit.id} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyMonth}>{formatDate(visit.visited_on)}</Text>
                    {visit.service ? <Text style={styles.historyService}>{visit.service}</Text> : null}
                  </View>
                  {visit.amount != null ? <Text style={styles.historyAmount}>{visit.amount}</Text> : null}
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>{config.personLabelSingular} details</Text>
          <MemberForm values={values} errors={errors} mode={config.mode} onChange={handleChange} />

          <Button title="Save changes" onPress={handleSave} loading={saving} />
          <View style={styles.deleteSpacer} />
          <Button
            title={`Delete ${config.personLabelSingular.toLowerCase()}`}
            variant="danger"
            onPress={handleDelete}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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

        <Text style={styles.sectionTitle}>{config.personLabelSingular} details</Text>
        <MemberForm values={values} errors={errors} mode={config.mode} onChange={handleChange} />

        <Button title="Save changes" onPress={handleSave} loading={saving} />
        <View style={styles.deleteSpacer} />
        <Button
          title={`Delete ${config.personLabelSingular.toLowerCase()}`}
          variant="danger"
          onPress={handleDelete}
        />
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
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
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
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyMonth: { color: colors.text, fontSize: 14, fontWeight: "600" },
  historyService: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  historyAmount: { color: colors.text, fontSize: 14, fontWeight: "600" },
  historyPaid: { color: colors.success, fontWeight: "600" },
  historyUnpaid: { color: colors.textMuted, fontWeight: "600" },
  emptyHistory: { color: colors.textMuted, padding: 16, textAlign: "center" },
  deleteSpacer: { height: 12 },
});
