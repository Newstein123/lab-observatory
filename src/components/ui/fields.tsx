"use client";

import { useEffect, useId, useState } from "react";

export const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-sunken/80 px-3 text-sm tabular-nums outline-none transition-colors hover:border-border-strong focus:border-accent aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60";

interface NumberFieldProps {
  label: string;
  unit?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string;
  step?: number;
  hint?: string;
  disabled?: boolean;
}

/**
 * Numeric input that keeps the user's raw text while typing, so partial
 * entries ("0.", "") don't fight the parsed value.
 */
export function NumberField({ label, unit, value, onChange, error, step = 1, hint, disabled }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? "" : String(value));

  // Sync when the value changes externally (e.g. a preset is applied).
  useEffect(() => {
    setText((current) => (parse(current) === value ? current : value === undefined ? "" : String(value)));
  }, [value]);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {unit && <span className="font-mono">{unit}</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={text}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className={inputClass}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={`text-xs ${error ? "text-danger" : "text-muted"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function parse(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField<T extends string>({ label, value, options, onChange, placeholder, disabled }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}

export function RangeField({ label, value, min, max, step, onChange, display }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono text-foreground">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
  icon,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** A small decorative icon before the title. */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-2xl p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          {icon && <span className="text-accent [&>svg]:size-[18px]">{icon}</span>}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
