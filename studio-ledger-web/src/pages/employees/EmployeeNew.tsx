import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import EmployeeForm, { validateEmployeeForm } from "@/components/forms/EmployeeForm";
import type { EmployeeFormValues } from "@/components/forms/EmployeeForm";
import { Button } from "@/components/ui";
import TopBar from "@/components/TopBar";
import { today } from "@/lib/dates";

const initialValues: EmployeeFormValues = {
  name: "",
  roleTitle: "",
  phone: "",
  email: "",
  monthlyPay: "",
  status: "active",
  joinedOn: today(),
};

export default function EmployeeNew() {
  const navigate = useNavigate();
  const { staffUser } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ReturnType<typeof validateEmployeeForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateEmployeeForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!staffUser) return;

    setSubmitError(null);
    setSaving(true);
    const { error } = await supabase.from("employees").insert({
      studio_id: staffUser.studio_id,
      name: values.name.trim(),
      role_title: values.roleTitle.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      monthly_pay: Number(values.monthlyPay),
      status: values.status,
      joined_on: values.joinedOn,
    });
    setSaving(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }
    navigate("/employees");
  };

  return (
    <div>
      <TopBar title="Add employee" back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <EmployeeForm values={values} errors={errors} onChange={handleChange} />
        {submitError ? <p className="mb-3 text-center text-sm text-danger">{submitError}</p> : null}
        <Button type="submit" loading={saving} className="w-full">
          Add employee
        </Button>
      </form>
    </div>
  );
}
