import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

export type BuscarNovaCctAlvo = {
  clientCctId?: string | null;
  sindicato: string;
  uf: string;
  municipio?: string;
  vigenciaFim?: string | null;
};

type Instrumento = {
  titulo: string;
  tipo: string;
  numero_registro: string;
  numero_solicitacao: string;
  vigencia: string;
  vigente: boolean;
  partes: string[];
  url: string;
  url_download: string;
};

type Finding = {
  id: string;
  title: string;
  source_url: string;
  source_name: string | null;
  source_type: string;
  confidence: number | null;
  finding_type: string;
};

export default function BuscarNovaCctDialog({
  open,
  onOpenChange,
  alvo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alvo: BuscarNovaCctAlvo | null;
}) {
  const nav = useNavigate();
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [loadingMed, setLoadingMed] = useState(false);
  const [importando, setImportando] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [radarMsg, setRadarMsg] = useState<string>('');
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [medMsg, setMedMsg] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setMunicipio(alvo?.municipio || '');
    setUf((alvo?.uf || '').toUpperCase());
    setFindings([]); setInstrumentos([]); setRadarMsg(''); setMedMsg('');
  }, [open, alvo]);

  const buscarNoSite = async () => {
    if (!alvo?.clientCctId) {
      setRadarMsg('Esta CCT não está vinculada a um cliente — a varredura web do Radar usa o vínculo. Use a busca no Mediador ao lado.');
      return;
    }
    setLoadingRadar(true); setRadarMsg('');
    const { data, error } = await supabase.functions.invoke('cct-radar-scan', {
      body: { client_cct_id: alvo.clientCctId, notify: false },
    });
    setLoadingRadar(false);
    if (error) { toast.error(error.message || 'Falha na busca.'); return; }
    const novos = ((data as any)?.novos || []) as Finding[];
    setFindings(novos);
    setRadarMsg(novos.length ? `${novos.length} evidência(s) encontrada(s).` : 'Nenhuma evidência nova encontrada nas fontes web/oficiais.');
  };

  const buscarNoMediador = async () => {
    if (!uf) { toast.error('Informe a UF.'); return; }
    setLoadingMed(true); setMedMsg('');
    const { data, error } = await supabase.functions.invoke('cct-mediador-instrumento', {
      body: { sindicato: alvo?.sindicato || '', uf, municipio, apenasVigentes: true },
    });
    setLoadingMed(false);
    if (error) { toast.error(error.message || 'Falha no Mediador.'); return; }
    setInstrumentos(((data as any)?.instrumentos || []) as Instrumento[]);
    setMedMsg((data as any)?.observacoes || '');
  };

  const importar = async (i: Instrumento) => {
    setImportando(i.numero_solicitacao);
    const { data, error } = await supabase.functions.invoke('cct-mediador-importar', {
      body: {
        numero_solicitacao: i.numero_solicitacao,
        titulo: i.titulo,
        tipo: i.tipo,
        numero_registro: i.numero_registro,
        vigencia: i.vigencia,
        partes: i.partes,
        url: i.url,
        url_download: i.url_download,
      },
    });
    setImportando(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || 'Falha ao importar.'); return; }
    toast.success('Instrumento enviado para a Gestão de CCT.');
    onOpenChange(false);
    if ((data as any)?.id) nav(`/gestao-cct/${(data as any).id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar nova CCT</DialogTitle>
          <DialogDescription>
            {alvo?.sindicato || 'Sindicato não informado'}
            {alvo?.vigenciaFim ? ` · vigência atual até ${new Date(alvo.vigenciaFim).toLocaleDateString('pt-BR')}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Município (base territorial)</label>
            <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Ex.: Bragança Paulista" />
          </div>
          <div className="w-20">
            <label className="text-xs text-muted-foreground">UF</label>
            <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} />
          </div>
          <Button variant="outline" onClick={buscarNoSite} disabled={loadingRadar}>
            {loadingRadar ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Buscar na web
          </Button>
          <Button onClick={buscarNoMediador} disabled={loadingMed}>
            {loadingMed ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Buscar no Mediador
          </Button>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Evidências web / fontes oficiais</div>
          {radarMsg && <p className="text-xs text-muted-foreground">{radarMsg}</p>}
          {findings.map((f) => (
            <div key={f.id} className="border rounded p-2 text-sm flex items-start gap-2">
              <Badge variant={f.source_type === 'oficial' ? 'default' : 'secondary'}>{f.source_type === 'oficial' ? 'Oficial' : 'Não oficial'}</Badge>
              <div className="flex-1">
                <div className="font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.source_name} · confiança {f.confidence ?? '—'}</div>
              </div>
              <a href={f.source_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="w-4 h-4" /></Button></a>
            </div>
          ))}
          {findings.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); nav('/gestao-cct/radar'); }}>Abrir no Radar de CCT</Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Sistema Mediador (MTE)</div>
          {medMsg && <p className="text-xs text-muted-foreground">{medMsg}</p>}
          {instrumentos.map((i) => (
            <div key={i.numero_solicitacao} className="border rounded p-2 text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={i.vigente ? 'default' : 'secondary'}>{i.vigente ? 'Vigente' : 'Encerrada'}</Badge>
                <span className="font-medium">{i.tipo}</span>
                <span className="text-xs text-muted-foreground">{i.numero_registro || i.numero_solicitacao} · {i.vigencia}</span>
              </div>
              {i.partes?.length > 0 && <div className="text-xs text-muted-foreground">{i.partes.slice(0, 3).join(' | ')}</div>}
              <div className="flex gap-2">
                <a href={i.url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="w-4 h-4 mr-1" />Ver</Button></a>
                <a href={i.url_download} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Download className="w-4 h-4 mr-1" />Baixar</Button></a>
                <Button size="sm" variant="outline" onClick={() => importar(i)} disabled={importando === i.numero_solicitacao}>
                  {importando === i.numero_solicitacao ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Enviar para Gestão de CCT
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
