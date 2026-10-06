import { BUSINESS_TYPES } from "@/lib/businessTypes";
import type { BusinessType } from "@/types/database";

export default function BusinessTypePicker({
  value,
  onChange,
  label = "What kind of shop is this?",
}: {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
  label?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold text-text-muted">{label}</div>
      <div className="flex flex-col gap-2">
        {BUSINESS_TYPES.map((type) => {
          const selected = type.value === value;
          return (
            <button
              type="button"
              key={type.value}
              onClick={() => onChange(type.value)}
              className={`rounded-xl border p-3 text-left ${
                selected ? "border-accent bg-accent-dim" : "border-border bg-surface"
              }`}
            >
              <div className={`text-[15px] font-semibold ${selected ? "text-accent" : "text-text"}`}>
                {type.label}
              </div>
              <div className={`mt-0.5 text-xs ${selected ? "text-accent/80" : "text-text-muted"}`}>
                {type.mode === "membership"
                  ? "Tracks monthly membership fees"
                  : "Tracks visits, reminds clients to come back"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
