import { useState, useCallback } from 'react';

const KEY = 'office_operator_name';

export function getOperatorName(): string {
  return (typeof window !== 'undefined' && localStorage.getItem(KEY)) || '';
}

export function ensureOperatorName(): string {
  const cur = getOperatorName();
  if (cur) return cur;
  const name = window.prompt('Informe seu nome (ficará registrado nas marcações):')?.trim() || '';
  if (name) localStorage.setItem(KEY, name);
  return name;
}

export function useOperatorName() {
  const [name, setName] = useState<string>(getOperatorName());
  const update = useCallback((v: string) => {
    localStorage.setItem(KEY, v);
    setName(v);
  }, []);
  return { name, setName: update, ensure: ensureOperatorName };
}
