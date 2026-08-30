import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import SegmentedControl from "@/components/SegmentedControl";
import { currentMonth } from "@/lib/dates";
import { colors } from "@/lib/theme";
import type { Member, MemberStatus, Gender } from "@/types/database";

type StatusFilter = MemberStatus | "all";
type GenderFilter = Gender | "all";

export default function MemberListScreen() {
  const { staffUser, signOut } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [paidMemberIds, setPaidMemberIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staffUser) return;
    setError(null);
    const [membersRes, paymentsRes] = await Promise.all([
      supabase.from("members").select("*").order("name", { ascending: true }),
      supabase
        .from("payments")
        .select("member_id")
        .eq("month", currentMonth())
        .eq("paid", true),
    ]);

    if (membersRes.error) {
      setError(membersRes.error.message);
    } else {
      setMembers(membersRes.data ?? []);
    }
    if (!paymentsRes.error) {
      setPaidMemberIds(new Set((paymentsRes.data ?? []).map((p) => p.member_id)));
    }
    setLoading(false);
  }, [staffUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (term && !m.name.toLowerCase().includes(term)) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (genderFilter !== "all" && m.gender !== genderFilter) return false;
      return true;
    });
  }, [members, search, statusFilter, genderFilter]);

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Search members"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <SegmentedControl
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: "All", value: "all" },
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Inactive", value: "inactive" },
          ]}
        />
        <SegmentedControl
          label="Gender"
          value={genderFilter}
          onChange={setGenderFilter}
          options={[
            { label: "All", value: "all" },
            { label: "Female", value: "female" },
            { label: "Male", value: "male" },
            { label: "Other", value: "other" },
          ]}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No members yet. Add your first one.</Text> : null
        }
        renderItem={({ item }) => {
          const paid = paidMemberIds.has(item.id);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/member/${item.id}`)}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.status} · fee {item.monthly_fee}
                </Text>
              </View>
              <View style={[styles.badge, paid ? styles.badgePaid : styles.badgeUnpaid]}>
                <Text style={[styles.badgeText, paid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                  {paid ? "Paid" : "Unpaid"}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/member/new")}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    padding: 16,
    paddingBottom: 0,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
    marginBottom: 12,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 40,
  },
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
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, textTransform: "capitalize" },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgePaid: { backgroundColor: "#E4F7EC" },
  badgeUnpaid: { backgroundColor: "#FBEAEA" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextPaid: { color: colors.success },
  badgeTextUnpaid: { color: colors.danger },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 76,
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
  signOut: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: "center",
  },
  signOutText: { color: colors.textMuted, fontSize: 13 },
});
