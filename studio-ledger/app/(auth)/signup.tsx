import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import { colors } from "@/lib/theme";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp(email.trim(), password);
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setInfo("Account created. Check your email to confirm it, then sign in.");
      return;
    }
    // On success with an immediate session, the (app) layout's guard sends
    // the user to /create-studio automatically.
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>You'll set up your studio next</Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          testID="signup-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
          testID="signup-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button title="Sign up" onPress={handleSubmit} loading={loading} disabled={!email || !password} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/login" style={styles.link}>
            Sign in
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
    fontSize: 26,
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
  info: {
    color: colors.success,
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
