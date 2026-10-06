import type { ReactNode } from "react";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-sm font-semibold text-text-muted">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs text-danger">{error}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-sm font-semibold text-text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold ${
                selected ? "border-accent bg-accent text-white" : "border-border bg-surface text-text"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
