import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import BusinessTypePicker from "@/components/BusinessTypePicker";
import { colors } from "@/lib/theme";
import type { BusinessType } from "@/types/database";

export default function CreateStudioScreen() {
  const { session, staffUser, loading, refreshStaffUser, signOut } = useAuth();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("yoga_studio");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (staffUser) return <Redirect href="/" />;

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give your shop a name.");
      return;
    }
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("create_studio", {
      studio_name: name.trim(),
      business_type: businessType,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }
    await refreshStaffUser();
    setSubmitting(false);
    router.replace("/");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>You can invite staff and customize settings later.</Text>

        <TextField
          label="Shop name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Tara Shakti Yoga Studio"
          autoCapitalize="words"
        />

        <BusinessTypePicker value={businessType} onChange={setBusinessType} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Create shop" onPress={handleCreate} loading={submitting} disabled={!name.trim()} />

        {signingOut ? (
          <ActivityIndicator style={styles.signOutSpinner} color={colors.textMuted} />
        ) : (
          <Text style={styles.signOut} onPress={handleSignOut}>
            Sign out
          </Text>
        )}
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
  signOut: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 20,
  },
  signOutSpinner: {
    marginTop: 20,
  },
});
