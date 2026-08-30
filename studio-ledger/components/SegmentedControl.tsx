import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@/lib/theme";

interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
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
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
  },
  segmentTextSelected: {
    color: colors.primaryText,
  },
});
