import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import EmployeeForm, { validateEmployeeForm } from "@/components/forms/EmployeeForm";
import type { EmployeeFormValues } from "@/components/forms/EmployeeForm";
import { Button } from "@/components/ui";
import TopBar from "@/components/TopBar";
import LoadingScreen from "@/components/LoadingScreen";
import type { Employee } from "@/types/database";

function toFormValues(employee: Employee): EmployeeFormValues {
  return {
    name: employee.name,
    roleTitle: employee.role_title ?? "",
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    monthlyPay: String(employee.monthly_pay),
    status: employee.status,
    joinedOn: employee.joined_on,
  };
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [values, setValues] = useState<EmployeeFormValues | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateEmployeeForm>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const { data, error: fetchError } = await supabase.from("employees").select("*").eq("id", id).single();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setEmployee(data);
    setValues(toFormValues(data));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !values) return <LoadingScreen />;
  if (error || !employee) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-danger">{error ?? "Employee not found."}</p>
      </div>
    );
  }

  const handleChange = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateEmployeeForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setSavedMessage(null);
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        name: values.name.trim(),
        role_title: values.roleTitle.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        monthly_pay: Number(values.monthlyPay),
        status: values.status,
        joined_on: values.joinedOn,
      })
      .eq("id", employee.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
    setSavedMessage("Employee details updated.");
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${employee.name}? This can't be undone.`)) return;
    const { error: deleteError } = await supabase.from("employees").delete().eq("id", employee.id);
    if (deleteError) {
      window.alert(`Couldn't delete: ${deleteError.message}`);
      return;
    }
    navigate("/employees");
  };

  return (
    <div>
      <TopBar title="Employee" back />
      <form onSubmit={handleSave} className="p-4 pb-10">
        <EmployeeForm values={values} errors={errors} onChange={handleChange} />
        {savedMessage ? <p className="mb-3 text-center text-sm text-success">{savedMessage}</p> : null}
        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} className="mt-3 w-full">
          Delete employee
        </Button>
      </form>
    </div>
  );
}
