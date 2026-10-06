import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { getBusinessTypeConfig } from "@/lib/businessTypes";
import { Card, SectionLabel } from "@/components/ui";
import { IconChevronRight, IconLogout } from "@/components/icons";
import TopBar from "@/components/TopBar";

export default function More() {
  const { studio, signOut } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");

  return (
    <div>
      <TopBar title="More" />
      <div className="p-4">
        <Card className="mb-6">
          <div className="text-lg font-bold text-text">{studio?.name}</div>
          <div className="mt-0.5 text-sm text-text-muted">{config.label}</div>
        </Card>

        <SectionLabel>Manage</SectionLabel>
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <Link to="/employees" className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
              <div className="text-[15px] font-semibold text-text">Employees</div>
              <div className="mt-0.5 text-xs text-text-muted">Staff list &amp; monthly pay</div>
            </div>
            <IconChevronRight className="text-text-muted" />
          </Link>
          <Link to="/settings" className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-[15px] font-semibold text-text">Settings</div>
              <div className="mt-0.5 text-xs text-text-muted">Shop type, reminders, sign-up link</div>
            </div>
            <IconChevronRight className="text-text-muted" />
          </Link>
        </div>

        <button
          onClick={() => signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/40 py-3.5 text-[15px] font-semibold text-danger"
        >
          <IconLogout width={18} height={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}
