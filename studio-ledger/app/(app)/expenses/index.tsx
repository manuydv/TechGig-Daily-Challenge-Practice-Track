import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { colors } from "@/lib/theme";
import type { Expense } from "@/types/database";

export default function ExpensesScreen() {
  const { staffUser, studio } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(100);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }, [staffUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const thisMonthTotal = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return expenses.filter((e) => e.expense_date.startsWith(prefix)).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <View style={styles.flex}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>This month's expenses</Text>
        <Text style={styles.summaryValue}>{formatMoney(thisMonthTotal, studio?.currency)}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No expenses logged yet.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/expenses/${item.id}`)}>
            <View style={styles.rowMain}>
              <Text style={styles.rowCategory}>{item.category}</Text>
              {item.description ? <Text style={styles.rowDescription}>{item.description}</Text> : null}
              <Text style={styles.rowDate}>{formatDate(item.expense_date)}</Text>
            </View>
            <Text style={styles.rowAmount}>{formatMoney(item.amount, studio?.currency)}</Text>
          </Pressable>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/expenses/new")}>
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
  rowCategory: { fontSize: 15, fontWeight: "600", color: colors.text, textTransform: "capitalize" },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: "600", color: colors.danger },
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
