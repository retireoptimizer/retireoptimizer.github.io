import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { formatWithCommas } from '../../lib/format';

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

const formatFor = (v: number, scale: number, digits?: number, withCommas = false): string => {
  if (!isFinite(v)) return '';
  const display = v * scale;
  const text = digits != null ? display.toFixed(digits) : String(display);
  return withCommas ? formatWithCommas(text) : text;
};

const stripCommas = (s: string) => s.replace(/,/g, '');

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
  // Live comma formatting is only useful for unscaled, integer-ish dollar inputs.
  // Percentage / decimal inputs (scale != 1 or digits set) skip it so the user
  // can type "0.5" without seeing it morph mid-keystroke.
  const useCommas = scale === 1 && digits == null;
  const [draft, setDraft] = useState<string>(() => formatFor(value, scale, digits, useCommas));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatFor(value, scale, digits, useCommas));
  }, [value, scale, digits, useCommas]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const stripped = useCommas ? stripCommas(raw) : raw;
    setDraft(useCommas ? formatWithCommas(stripped) : raw);
    if (stripped === '' || stripped === '-' || stripped === '.' || stripped === '-.') return;
    const parsed = parseFloat(stripped);
    if (isNaN(parsed)) return;
    onCommit(parsed / scale);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const stripped = useCommas ? stripCommas(draft) : draft;
    const parsed = parseFloat(stripped);
    if (isNaN(parsed)) {
      setDraft(formatFor(value, scale, digits, useCommas));
      return;
    }
    let committed = parsed / scale;
    if (min != null) committed = Math.max(min, committed);
    if (max != null) committed = Math.min(max, committed);
    onCommit(committed);
    setDraft(formatFor(committed, scale, digits, useCommas));
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
