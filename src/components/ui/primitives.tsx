"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "ghost" | "subtle" | "primary" | "danger";

const variants: Record<Variant, string> = {
  ghost: "text-muted hover:text-fg hover:bg-white/6",
  subtle: "bg-white/5 text-fg hover:bg-white/9 border border-line",
  primary:
    "bg-gradient-to-b from-rust-hi to-rust text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_20px_-6px_rgb(206_66_43/0.7)] hover:brightness-110",
  danger: "text-red-300 hover:bg-red-500/15",
};

export function Button({
  variant = "subtle",
  size = "md",
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "icon"; active?: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition select-none",
        "focus-visible:ring-2 focus-visible:ring-rust/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35",
        size === "sm" && "h-7 px-2 text-xs",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "icon" && "size-8",
        variants[variant],
        active && "bg-white/10 text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-white/5 px-1 font-mono text-[10px] text-muted">{children}</kbd>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex rounded-lg border border-line bg-black/25 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "inline-flex h-6.5 items-center gap-1 rounded-md px-2 text-xs font-medium transition",
            value === o.value ? "bg-white/10 text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-4.5 w-8 shrink-0 rounded-full transition",
        checked ? "bg-rust" : "bg-white/12",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-3.5",
        )}
      />
    </button>
  );
}

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function Popover({
  trigger,
  children,
  align = "left",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={clsx(
            "absolute top-full z-50 mt-1.5 min-w-48 animate-pop rounded-xl border border-line-strong bg-panel-2/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
        danger ? "text-red-300 hover:bg-red-500/15" : "text-fg hover:bg-white/7",
      )}
    >
      {icon && <span className="text-muted [&>svg]:size-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-100 grid animate-fade place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className={clsx(
          "flex max-h-[88dvh] w-full animate-pop flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl shadow-black/70",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-rust/15 text-rust-hi [&>svg]:size-4.5">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <footer className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
