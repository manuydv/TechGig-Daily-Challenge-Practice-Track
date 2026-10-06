import { Field, Segmented } from "@/components/Field";
import { Input } from "@/components/ui";
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

export default function EmployeeForm({
  values,
  errors,
  onChange,
}: {
  values: EmployeeFormValues;
  errors: EmployeeFormErrors;
  onChange: <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => void;
}) {
  return (
    <div>
      <Field label="Name" error={errors.name}>
        <Input value={values.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Full name" />
      </Field>

      <Field label="Role / title">
        <Input
          value={values.roleTitle}
          onChange={(e) => onChange("roleTitle", e.target.value)}
          placeholder="e.g. Barber, Instructor, Cleaner"
        />
      </Field>

      <Field label="Phone">
        <Input
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="+91 98765 43210"
          type="tel"
        />
      </Field>

      <Field label="Email">
        <Input
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="employee@example.com"
          type="email"
        />
      </Field>

      <Field label="Joined on" error={errors.joinedOn}>
        <Input value={values.joinedOn} onChange={(e) => onChange("joinedOn", e.target.value)} placeholder="YYYY-MM-DD" />
      </Field>

      <Field label="Monthly pay" error={errors.monthlyPay}>
        <Input
          value={values.monthlyPay}
          onChange={(e) => onChange("monthlyPay", e.target.value)}
          placeholder="e.g. 15000"
          inputMode="decimal"
        />
      </Field>

      <Segmented
        label="Status"
        value={values.status}
        onChange={(v) => onChange("status", v)}
        options={[
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ]}
      />
    </div>
  );
}
