import { z } from 'zod';
import { emptyProfile, type ClienteDP, type DPProfile } from '@/types/sucessoCliente';

export const SNAPSHOT_VERSION = 1;

const clienteSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1, 'Razão Social obrigatória').max(255),
  tipo: z.enum(['PF', 'PJ']),
  cpf: z.string().max(20).default(''),
  cnpj: z.string().max(20).default(''),
  endereco: z.string().max(500).default(''),
  codigo_cliente: z.string().nullable().optional(),
  nome_fantasia: z.string().max(255).default(''),
  municipio: z.string().max(120).default(''),
  uf: z.string().max(2).default(''),
  segmento: z.string().max(120).default(''),
  contato_nome: z.string().max(255).default(''),
  contato_telefone: z.string().max(40).default(''),
  contato_email: z.string().max(255).default('').refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'E-mail do contato inválido'
  ),
  status: z.string().max(40).default('ativo'),
  gestor_carteira: z.string().max(120).default(''),
  tipo_folha: z.string().max(40).default(''),
});

const profileSchema = z.object({
  client_id: z.string().uuid(),
  digisac_contact_name: z.string().max(255).default(''),
  digisac_contact_id: z.string().max(255).default(''),
  channel_default: z.string().max(40).default('whatsapp'),
  best_contact_time: z.string().max(120).default(''),
  sla_hours: z.number().int().min(0).max(720).default(24),
  has_timeclock: z.boolean().default(false),
  timeclock_type: z.string().max(40).default(''),
  timeclock_owner: z.string().max(40).default(''),
  timeclock_url: z.string().max(500).default(''),
  timeclock_user: z.string().max(255).default(''),
  timeclock_notes: z.string().max(2000).default(''),
  manual_send_method: z.string().max(255).default(''),
  manual_send_frequency: z.string().max(40).default(''),
  has_variables: z.boolean().default(false),
  variables_how: z.string().max(40).default(''),
  variables_deadline_day: z.number().int().min(1).max(31).nullable().default(null),
  variables_responsible: z.string().max(255).default(''),
  needs_preview: z.boolean().default(false),
  preview_deadline_day: z.number().int().min(1).max(31).nullable().default(null),
  preview_channel: z.string().max(40).default(''),
  preview_rules: z.string().max(2000).default(''),
  workload_type: z.string().max(40).default('fixa'),
  workload_hhmm: z.string().max(10).default(''),
  workload_rules: z.string().max(2000).default(''),
  sst_empresa: z.string().max(255).default(''),
  sst_contato_nome: z.string().max(255).default(''),
  sst_contato_telefone: z.string().max(40).default(''),
  sst_contato_email: z.string().max(255).default('').refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'E-mail SST inválido'
  ),
});

export const snapshotSchema = z.object({
  kind: z.literal('sucesso-cliente-snapshot'),
  version: z.number().int().min(1),
  exported_at: z.string(),
  cliente: clienteSchema,
  profile: profileSchema,
});

export type Snapshot = z.infer<typeof snapshotSchema>;

export function buildSnapshot(cliente: ClienteDP, profile: DPProfile): Snapshot {
  const merged: DPProfile = { ...emptyProfile(cliente.id), ...profile, client_id: cliente.id };
  return {
    kind: 'sucesso-cliente-snapshot',
    version: SNAPSHOT_VERSION,
    exported_at: new Date().toISOString(),
    cliente,
    profile: merged,
  };
}

/* ---------- JSON ---------- */
export function toJSON(snap: Snapshot): string {
  return JSON.stringify(snap, null, 2);
}

export function parseJSON(text: string): Snapshot {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Arquivo JSON inválido.'); }
  const r = snapshotSchema.safeParse(raw);
  if (!r.success) {
    const msgs = r.error.errors.slice(0, 5).map((e) => `${e.path.join('.') || '(raiz)'}: ${e.message}`).join('\n');
    throw new Error('Snapshot inválido:\n' + msgs);
  }
  return r.data;
}

/* ---------- CSV (key,value) ---------- */
function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function flatten(snap: Snapshot): Record<string, unknown> {
  const out: Record<string, unknown> = { _kind: snap.kind, _version: snap.version, _exported_at: snap.exported_at };
  for (const [k, v] of Object.entries(snap.cliente)) out[`cliente.${k}`] = v;
  for (const [k, v] of Object.entries(snap.profile)) out[`profile.${k}`] = v;
  return out;
}

export function toCSV(snap: Snapshot): string {
  const flat = flatten(snap);
  const lines = ['campo,valor'];
  for (const [k, v] of Object.entries(flat)) lines.push(`${csvEscape(k)},${csvEscape(v)}`);
  return lines.join('\n');
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function coerce(key: string, raw: string): unknown {
  if (raw === '' || raw === 'null' || raw === 'undefined') {
    // null for nullable numeric fields
    if (/deadline_day$/.test(key) || key === 'cliente.codigo_cliente') return null;
    return '';
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/(sla_hours|deadline_day|_version)$/.test(key) && /^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

export function parseCSV(text: string): Snapshot {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error('CSV vazio.');
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (header[0] !== 'campo' || header[1] !== 'valor') {
    throw new Error('Cabeçalho esperado: campo,valor');
  }
  const cliente: Record<string, unknown> = {};
  const profile: Record<string, unknown> = {};
  const meta: Record<string, unknown> = {};
  for (let i = 1; i < lines.length; i++) {
    const [k, v] = parseCSVLine(lines[i]);
    if (!k) continue;
    const val = coerce(k, v ?? '');
    if (k.startsWith('cliente.')) cliente[k.slice(8)] = val;
    else if (k.startsWith('profile.')) profile[k.slice(8)] = val;
    else if (k.startsWith('_')) meta[k.slice(1)] = val;
  }
  const raw = {
    kind: meta.kind ?? 'sucesso-cliente-snapshot',
    version: meta.version ?? SNAPSHOT_VERSION,
    exported_at: (meta.exported_at as string) || new Date().toISOString(),
    cliente,
    profile,
  };
  const r = snapshotSchema.safeParse(raw);
  if (!r.success) {
    const msgs = r.error.errors.slice(0, 5).map((e) => `${e.path.join('.') || '(raiz)'}: ${e.message}`).join('\n');
    throw new Error('CSV inválido:\n' + msgs);
  }
  return r.data;
}

/* ---------- diff (preview) ---------- */
export type DiffEntry = { field: string; current: unknown; incoming: unknown };

export function diffSnapshot(
  current: { cliente: ClienteDP; profile: DPProfile },
  incoming: Snapshot
): DiffEntry[] {
  const out: DiffEntry[] = [];
  const cmp = (prefix: string, a: Record<string, unknown>, b: Record<string, unknown>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const av = a[k] ?? '';
      const bv = b[k] ?? '';
      if (JSON.stringify(av) !== JSON.stringify(bv)) {
        out.push({ field: `${prefix}.${k}`, current: av, incoming: bv });
      }
    }
  };
  cmp('cliente', current.cliente as any, incoming.cliente as any);
  cmp('profile', current.profile as any, incoming.profile as any);
  return out;
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}