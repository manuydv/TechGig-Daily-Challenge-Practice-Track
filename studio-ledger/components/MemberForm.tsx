import { View } from "react-native";
import TextField from "@/components/TextField";
import SegmentedControl from "@/components/SegmentedControl";
import { isValidDate } from "@/lib/dates";
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

export function validateMemberForm(values: MemberFormValues): MemberFormErrors {
  const errors: MemberFormErrors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (!isValidDate(values.joinedOn)) errors.joinedOn = "Use the format YYYY-MM-DD.";
  const fee = Number(values.monthlyFee);
  if (values.monthlyFee.trim() === "" || Number.isNaN(fee) || fee < 0) {
    errors.monthlyFee = "Enter a monthly fee of 0 or more.";
  }
  return errors;
}

interface Props {
  values: MemberFormValues;
  errors: MemberFormErrors;
  onChange: <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => void;
}

export default function MemberForm({ values, errors, onChange }: Props) {
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

      <SegmentedControl
        label="Gender"
        value={values.gender}
        onChange={(value) => onChange("gender", value)}
        options={[
          { label: "Female", value: "female" },
          { label: "Male", value: "male" },
          { label: "Other", value: "other" },
        ]}
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
        placeholder="member@example.com"
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
        label="Monthly fee"
        value={values.monthlyFee}
        onChangeText={(text) => onChange("monthlyFee", text)}
        placeholder="e.g. 2000"
        keyboardType="decimal-pad"
        error={errors.monthlyFee}
      />

      <SegmentedControl
        label="Status"
        value={values.status}
        onChange={(value) => onChange("status", value)}
        options={[
          { label: "Active", value: "active" },
          { label: "Paused", value: "paused" },
          { label: "Inactive", value: "inactive" },
        ]}
      />
    </View>
  );
}
