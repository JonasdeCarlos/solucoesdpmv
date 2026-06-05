import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ImportRow {
  codigo_cliente?: string;
  razao_social?: string;
  cnpj?: string;
  cpf?: string;
  tipo?: string;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  segmento?: string;
  contato_nome?: string;
  contato_telefone?: string;
  contato_email?: string;
  status?: string;
  endereco?: string;
}

export interface ImportPreview {
  novos: ImportRow[];
  atualizar: Array<{ row: ImportRow; existingId: string }>;
  conflitos: Array<{ row: ImportRow; motivo: string }>;
  erros: Array<{ row: ImportRow; erro: string }>;
}

const normCnpj = (s?: string) => (s || '').replace(/\D/g, '');

export async function parseExcelFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
  return rows.map((r) => {
    const out: ImportRow = {};
    for (const k of Object.keys(r)) {
      const key = String(k).trim().toLowerCase().replace(/[\s/-]+/g, '_').replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[ç]/g, 'c');
      (out as any)[key] = String(r[k] ?? '').trim();
    }
    return out;
  });
}

export async function buildPreview(rows: ImportRow[]): Promise<ImportPreview> {
  const { data: existing } = await supabase.from('clientes' as any).select('id, codigo_cliente, cnpj').limit(10000);
  const byCnpj = new Map<string, string>();
  const byCodigo = new Map<string, string>();
  for (const c of (existing || []) as any[]) {
    if (c.cnpj) byCnpj.set(normCnpj(c.cnpj), c.id);
    if (c.codigo_cliente) byCodigo.set(String(c.codigo_cliente).trim(), c.id);
  }
  const preview: ImportPreview = { novos: [], atualizar: [], conflitos: [], erros: [] };
  for (const r of rows) {
    if (!r.razao_social) { preview.erros.push({ row: r, erro: 'razao_social obrigatória' }); continue; }
    const cnpj = normCnpj(r.cnpj);
    const codigo = (r.codigo_cliente || '').trim();
    const idByCnpj = cnpj ? byCnpj.get(cnpj) : undefined;
    const idByCodigo = codigo ? byCodigo.get(codigo) : undefined;
    if (idByCnpj && idByCodigo && idByCnpj !== idByCodigo) {
      preview.conflitos.push({ row: r, motivo: 'CNPJ e código apontam para clientes diferentes' });
    } else if (idByCnpj || idByCodigo) {
      preview.atualizar.push({ row: r, existingId: idByCnpj || idByCodigo! });
    } else {
      preview.novos.push(r);
    }
  }
  return preview;
}

export async function applyImport(preview: ImportPreview) {
  let created = 0, updated = 0, errors = 0;
  const errMsgs: string[] = [];
  for (const r of preview.novos) {
    const payload: any = {
      nome: r.razao_social,
      tipo: (r.tipo || (r.cnpj ? 'PJ' : 'PF')).toUpperCase() === 'PF' ? 'PF' : 'PJ',
      cpf: r.cpf || '',
      cnpj: r.cnpj || '',
      endereco: r.endereco || '',
      codigo_cliente: r.codigo_cliente || null,
      nome_fantasia: r.nome_fantasia || '',
      municipio: r.municipio || '',
      uf: (r.uf || '').toUpperCase(),
      segmento: r.segmento || '',
      contato_nome: r.contato_nome || '',
      contato_telefone: r.contato_telefone || '',
      contato_email: r.contato_email || '',
      status: r.status || 'ativo',
    };
    const { error } = await supabase.from('clientes' as any).insert(payload);
    if (error) { errors++; errMsgs.push(`${r.razao_social}: ${error.message}`); } else created++;
  }
  for (const { row: r, existingId } of preview.atualizar) {
    const payload: any = {
      nome: r.razao_social,
      cnpj: r.cnpj || undefined,
      codigo_cliente: r.codigo_cliente || undefined,
      nome_fantasia: r.nome_fantasia || undefined,
      municipio: r.municipio || undefined,
      uf: r.uf ? r.uf.toUpperCase() : undefined,
      segmento: r.segmento || undefined,
      contato_nome: r.contato_nome || undefined,
      contato_telefone: r.contato_telefone || undefined,
      contato_email: r.contato_email || undefined,
      status: r.status || undefined,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    const { error } = await supabase.from('clientes' as any).update(payload).eq('id', existingId);
    if (error) { errors++; errMsgs.push(`${r.razao_social}: ${error.message}`); } else updated++;
  }
  return { created, updated, errors, errMsgs };
}

export function exportErrorsCsv(errs: { row: ImportRow; erro: string }[]) {
  const header = 'razao_social,cnpj,codigo_cliente,erro\n';
  const body = errs.map(e => `"${e.row.razao_social||''}","${e.row.cnpj||''}","${e.row.codigo_cliente||''}","${e.erro.replace(/"/g,'""')}"`).join('\n');
  return new Blob([header + body], { type: 'text/csv;charset=utf-8' });
}

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['codigo_cliente','razao_social','cnpj','nome_fantasia','municipio','uf','segmento','contato_nome','contato_telefone','contato_email','status','tipo','cpf','endereco'],
    ['001','Empresa Exemplo Ltda','00.000.000/0001-00','Exemplo','Camanducaia','MG','Indústria','João','(35) 99999-9999','contato@exemplo.com','ativo','PJ','','Rua X, 100'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'modelo-importacao-clientes.xlsx');
}