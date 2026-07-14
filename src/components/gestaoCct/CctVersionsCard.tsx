import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useCctVersions } from '@/hooks/cct/useCctVersions';
import { logCctAudit } from '@/hooks/cct/useCctAnalyses';

export function CctVersionsCard({ analysis }: { analysis: any }) {
  const { items, loading, snapshot } = useCctVersions(analysis?.id);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const takeSnapshot = async () => {
    if (!analysis?.id) return;
    setSaving(true);
    const { error } = await snapshot(reason || 'snapshot manual', analysis);
    if (error) {
      toast.error('Falha ao criar versão.');
    } else {
      await logCctAudit(analysis.id, 'version_snapshot', { reason });
      toast.success('Versão salva.');
      setReason('');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" />Histórico de versões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Motivo (ex.: após revisão, aditivo recebido)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={takeSnapshot} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
            Salvar versão
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma versão registrada. Use "Salvar versão" para congelar o Raio-X atual.</p>
        ) : (
          <div className="space-y-2">
            {items.map((v) => (
              <div key={v.id} className="border rounded-md p-2 text-sm flex items-start gap-3">
                <Badge variant="outline">v{v.version_number}</Badge>
                <div className="flex-1">
                  <div>{v.reason || '—'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}