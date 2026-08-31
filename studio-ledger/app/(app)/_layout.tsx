import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";
import { getBusinessTypeConfig } from "@/lib/businessTypes";

export default function AppLayout() {
  const { session, staffUser, studio, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (!staffUser) return <Redirect href="/create-studio" />;

  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: config.personLabelPlural }} />
      <Stack.Screen
        name="member/new"
        options={{ title: `Add ${config.personLabelSingular.toLowerCase()}`, presentation: "modal" }}
      />
      <Stack.Screen name="member/[id]" options={{ title: config.personLabelSingular }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
