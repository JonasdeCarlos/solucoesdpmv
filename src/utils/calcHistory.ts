import type { Step1Data, Step2Data, Step3Data, VerbaRescisoria } from '@/utils/calculations';
import { calcularTotal } from '@/utils/calculations';

export const HISTORY_KEY = 'calc_rescisao_history_v1';

export interface SavedCalculation {
  id: string;
  label: string;
  total: number;
  createdAt: number;
  updatedAt: number;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  verbas: VerbaRescisoria[];
}

const reviveDates = (s1: any): Step1Data => ({
  ...s1,
  dataAdmissao: s1?.dataAdmissao ? new Date(s1.dataAdmissao) : null,
  dataDesligamento: s1?.dataDesligamento ? new Date(s1.dataDesligamento) : null,
});

export function loadHistory(): SavedCalculation[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedCalculation[];
    return arr.map((c) => ({ ...c, step1: reviveDates(c.step1) }));
  } catch {
    return [];
  }
}

function saveAll(items: SavedCalculation[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function buildLabel(step1: Step1Data, step3: Step3Data): string {
  if (step3.empregadoNome?.trim()) return step3.empregadoNome.trim();
  if (step3.empregadorNome?.trim()) return `Empregador: ${step3.empregadorNome.trim()}`;
  if (step1.dataDesligamento) {
    return `Desligamento ${new Date(step1.dataDesligamento).toLocaleDateString('pt-BR')}`;
  }
  return 'Cálculo sem identificação';
}

export function upsertCalculation(params: {
  id: string | null;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  verbas: VerbaRescisoria[];
}): SavedCalculation {
  const items = loadHistory();
  const now = Date.now();
  const total = calcularTotal(params.verbas);
  const label = buildLabel(params.step1, params.step3);

  if (params.id) {
    const idx = items.findIndex((i) => i.id === params.id);
    if (idx >= 0) {
      const updated: SavedCalculation = {
        ...items[idx],
        label,
        total,
        updatedAt: now,
        step1: params.step1,
        step2: params.step2,
        step3: params.step3,
        verbas: params.verbas,
      };
      items[idx] = updated;
      saveAll(items);
      return updated;
    }
  }

  const created: SavedCalculation = {
    id: (crypto as any)?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    total,
    createdAt: now,
    updatedAt: now,
    step1: params.step1,
    step2: params.step2,
    step3: params.step3,
    verbas: params.verbas,
  };
  items.push(created);
  saveAll(items);
  return created;
}

export function deleteCalculation(id: string) {
  saveAll(loadHistory().filter((i) => i.id !== id));
}