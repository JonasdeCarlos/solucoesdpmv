import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type CommonProps = {
  value: string | number;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
};

/**
 * Mantém estado local enquanto o usuário digita e só dispara onCommit
 * no blur ou após um debounce. Evita reloads/flicker quando o onChange
 * persiste no banco a cada tecla.
 */
export function DebouncedInput({ value, onCommit, className, placeholder, type }: CommonProps) {
  const [local, setLocal] = useState<string>(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value == null ? '' : String(value));
  }, [value]);
  return (
    <Input
      type={type}
      className={className}
      placeholder={placeholder}
      value={local}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (local !== (value == null ? '' : String(value))) onCommit(local);
      }}
    />
  );
}

export function DebouncedTextarea({ value, onCommit, className, placeholder, rows }: CommonProps & { rows?: number }) {
  const [local, setLocal] = useState<string>(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value == null ? '' : String(value));
  }, [value]);
  return (
    <Textarea
      rows={rows}
      className={className}
      placeholder={placeholder}
      value={local}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (local !== (value == null ? '' : String(value))) onCommit(local);
      }}
    />
  );
}