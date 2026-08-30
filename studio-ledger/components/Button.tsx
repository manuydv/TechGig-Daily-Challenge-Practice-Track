import { ActivityIndicator, GestureResponderEvent, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "@/lib/theme";

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}

export default function Button({ title, onPress, variant = "primary", loading, disabled }: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.primary : colors.primaryText} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "secondary" && styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryText: {
    color: colors.text,
  },
});
