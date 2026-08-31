import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/lib/drawer-context";
import { useAuth } from "@/lib/auth-context";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import { colors } from "@/lib/theme";

const DRAWER_WIDTH = Math.min(300, Dimensions.get("window").width * 0.8);

interface NavItem {
  label: string;
  href: string;
}

export default function Drawer() {
  const { open, closeDrawer } = useDrawer();
  const { studio, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (!studio) return null;
  const config = getBusinessTypeConfig(studio.business_type);

  const navItems: NavItem[] = [
    { label: config.personLabelPlural, href: "/" },
    { label: "Financials", href: "/financials" },
    { label: "Employees", href: "/employees" },
    { label: "Expenses", href: "/expenses" },
    { label: "Settings", href: "/settings" },
  ];

  // These are the app's top-level sections, switched between via this
  // drawer rather than drilled into — so navigating between them replaces
  // the current screen instead of stacking on top of it. Pushing here (the
  // original bug) left every section's screen with no way back: each one's
  // header shows the menu button in place of a back arrow (intentional, so
  // the drawer stays reachable from anywhere), so a push-only stack of them
  // had no way to return to a previous one short of reopening the drawer
  // and picking it again — and doing that repeatedly just kept pushing
  // further, never going back. replace keeps exactly one of these on the
  // stack at a time.
  const go = (href: string) => {
    closeDrawer();
    if (pathname !== href) {
      router.replace(href as never);
    }
  };

  // Rebuilt on React Native's own Modal instead of a hand-rolled
  // Animated.Value slide animation. The previous version tracked `open`
  // through Animated.timing and left the panel positioned via a transform
  // that had to finish animating back off-screen before it stopped
  // intercepting touches. On-device that animation didn't reliably
  // complete — confirmed via a screenshot showing the panel still fully
  // visible, with the underlying screen already switched and its data
  // already loaded, well after closeDrawer had fired. That's a stuck
  // half-open drawer sitting on top of the app, indistinguishable from a
  // freeze. Modal's visible prop shows/hides natively (no in-between
  // animated state to get stuck in) — trading the slide-in flourish for
  // something that structurally can't have this class of bug.
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />

        <View style={[styles.panel, { width: DRAWER_WIDTH, paddingTop: insets.top + 16 }]}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.shopName} numberOfLines={2}>
                {studio.name}
              </Text>
              <Pressable onPress={closeDrawer} hitSlop={12} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.shopType}>{config.label}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.navList}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Pressable
                  key={item.href}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => go(item.href)}
                >
                  <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={[styles.navItem, styles.signOut]}
            onPress={() => {
              closeDrawer();
              signOut();
            }}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    height: "100%",
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 2, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  shopName: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text, marginRight: 12 },
  shopType: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  closeButtonText: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  navList: { paddingVertical: 8 },
  navItem: { paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 8, borderRadius: 10 },
  navItemActive: { backgroundColor: "#EFECFD" },
  navItemText: { fontSize: 16, fontWeight: "600", color: colors.text },
  navItemTextActive: { color: colors.primary },
  signOut: { borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 12, marginHorizontal: 0 },
  signOutText: { fontSize: 15, color: colors.danger, fontWeight: "600" },
});
