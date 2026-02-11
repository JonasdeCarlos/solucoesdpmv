import React, { useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: () => void;
  className?: string;
  disabled?: boolean;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, onComplete, className = '', disabled }) => {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);

    if (raw.length <= 2) {
      onChange(raw);
      return;
    }

    const formatted = raw.slice(0, 2) + ':' + raw.slice(2);

    if (raw.length === 4) {
      const h = parseInt(raw.slice(0, 2));
      const m = parseInt(raw.slice(2));
      if (h > 23 || m > 59) {
        // Invalid — don't advance
        onChange(formatted);
        return;
      }
      onChange(formatted);
      setTimeout(() => onComplete?.(), 50);
    } else {
      onChange(formatted);
    }
  }, [onChange, onComplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      // Allow natural tab
      return;
    }
  }, []);

  const displayValue = value;
  const isInvalid = value.length === 5 && (
    parseInt(value.slice(0, 2)) > 23 || parseInt(value.slice(3)) > 59
  );

  return (
    <Input
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="--:--"
      maxLength={5}
      disabled={disabled}
      className={`w-[70px] text-center font-mono text-sm px-1 ${isInvalid ? 'border-destructive' : ''} ${className}`}
    />
  );
};

export default TimeInput;
