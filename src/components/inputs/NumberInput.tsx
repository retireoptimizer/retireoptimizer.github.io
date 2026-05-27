import { useState, useEffect, useRef, type CSSProperties } from 'react';

interface Props {
  value: number;
  onCommit: (v: number) => void;
  scale?: number;
  digits?: number;
  min?: number;
  max?: number;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}

const formatFor = (v: number, scale: number, digits?: number): string => {
  if (!isFinite(v)) return '';
  const display = v * scale;
  if (digits != null) return display.toFixed(digits);
  return String(display);
};

export function NumberInput({
  value,
  onCommit,
  scale = 1,
  digits,
  min,
  max,
  className,
  style,
  placeholder,
}: Props) {
  const [draft, setDraft] = useState<string>(() => formatFor(value, scale, digits));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatFor(value, scale, digits));
  }, [value, scale, digits]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);
    if (next === '' || next === '-' || next === '.' || next === '-.') return;
    const parsed = parseFloat(next);
    if (isNaN(parsed)) return;
    onCommit(parsed / scale);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const parsed = parseFloat(draft);
    if (isNaN(parsed)) {
      setDraft(formatFor(value, scale, digits));
      return;
    }
    let committed = parsed / scale;
    if (min != null) committed = Math.max(min, committed);
    if (max != null) committed = Math.min(max, committed);
    onCommit(committed);
    setDraft(formatFor(committed, scale, digits));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      value={draft}
      placeholder={placeholder}
      onFocus={() => { focusedRef.current = true; }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
