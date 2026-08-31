import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import type { BusinessType } from "@/types/database";

export default function PublicIntakeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [studioInfo, setStudioInfo] = useState<{ name: string; business_type: BusinessType } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      supabase
        .rpc("get_intake_studio", { intake_slug: slug })
        .then(({ data, error: rpcError }) => {
          if (!mounted) return;
          if (rpcError || !data || data.length === 0) {
            setNotFound(true);
          } else {
            setStudioInfo(data[0]);
          }
          setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, [slug])
  );

  if (loading) return <LoadingScreen />;

  if (notFound || !studioInfo) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Link not active</Text>
        <Text style={styles.subtitle}>This sign-up link isn't available anymore. Ask the front desk.</Text>
      </ScrollView>
    );
  }

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>Thanks, {name.trim()}. {studioInfo.name} has your details.</Text>
      </ScrollView>
    );
  }

  const config = getBusinessTypeConfig(studioInfo.business_type);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("public_intake_add_client", {
      intake_slug: slug,
      client_name: name.trim(),
      client_phone: phone.trim() || null,
      client_email: email.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setDone(true);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome to {studioInfo.name}</Text>
        <Text style={styles.subtitle}>
          Leave your details so we can remind you when it's time to come back.
        </Text>

        <TextField label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Submit" onPress={handleSubmit} loading={submitting} disabled={!name.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: "center", marginTop: 8, marginBottom: 24 },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
});
