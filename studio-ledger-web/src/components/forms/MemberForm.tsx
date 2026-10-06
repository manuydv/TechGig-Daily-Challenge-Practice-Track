import { Field, Segmented } from "@/components/Field";
import { Input } from "@/components/ui";
import { isValidDate } from "@/lib/dates";
import type { TrackingMode } from "@/lib/businessTypes";
import type { Gender, MemberStatus } from "@/types/database";

export interface MemberFormValues {
  name: string;
  gender: Gender | "";
  phone: string;
  email: string;
  joinedOn: string;
  monthlyFee: string;
  status: MemberStatus;
}

export interface MemberFormErrors {
  name?: string;
  joinedOn?: string;
  monthlyFee?: string;
}

export function validateMemberForm(values: MemberFormValues, mode: TrackingMode): MemberFormErrors {
  const errors: MemberFormErrors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (!isValidDate(values.joinedOn)) errors.joinedOn = "Use the format YYYY-MM-DD.";
  if (mode === "membership") {
    const fee = Number(values.monthlyFee);
    if (values.monthlyFee.trim() === "" || Number.isNaN(fee) || fee < 0) {
      errors.monthlyFee = "Enter a monthly fee of 0 or more.";
    }
  }
  return errors;
}

export default function MemberForm({
  values,
  errors,
  mode,
  onChange,
}: {
  values: MemberFormValues;
  errors: MemberFormErrors;
  mode: TrackingMode;
  onChange: <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => void;
}) {
  return (
    <div>
      <Field label="Name" error={errors.name}>
        <Input value={values.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Full name" />
      </Field>

      <Segmented
        label="Gender"
        value={values.gender}
        onChange={(v) => onChange("gender", v)}
        options={[
          { label: "Female", value: "female" },
          { label: "Male", value: "male" },
          { label: "Other", value: "other" },
        ]}
      />

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
          placeholder="member@example.com"
          type="email"
        />
      </Field>

      <Field label="Joined on" error={errors.joinedOn}>
        <Input value={values.joinedOn} onChange={(e) => onChange("joinedOn", e.target.value)} placeholder="YYYY-MM-DD" />
      </Field>

      {mode === "membership" ? (
        <>
          <Field label="Monthly fee" error={errors.monthlyFee}>
            <Input
              value={values.monthlyFee}
              onChange={(e) => onChange("monthlyFee", e.target.value)}
              placeholder="e.g. 2000"
              inputMode="decimal"
            />
          </Field>

          <Segmented
            label="Status"
            value={values.status}
            onChange={(v) => onChange("status", v)}
            options={[
              { label: "Active", value: "active" },
              { label: "Paused", value: "paused" },
              { label: "Inactive", value: "inactive" },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}
