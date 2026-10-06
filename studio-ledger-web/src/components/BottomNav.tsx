import { NavLink } from "react-router-dom";
import { IconChart, IconDots, IconPeople, IconReceipt } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { getBusinessTypeConfig } from "@/lib/businessTypes";

export default function BottomNav() {
  const { studio } = useAuth();
  const config = getBusinessTypeConfig(studio?.business_type ?? "yoga_studio");

  const items = [
    { to: "/clients", label: config.personLabelPlural, icon: IconPeople },
    { to: "/financials", label: "Financials", icon: IconChart },
    { to: "/expenses", label: "Expenses", icon: IconReceipt },
    { to: "/more", label: "More", icon: IconDots },
  ];

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                isActive ? "text-accent" : "text-text-muted"
              }`
            }
          >
            <item.icon width={22} height={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
