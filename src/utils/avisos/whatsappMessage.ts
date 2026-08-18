import { formatBR, normalizeText } from './normalize';

export interface AvisoMsgInput {
  empresa_name?: string;
  employee_name: string;
  motivo: string;
  due_date: string | null;
  limit_date: string | null;
}

export type AvisoMsgPrefix =
  | { kind: 'none' }
  | { kind: 'aviso'; n: 1 | 2 | 3 }
  | { kind: 'call'; whenISO: string };

function fmtDateTimeBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} às ${hora}`;
}

function isExameAviso(motivo: string): boolean {
  const n = normalizeText(motivo);
  if (n.includes('MONITORAMENTO') && n.includes('SAUDE')) return true;
  if (n.includes('EXAME')) return true;
  return false;
}

export function buildWhatsappMessage(a: AvisoMsgInput, prefix: AvisoMsgPrefix = { kind: 'none' }): string {
  const nome = a.employee_name.trim();
  const motivo = a.motivo;
  const due = formatBR(a.due_date);
  const limite = formatBR(a.limit_date);
  const exame = isExameAviso(motivo);

  const linhas: string[] = [];
  if (prefix.kind === 'aviso') {
    linhas.push(`Aviso ${prefix.n}`);
    linhas.push('');
  } else if (prefix.kind === 'call') {
    linhas.push(`Como tratado em ligação no dia ${fmtDateTimeBR(prefix.whenISO)}, segue último aviso.`);
    linhas.push('');
  }
  linhas.push('⚠️ *AVISO DE VENCIMENTO — MUITO IMPORTANTE* ⚠️');
  linhas.push('');
  linhas.push('Olá! 👋');
  linhas.push('');
  linhas.push('Segue aviso de vencimento para acompanhamento:');
  linhas.push('');
  linhas.push(`• *Colaborador:* ${nome}`);
  linhas.push(`• *Motivo:* ${motivo}`);
  if (due) linhas.push(`• *Vencimento:* ${due}`);
  if (limite) linhas.push(`• *Data limite:* ${limite}`);
  linhas.push('');
  if (exame) {
    linhas.push('Procure o Responsável Técnico de segurança de sua empresa para renovação.');
    linhas.push('');
    linhas.push('Monte Verde Contabilidade');
  } else {
    linhas.push('Por favor, entre em contato para darmos o tratamento necessário e evitar encargos desnecessários.');
    linhas.push('');
    linhas.push('_Monte Verde Contabilidade_');
  }

  return linhas.join('\n');
}
