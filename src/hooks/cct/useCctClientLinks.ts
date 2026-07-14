import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logCctAudit } from './useCctAnalyses';

export interface CctClientLink {
  id: string;
  cct_analysis_id: string;
  client_id: string;
  client_cct_id: string | null;
  status: string;
  linked_by: string | null;
  linked_at: string;
  unlinked_at: string | null;
  client_name?: string;
  client_cnpj?: string;
}

export function useCctClientLinks(analysisId: string | undefined) {
  const [links, setLinks] = useState<CctClientLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!analysisId) { setLinks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('cct_client_links' as any)
      .select('*')
      .eq('cct_analysis_id', analysisId)
      .order('linked_at', { ascending: false });
    const rows = (data || []) as any as CctClientLink[];
    const ids = Array.from(new Set(rows.map((r) => r.client_id)));
    if (ids.length > 0) {
      const { data: clientes } = await supabase.from('clientes' as any).select('id,nome,cnpj,cpf').in('id', ids);
      const byId = new Map((clientes as any[] || []).map((c) => [c.id, c]));
      for (const r of rows) {
        const c: any = byId.get(r.client_id);
        r.client_name = c?.nome || 'Cliente';
        r.client_cnpj = c?.cnpj || c?.cpf || '';
      }
    }
    setLinks(rows);
    setLoading(false);
  }, [analysisId]);

  useEffect(() => { load(); }, [load]);

  const linkClients = async (clientIds: string[], analysis: any, mode: 'keep' | 'archive') => {
    if (!analysisId || clientIds.length === 0) return { error: null };
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id || null;

    for (const client_id of clientIds) {
      // Verifica se cliente tem client_ccts ativa
      const { data: existing } = await supabase.from('client_ccts' as any)
        .select('id,cct_analysis_id')
        .eq('client_id', client_id)
        .eq('is_active', true);
      const existingRows = (existing || []) as any[];

      if (mode === 'archive' && existingRows.length > 0) {
        for (const row of existingRows) {
          if (row.cct_analysis_id === analysisId) continue;
          await supabase.from('client_ccts' as any).update({ is_active: false } as any).eq('id', row.id);
          await supabase.from('cct_versions' as any).insert({
            cct_analysis_id: row.cct_analysis_id || analysisId,
            snapshot: { ...row, client_cct_id: row.id, client_id },
            reason: 'substituição por nova CCT vinculada',
            created_by: uid,
          } as any);
        }
      }

      // Verifica se já existe client_ccts para essa análise+cliente
      const alreadyLinked = existingRows.find((r) => r.cct_analysis_id === analysisId);
      let client_cct_id: string | null = alreadyLinked?.id || null;
      if (!client_cct_id) {
        const ident = analysis?.identification || {};
        const unions = analysis?.unions || {};
        const terr = analysis?.territorial_base || {};
        const { data: newCct } = await supabase.from('client_ccts' as any).insert({
          client_id,
          cct_analysis_id: analysisId,
          sindicato: unions.sindicato_laboral || null,
          union_base: terr.descricao || (Array.isArray(terr.municipios) ? terr.municipios.join(', ') : null) || null,
          uf: terr.uf || null,
          data_base: ident.data_base || null,
          validity_start: ident.vigencia_inicial || null,
          validity_end: ident.vigencia_final || null,
          doc_path: analysis?.original_file_path || null,
          doc_name: analysis?.original_file_name || analysis?.title || null,
          is_active: true,
          created_by: uid,
        } as any).select('id').maybeSingle();
        client_cct_id = (newCct as any)?.id || null;
      }

      await supabase.from('cct_client_links' as any).insert({
        cct_analysis_id: analysisId,
        client_id,
        client_cct_id,
        status: 'ativo',
        linked_by: uid,
      } as any);

      await logCctAudit(analysisId, 'client_linked', { client_id, mode });
    }

    await load();
    return { error: null };
  };

  const unlink = async (link: CctClientLink, reason?: string) => {
    await supabase.from('cct_client_links' as any)
      .update({ status: 'removido', unlinked_at: new Date().toISOString() } as any)
      .eq('id', link.id);
    if (link.client_cct_id) {
      await supabase.from('client_ccts' as any).update({ is_active: false } as any).eq('id', link.client_cct_id);
    }
    await logCctAudit(link.cct_analysis_id, 'client_unlinked', { client_id: link.client_id, reason });
    await load();
  };

  return { links, loading, reload: load, linkClients, unlink };
}