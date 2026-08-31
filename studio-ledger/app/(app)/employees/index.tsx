import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";
import { colors } from "@/lib/theme";
import type { Employee } from "@/types/database";

export default function EmployeesScreen() {
  const { staffUser, studio } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEmployees(data ?? []);
    }
    setLoading(false);
  }, [staffUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalMonthlyPay = employees
    .filter((e) => e.status === "active")
    .reduce((sum, e) => sum + e.monthly_pay, 0);

  return (
    <View style={styles.flex}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Active payroll / month</Text>
        <Text style={styles.summaryValue}>{formatMoney(totalMonthlyPay, studio?.currency)}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No employees yet. Add your first one.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/employees/${item.id}`)}>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>{item.role_title || "No title"}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowPay}>{formatMoney(item.monthly_pay, studio?.currency)}</Text>
              <Text style={[styles.rowStatus, item.status === "inactive" && styles.rowStatusInactive]}>
                {item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/employees/new")}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  summary: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  error: { color: colors.danger, textAlign: "center", marginTop: 8 },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 96 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowMain: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 16, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowPay: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowStatus: { fontSize: 12, color: colors.success, marginTop: 2, textTransform: "capitalize" },
  rowStatusInactive: { color: colors.textMuted },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: { color: colors.primaryText, fontSize: 28, lineHeight: 30 },
});
