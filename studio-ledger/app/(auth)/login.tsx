import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError);
    // On success, the (auth) layout's guard redirects away from here.
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Studio Ledger</Text>
        <Text style={styles.subtitle}>Sign in to your studio</Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          testID="login-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          testID="login-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Sign in" onPress={handleSubmit} loading={loading} disabled={!email || !password} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>New studio?</Text>
          <Link href="/signup" style={styles.link}>
            Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 28,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  footerText: {
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: "600",
  },
});
