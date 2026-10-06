import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "border-accent/40 bg-accent-dim" : "border-border bg-surface"
      } ${className}`}
    >
      {children}
    </div>
  );
}

type BadgeTone = "success" | "danger" | "accent" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  accent: "border border-accent/50 text-accent",
  neutral: "bg-surface-raised text-text-muted",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}

export function Button({ variant = "primary", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  const base = "rounded-xl px-4 py-3.5 font-semibold text-center transition active:scale-[0.98] disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-accent text-white",
    secondary: "border border-border text-text bg-transparent",
    danger: "border border-danger/50 text-danger bg-transparent",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? "…" : children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-accent focus:outline-none ${
        props.className ?? ""
      }`}
    />
  );
}

export function StatTile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <Card className="flex flex-col items-center gap-1 py-5 text-center">
      <div className="text-accent">{icon}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
    </Card>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-text-muted">{children}</div>;
}
