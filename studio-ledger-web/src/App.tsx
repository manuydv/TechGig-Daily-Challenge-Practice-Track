import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { GuestOnly, RequireApp } from "@/components/guards";
import AppShell from "@/components/AppShell";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import CreateStudio from "@/pages/CreateStudio";
import Intake from "@/pages/Intake";
import Checkin from "@/pages/Checkin";
import ClientsList from "@/pages/clients/ClientsList";
import ClientNew from "@/pages/clients/ClientNew";
import ClientDetail from "@/pages/clients/ClientDetail";
import Financials from "@/pages/Financials";
import ExpensesList from "@/pages/expenses/ExpensesList";
import ExpenseNew from "@/pages/expenses/ExpenseNew";
import ExpenseDetail from "@/pages/expenses/ExpenseDetail";
import EmployeesList from "@/pages/employees/EmployeesList";
import EmployeeNew from "@/pages/employees/EmployeeNew";
import EmployeeDetail from "@/pages/employees/EmployeeDetail";
import More from "@/pages/More";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/intake/:slug" element={<Intake />} />
        <Route path="/checkin/:slug" element={<Checkin />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <Signup />
            </GuestOnly>
          }
        />
        <Route path="/create-studio" element={<CreateStudio />} />

        <Route element={<RequireApp />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/clients" replace />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/new" element={<ClientNew />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="/expenses" element={<ExpensesList />} />
            <Route path="/expenses/new" element={<ExpenseNew />} />
            <Route path="/expenses/:id" element={<ExpenseDetail />} />
            <Route path="/employees" element={<EmployeesList />} />
            <Route path="/employees/new" element={<EmployeeNew />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/more" element={<More />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
