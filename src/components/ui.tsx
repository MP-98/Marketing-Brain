"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

// ── Button ────────────────────────────────────────────────────────────────
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "outline", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer",
        "transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed select-none",
        size === "sm" ? "text-[13px] px-3 h-8" : "text-sm px-4 h-10",
        variant === "primary" &&
          "bg-accent-strong text-bg hover:brightness-108 font-semibold",
        variant === "outline" &&
          "border border-border-strong text-fg hover:bg-surface-2 hover:border-accent-dim",
        variant === "ghost" && "text-fg-muted hover:text-fg hover:bg-surface-2",
        variant === "danger" &&
          "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      )}
      {...props}
    />
  );
});

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-surface/70 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

// ── Chip / tag ──────────────────────────────────────────────────────────────
export function Chip({
  className,
  active,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 h-6 text-[11px] font-mono cursor-pointer transition-colors",
        active
          ? "border-accent-strong bg-accent-strong/15 text-accent-strong"
          : "border-border text-fg-muted hover:border-accent-dim hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

// ── Section heading with a number badge ─────────────────────────────────────
export function SectionHeading({
  n,
  title,
  hint,
  right,
}: {
  n: string;
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-accent-strong/80 tabular-nums pt-0.5">
          {n}
        </span>
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-fg">
            {title}
          </h2>
          {hint && <p className="text-[13px] text-fg-subtle mt-0.5">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── Eyebrow label ───────────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
      {children}
    </span>
  );
}

// ── Skeleton block ──────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}
