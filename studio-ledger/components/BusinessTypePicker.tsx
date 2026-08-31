import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@/lib/theme";
import { BUSINESS_TYPES } from "@/lib/businessTypes";
import type { BusinessType } from "@/types/database";

interface Props {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
  label?: string;
}

export default function BusinessTypePicker({ value, onChange, label = "What kind of shop is this?" }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionList}>
        {BUSINESS_TYPES.map((type) => {
          const selected = type.value === value;
          return (
            <TouchableOpacity
              key={type.value}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(type.value)}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{type.label}</Text>
              <Text style={[styles.optionHint, selected && styles.optionHintSelected]}>
                {type.mode === "membership"
                  ? "Tracks monthly membership fees"
                  : "Tracks visits, reminds clients to come back"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 8,
  },
  optionList: {
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.card,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EFECFD",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  optionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  optionHintSelected: {
    color: colors.primary,
  },
});
