import { View } from "react-native";
import TextField from "@/components/TextField";
import SegmentedControl from "@/components/SegmentedControl";
import { isValidDate } from "@/lib/dates";
import type { EmployeeStatus } from "@/types/database";

export interface EmployeeFormValues {
  name: string;
  roleTitle: string;
  phone: string;
  email: string;
  monthlyPay: string;
  status: EmployeeStatus;
  joinedOn: string;
}

export interface EmployeeFormErrors {
  name?: string;
  monthlyPay?: string;
  joinedOn?: string;
}

export function validateEmployeeForm(values: EmployeeFormValues): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (!isValidDate(values.joinedOn)) errors.joinedOn = "Use the format YYYY-MM-DD.";
  const pay = Number(values.monthlyPay);
  if (values.monthlyPay.trim() === "" || Number.isNaN(pay) || pay < 0) {
    errors.monthlyPay = "Enter a monthly pay of 0 or more.";
  }
  return errors;
}

interface Props {
  values: EmployeeFormValues;
  errors: EmployeeFormErrors;
  onChange: <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => void;
}

export default function EmployeeForm({ values, errors, onChange }: Props) {
  return (
    <View>
      <TextField
        label="Name"
        value={values.name}
        onChangeText={(text) => onChange("name", text)}
        placeholder="Full name"
        autoCapitalize="words"
        error={errors.name}
      />

      <TextField
        label="Role / title"
        value={values.roleTitle}
        onChangeText={(text) => onChange("roleTitle", text)}
        placeholder="e.g. Barber, Instructor, Cleaner"
      />

      <TextField
        label="Phone"
        value={values.phone}
        onChangeText={(text) => onChange("phone", text)}
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
      />

      <TextField
        label="Email"
        value={values.email}
        onChangeText={(text) => onChange("email", text)}
        placeholder="employee@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextField
        label="Joined on"
        value={values.joinedOn}
        onChangeText={(text) => onChange("joinedOn", text)}
        placeholder="YYYY-MM-DD"
        error={errors.joinedOn}
      />

      <TextField
        label="Monthly pay"
        value={values.monthlyPay}
        onChangeText={(text) => onChange("monthlyPay", text)}
        placeholder="e.g. 15000"
        keyboardType="decimal-pad"
        error={errors.monthlyPay}
      />

      <SegmentedControl
        label="Status"
        value={values.status}
        onChange={(value) => onChange("status", value)}
        options={[
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ]}
      />
    </View>
  );
}
