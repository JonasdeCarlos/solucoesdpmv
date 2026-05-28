import type { Holiday, OfficeBranding } from './types';

const DEFAULT_TEMPLATE = `Prezado(a) Cliente,

Informamos que em {{data}} ({{dia_semana}}) será {{tipo_evento}}{{local_str}}: *{{nome_evento}}*.

{{observacao_curta}}

Em caso de dúvidas, contate-nos.

Atenciosamente,
{{nome_escritorio}}`;

const DOW = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function fmtBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function dow(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return DOW[d.getDay()];
}

export function defaultTemplate(): string { return DEFAULT_TEMPLATE; }

export function renderNoticeText(template: string, holidays: Holiday[], branding: OfficeBranding | null, customObs?: string): string {
  const first = holidays[0];
  if (!first) return template;
  const local = first.municipio
    ? ` em ${first.municipio}${first.uf ? '/' + first.uf : ''}`
    : (first.uf ? ` no estado de ${first.uf}` : '');

  let body = template
    .replaceAll('{{data}}', fmtBR(first.data))
    .replaceAll('{{dia_semana}}', dow(first.data))
    .replaceAll('{{municipio}}', first.municipio || '')
    .replaceAll('{{uf}}', first.uf || '')
    .replaceAll('{{local_str}}', local)
    .replaceAll('{{nome_evento}}', first.nome)
    .replaceAll('{{tipo_evento}}', first.is_optional ? 'ponto facultativo' : 'feriado')
    .replaceAll('{{observacao_curta}}', customObs ?? first.observacoes ?? '')
    .replaceAll('{{nome_escritorio}}', branding?.office_name || 'Monte Verde Contabilidade');

  if (holidays.length > 1) {
    const list = holidays.map((h) => `• ${fmtBR(h.data)} — ${h.nome}${h.is_optional ? ' (ponto facultativo)' : ''}`).join('\n');
    body += `\n\nDatas relacionadas:\n${list}`;
  }
  return body;
}