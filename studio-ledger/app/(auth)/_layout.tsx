import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from "@/components/LoadingScreen";

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
