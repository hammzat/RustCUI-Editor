"use client";

import clsx from "clsx";
import { useId, useRef, useState, type ReactNode } from "react";
import type { Color, Vec2 } from "@/lib/cui/types";
import { fmtColor, parseNumbers } from "@/lib/cui/serialize";
import { round } from "@/lib/cui/geometry";
import { rgba } from "../render/NodeView";

export const inputCls =
  "h-7 w-full min-w-0 rounded-md border border-line bg-black/25 px-2 text-[12px] text-fg outline-none transition placeholder:text-faint hover:border-line-strong focus:border-rust/70 focus:bg-black/40";

export function Row({ label, hint, children, top }: { label: ReactNode; hint?: string; children: ReactNode; top?: boolean }) {
  return (
    <div className={clsx("grid grid-cols-[84px_minmax(0,1fr)] gap-2", top ? "items-start" : "items-center")}>
      <label className={clsx("truncate text-[11.5px] text-muted", top && "pt-1.5")} title={hint}>
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  precision = 3,
  prefix,
  title,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  prefix?: ReactNode;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const scrub = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => round(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)), precision);

  const commit = () => {
    if (draft == null) return;
    // Allow simple arithmetic like "100/2" or "32+8".
    const expr = draft.replace(/,/g, ".");
    let v = Number(expr);
    if (!Number.isFinite(v) && /^[\d\s.+\-*/()]+$/.test(expr)) {
      try {
        v = Number(Function(`"use strict";return (${expr})`)());
      } catch {
        v = NaN;
      }
    }
    if (Number.isFinite(v)) onChange(clamp(v));
    setDraft(null);
  };

  return (
    <div className="relative flex min-w-0 items-center" title={title}>
      {prefix && (
        <span
          className="absolute left-0 z-10 flex h-full w-5 cursor-ew-resize items-center justify-center text-[10px] font-semibold text-faint select-none hover:text-rust-hi"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub.current = { x: e.clientX, v: value };
          }}
          onPointerMove={(e) => {
            if (!scrub.current) return;
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            onChange(clamp(scrub.current.v + Math.round((e.clientX - scrub.current.x) / 2) * step * mult));
          }}
          onPointerUp={() => (scrub.current = null)}
        >
          {prefix}
        </span>
      )}
      <input
        className={clsx(inputCls, "font-mono tabular-nums", prefix && "pl-5")}
        value={draft ?? String(round(value, precision))}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            onChange(clamp(value + (e.key === "ArrowUp" ? 1 : -1) * step * mult));
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

export function Vec2Input({
  value,
  onChange,
  step = 1,
  precision = 3,
  labels = ["X", "Y"],
}: {
  value: Vec2;
  onChange: (v: Vec2) => void;
  step?: number;
  precision?: number;
  labels?: [string, string];
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <NumberInput prefix={labels[0]} value={value[0]} step={step} precision={precision} onChange={(x) => onChange([x, value[1]])} />
      <NumberInput prefix={labels[1]} value={value[1]} step={step} precision={precision} onChange={(y) => onChange([value[0], y])} />
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  suggestions,
  multiline,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  multiline?: boolean;
  mono?: boolean;
}) {
  const listId = useId();
  if (multiline) {
    return (
      <textarea
        className={clsx(inputCls, "h-auto min-h-16 resize-y py-1.5 leading-snug", mono && "font-mono")}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    );
  }
  return (
    <>
      <input
        className={clsx(inputCls, mono && "font-mono text-[11px]")}
        value={value}
        placeholder={placeholder}
        list={suggestions ? listId : undefined}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}

export function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[] | { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select className={clsx(inputCls, "cursor-pointer pr-6")} value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value} className="bg-panel-2">
          {o.label}
        </option>
      ))}
    </select>
  );
}

const toHex = (c: Color) =>
  "#" +
  c
    .slice(0, 3)
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
    .join("");

const SWATCHES: Color[] = [
  [1, 1, 1, 1],
  [0, 0, 0, 0.6],
  [0.1, 0.1, 0.1, 0.9],
  [0.8, 0.26, 0.17, 1],
  [0.45, 0.55, 0.22, 1],
  [0.29, 0.6, 0.85, 1],
  [1, 0.84, 0.42, 1],
  [0.6, 0.2, 0.8, 1],
];

export function ColorInput({ value, onChange }: { value: Color; onChange: (c: Color) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="checker relative size-7 shrink-0 overflow-hidden rounded-md ring-1 ring-line-strong"
          onClick={() => setOpen((o) => !o)}
          title="Palette"
        >
          <span className="absolute inset-0" style={{ background: rgba(value) }} />
        </button>
        <input
          className={clsx(inputCls, "font-mono text-[11px]")}
          value={draft ?? fmtColor(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft != null) {
              const hex = draft.trim().match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
              if (hex) {
                const n = parseInt(hex[1], 16);
                const a = hex[2] ? parseInt(hex[2], 16) / 255 : value[3];
                onChange([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, round(a, 3)].map((v) => round(v, 3)) as Color);
              } else {
                onChange(parseNumbers(draft, 4, value).map((v) => Math.min(1, Math.max(0, v))) as Color);
              }
            }
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          spellCheck={false}
        />
      </div>
      {open && (
        <div className="animate-fade space-y-2 rounded-lg border border-line bg-black/20 p-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={toHex(value)}
              onChange={(e) => {
                const n = parseInt(e.target.value.slice(1), 16);
                onChange([round(((n >> 16) & 255) / 255), round(((n >> 8) & 255) / 255), round((n & 255) / 255), value[3]]);
              }}
              className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="w-6 text-[10px] text-faint">A</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={value[3]}
              onChange={(e) => onChange([value[0], value[1], value[2], Number(e.target.value)])}
              className="min-w-0 flex-1"
            />
            <span className="w-8 text-right font-mono text-[10px] text-muted">{Math.round(value[3] * 100)}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {SWATCHES.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange([...s])}
                className="checker relative size-5 overflow-hidden rounded ring-1 ring-line-strong transition hover:scale-110"
              >
                <span className="absolute inset-0" style={{ background: rgba(s) }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
