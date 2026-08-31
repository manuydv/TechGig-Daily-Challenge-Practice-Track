import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { DrawerProvider } from "@/lib/drawer-context";
import LoadingScreen from "@/components/LoadingScreen";
import Drawer from "@/components/Drawer";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import { colors } from "@/lib/theme";
import { getBusinessTypeConfig } from "@/lib/businessTypes";

export default function AppLayout() {
  const { session, staffUser, studio, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (!staffUser) return <Redirect href="/create-studio" />;

  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");

  return (
    <DrawerProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: config.personLabelPlural, headerLeft: () => <HeaderMenuButton /> }}
        />
        <Stack.Screen
          name="member/new"
          options={{ title: `Add ${config.personLabelSingular.toLowerCase()}`, presentation: "modal" }}
        />
        <Stack.Screen name="member/[id]" options={{ title: config.personLabelSingular }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen
          name="financials"
          options={{ title: "Financials", headerLeft: () => <HeaderMenuButton /> }}
        />
        <Stack.Screen
          name="employees/index"
          options={{ title: "Employees", headerLeft: () => <HeaderMenuButton /> }}
        />
        <Stack.Screen name="employees/new" options={{ title: "Add employee", presentation: "modal" }} />
        <Stack.Screen name="employees/[id]" options={{ title: "Employee" }} />
        <Stack.Screen
          name="expenses/index"
          options={{ title: "Expenses", headerLeft: () => <HeaderMenuButton /> }}
        />
        <Stack.Screen name="expenses/new" options={{ title: "Add expense", presentation: "modal" }} />
        <Stack.Screen name="expenses/[id]" options={{ title: "Expense" }} />
      </Stack>
      <Drawer />
    </DrawerProvider>
  );
}
