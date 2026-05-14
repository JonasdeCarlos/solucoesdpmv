import { formatBR } from './normalize';

export interface AvisoMsgInput {
  empresa_name?: string;
  employee_name: string;
  motivo: string;
  due_date: string | null;
  limit_date: string | null;
}

export function buildWhatsappMessage(a: AvisoMsgInput): string {
  const nome = a.employee_name.trim();
  const motivo = a.motivo;
  const due = formatBR(a.due_date);
  const limite = formatBR(a.limit_date);

  const linhas: string[] = [];
  linhas.push('Olá! 👋');
  linhas.push('');
  linhas.push('Segue *aviso de vencimento* para acompanhamento:');
  linhas.push('');
  linhas.push(`• *Colaborador:* ${nome}`);
  linhas.push(`• *Motivo:* ${motivo}`);
  if (due) linhas.push(`• *Vencimento:* ${due}`);
  if (limite) linhas.push(`• *Data limite:* ${limite}`);
  linhas.push('');
  linhas.push('Por favor, entre em contato para darmos o tratamento necessário e evitar encargos desnecessários.');
  linhas.push('');
  linhas.push('_Monte Verde Contabilidade_');

  return linhas.join('\n');
}
