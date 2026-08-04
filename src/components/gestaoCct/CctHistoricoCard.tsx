import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';

interface Mudanca { bloco?: string; titulo?: string; anterior?: string; nova?: string; impacto?: string }

interface Registro {
  id: string;
  version_number: number;
  created_at: string;
  reason: string | null;
  mudancas: Mudanca[];
  documento?: { titulo?: string | null; fonte?: string | null };
  resumo?: string | null;
}

export function CctHistoricoCard({ analysisId }: { analysisId: string }) {
  const [itens, setItens] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('cct_versions' as any)
        .select('*')
        .eq('cct_analysis_id', analysisId)
        .order('version_number', { ascending: false });
      if (!ativo) return;
      const rows = ((data || []) as any[]).map((v) => ({
        id: v.id,
        version_number: v.version_number,
        created_at: v.created_at,
        reason: v.reason,
        mudancas: Array.isArray(v.snapshot?.mudancas) ? v.snapshot.mudancas : [],
        documento: v.snapshot?.documento,
        resumo: v.snapshot?.resumo,
      })) as Registro[];
      setItens(rows.filter((r) => r.mudancas.length > 0));
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [analysisId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />Histórico de modificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma modificação registrada. Quando um novo documento (circular, ata, aditivo) for aceito no Radar, os pontos alterados aparecem aqui.
          </p>
        ) : (
          itens.map((r) => (
            <div key={r.id} className="border rounded-md p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">v{r.version_number} → v{r.version_number + 1}</Badge>
                <span className="text-sm font-medium">{r.documento?.titulo || r.reason || 'Alteração'}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
              </div>
              {r.resumo && <p className="text-xs text-muted-foreground">{r.resumo}</p>}
              <div className="space-y-2">
                {r.mudancas.map((m, i) => (
                  <div key={i} className="rounded bg-muted/40 p-2 text-sm">
                    <div className="font-medium">{m.titulo || m.bloco || 'Ponto alterado'}</div>
                    <div className="grid gap-1 sm:grid-cols-2 mt-1 text-xs">
                      <div><span className="text-muted-foreground">Antes: </span>{m.anterior || '—'}</div>
                      <div><span className="text-muted-foreground">Depois: </span>{m.nova || '—'}</div>
                    </div>
                    {m.impacto && <p className="text-xs text-muted-foreground mt-1">Impacto no DP: {m.impacto}</p>}
                  </div>
                ))}
              </div>
              {r.documento?.fonte && (
                <a href={r.documento.fonte} target="_blank" rel="noreferrer" className="text-xs underline text-primary">Abrir documento de origem</a>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
