import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";
import { colors } from "@/lib/theme";

export default function AppLayout() {
  const { session, staffUser, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (!staffUser) return <Redirect href="/create-studio" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Members" }} />
      <Stack.Screen name="member/new" options={{ title: "Add member", presentation: "modal" }} />
      <Stack.Screen name="member/[id]" options={{ title: "Member" }} />
    </Stack>
  );
}
