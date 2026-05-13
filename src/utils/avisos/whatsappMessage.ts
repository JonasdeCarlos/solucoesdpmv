import { formatBR } from './normalize';

export interface AvisoMsgInput {
  empresa_name?: string;
  employee_name: string;
  motivo: string;
  due_date: string | null;
  limit_date: string | null;
}

export function buildWhatsappMessage(a: AvisoMsgInput): string {
  const parts: string[] = [];
  parts.push(a.employee_name.trim());
  parts.push(a.motivo);
  let dataStr = formatBR(a.due_date);
  if (a.limit_date) dataStr += ` (Limite: ${formatBR(a.limit_date)})`;
  if (dataStr) parts.push(dataStr);
  const linha = parts.filter(Boolean).join(' — ');

  return [
    'Prezado(a) Cliente, se atente para os avisos de vencimento a seguir:',
    '',
    `- ${linha}.`,
    '',
    'Contate-nos para que possamos dar o tratamento necessário, evitando o pagamento de encargos desnecessários.',
  ].join('\n');
}
