import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useDrawer } from "@/lib/drawer-context";
import { colors } from "@/lib/theme";

export default function HeaderMenuButton() {
  const { openDrawer } = useDrawer();
  return (
    <TouchableOpacity onPress={openDrawer} style={styles.button} hitSlop={12}>
      <Text style={styles.icon}>☰</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 4, paddingVertical: 4 },
  icon: { fontSize: 20, color: colors.text },
});
