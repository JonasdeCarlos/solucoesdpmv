import { supabase } from '@/integrations/supabase/client';
import type { TipoArquivo, FundoTimbrado } from './aplicar';

export const BUCKET = 'timbrados';

export interface Timbrado {
  id: string;
  nome: string;
  empresa_id: string | null;
  arquivo_path: string;
  tipo_arquivo: TipoArquivo;
  arquivo_primeira_pagina_path: string | null;
  tipo_arquivo_primeira_pagina: TipoArquivo | null;
  margem_superior_mm: number;
  margem_inferior_mm: number;
  margem_esquerda_mm: number;
  margem_direita_mm: number;
  escala_minima: number;
  alinhamento_vertical: 'topo' | 'centro';
  ativo: boolean;
  created_at: string;
}

export interface EmpresaOpt { id: string; nome: string }

const db = supabase as any;

export async function listarTimbrados(): Promise<Timbrado[]> {
  const { data, error } = await db.from('timbrados').select('*').order('nome');
  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    margem_superior_mm: Number(t.margem_superior_mm),
    margem_inferior_mm: Number(t.margem_inferior_mm),
    margem_esquerda_mm: Number(t.margem_esquerda_mm),
    margem_direita_mm: Number(t.margem_direita_mm),
    escala_minima: Number(t.escala_minima),
  }));
}

export async function listarEmpresas(): Promise<EmpresaOpt[]> {
  const { data, error } = await supabase.from('clientes').select('id, nome').order('nome').limit(2000);
  if (error) throw error;
  return (data || []) as EmpresaOpt[];
}

export async function salvarTimbrado(t: Partial<Timbrado> & { id?: string }) {
  const { id, created_at, ...rest } = t as any;
  if (id) {
    const { error } = await db.from('timbrados').update(rest).eq('id', id);
    if (error) throw error;
    return id as string;
  }
  const { data, error } = await db.from('timbrados').insert(rest).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function excluirTimbrado(t: Timbrado) {
  const { error } = await db.from('timbrados').delete().eq('id', t.id);
  if (error) throw error;
}

export function tipoDoArquivo(f: File): TipoArquivo | null {
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
  if (f.type === 'image/png' || /\.png$/i.test(f.name)) return 'png';
  if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) return 'jpg';
  return null;
}

export async function enviarArquivo(f: File): Promise<string> {
  const safe = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `${crypto.randomUUID()}/${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
  if (error) throw error;
  return path;
}

const cacheArquivos = new Map<string, ArrayBuffer>();
export async function baixarArquivo(path: string): Promise<ArrayBuffer> {
  const hit = cacheArquivos.get(path);
  if (hit) return hit.slice(0);
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error || new Error('Arquivo do timbrado não encontrado');
  const buf = await data.arrayBuffer();
  cacheArquivos.set(path, buf);
  return buf.slice(0);
}

export async function carregarFundos(t: Timbrado): Promise<{ fundo: FundoTimbrado; fundoPrimeira: FundoTimbrado | null }> {
  const fundo = { bytes: await baixarArquivo(t.arquivo_path), tipo: t.tipo_arquivo };
  const fundoPrimeira = t.arquivo_primeira_pagina_path
    ? { bytes: await baixarArquivo(t.arquivo_primeira_pagina_path), tipo: (t.tipo_arquivo_primeira_pagina || 'pdf') as TipoArquivo }
    : null;
  return { fundo, fundoPrimeira };
}
