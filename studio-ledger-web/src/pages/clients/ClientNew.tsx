import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import MemberForm, { validateMemberForm } from "@/components/forms/MemberForm";
import type { MemberFormValues } from "@/components/forms/MemberForm";
import { Button } from "@/components/ui";
import TopBar from "@/components/TopBar";
import { today } from "@/lib/dates";
import { getBusinessTypeConfig } from "@/lib/businessTypes";

const initialValues: MemberFormValues = {
  name: "",
  gender: "",
  phone: "",
  email: "",
  joinedOn: today(),
  monthlyFee: "",
  status: "active",
};

export default function ClientNew() {
  const navigate = useNavigate();
  const { staffUser, studio } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ReturnType<typeof validateMemberForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateMemberForm(values, config.mode);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!staffUser) return;

    setSubmitError(null);
    setSaving(true);
    const { error } = await supabase.from("members").insert({
      studio_id: staffUser.studio_id,
      name: values.name.trim(),
      gender: values.gender || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      joined_on: values.joinedOn,
      monthly_fee: config.mode === "membership" ? Number(values.monthlyFee) : 0,
      status: config.mode === "membership" ? values.status : "active",
    });
    setSaving(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }
    navigate("/clients");
  };

  return (
    <div>
      <TopBar title={`Add ${config.personLabelSingular.toLowerCase()}`} back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <MemberForm values={values} errors={errors} mode={config.mode} onChange={handleChange} />
        {submitError ? <p className="mb-3 text-center text-sm text-danger">{submitError}</p> : null}
        <Button type="submit" loading={saving} className="w-full">
          Add {config.personLabelSingular.toLowerCase()}
        </Button>
      </form>
    </div>
  );
}
