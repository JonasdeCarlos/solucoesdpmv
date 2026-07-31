import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Radar, Mail, Loader2, Check, X, ExternalLink, ShieldCheck, AlertTriangle, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface RadarSettings {
  id?: string;
  emails: string[];
  alert_days_before: number;
  auto_search_enabled: boolean;
  search_frequency_days: number;
  last_run_at?: string | null;
}

interface Finding {
  id: string;
  client_cct_id: string | null;
  finding_type: string;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  title: string | null;
  numero_registro_mte: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  cnpjs: any;
  evidence: any;
  confidence: number | null;
  ai_notes: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
}

export default function CctRadarPage() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<RadarSettings>({ emails: [], alert_days_before: 60, auto_search_enabled: true, search_frequency_days: 7 });
  const [novoEmail, setNovoEmail] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filtro, setFiltro] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'todos'>('pendente');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from('cct_radar_settings' as any).select('*').limit(1),
      supabase.from('cct_radar_findings' as any).select('*').order('created_at', { ascending: false }),
    ]);
    if (s && (s as any[]).length) setCfg((s as any[])[0]);
    setFindings(((f || []) as any) as Finding[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvarCfg = async (patch: Partial<RadarSettings>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    const payload = {
      emails: next.emails,
      alert_days_before: next.alert_days_before,
      auto_search_enabled: next.auto_search_enabled,
      search_frequency_days: next.search_frequency_days,
    };
    if (cfg.id) {
      const { error } = await supabase.from('cct_radar_settings' as any).update(payload as any).eq('id', cfg.id);
      if (error) return toast.error('Falha ao salvar configuração.');
    } else {
      const { data, error } = await supabase.from('cct_radar_settings' as any).insert(payload as any).select('*').single();
      if (error) return toast.error('Falha ao salvar configuração.');
      setCfg({ ...next, id: (data as any).id });
    }
    toast.success('Configuração salva.');
  };

  const addEmail = () => {
    const e = novoEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast.error('E-mail inválido.');
    if (cfg.emails.includes(e)) return toast.error('E-mail já cadastrado.');
    setNovoEmail('');
    salvarCfg({ emails: [...cfg.emails, e] });
  };

  const rodarRadar = async () => {
    setScanning(true);
    const { data, error } = await supabase.functions.invoke('cct-radar-scan', { body: { notify: true } });
    setScanning(false);
    if (error) return toast.error('Falha ao executar o radar.');
    const d = data as any;
    toast.success(`Radar concluído: ${d?.verificadas ?? 0} CCT(s) verificada(s), ${d?.novos ?? 0} achado(s).`);
    if (d?.novos > 0 && d?.email?.enviado === false && d?.email?.motivo === 'sem_resend_key') {
      toast.warning('E-mails não enviados: canal de e-mail (Resend) ainda não configurado.');
    }
    await load();
  };

  const revisar = async (id: string, status: 'aprovado' | 'rejeitado') => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('cct_radar_findings' as any).update({
      status, reviewed_at: new Date().toISOString(), reviewed_by: u?.user?.id ?? null,
    } as any).eq('id', id);
    if (error) return toast.error('Falha ao registrar a decisão.');
    toast.success(status === 'aprovado' ? 'Achado aprovado.' : 'Achado rejeitado.');
    await load();
  };

  const lista = useMemo(
    () => findings.filter((f) => filtro === 'todos' || f.status === filtro),
    [findings, filtro],
  );

  const pendentes = findings.filter((f) => f.status === 'pendente').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Radar className="w-6 h-6 text-primary" />Radar de CCT</h2>
          <p className="text-sm text-muted-foreground">Busca automatizada de novas convenções e termos aditivos, com evidências e aprovação humana.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav('/gestao-cct')}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
          <Button onClick={rodarRadar} disabled={scanning}>
            {scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Radar className="w-4 h-4 mr-1" />}
            Rodar radar agora
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />E-mails do Departamento Pessoal</div>
          <div className="flex flex-wrap gap-2">
            {cfg.emails.length === 0 && <span className="text-sm text-muted-foreground">Nenhum e-mail cadastrado.</span>}
            {cfg.emails.map((e) => (
              <Badge key={e} variant="secondary" className="gap-1">
                {e}
                <button onClick={() => salvarCfg({ emails: cfg.emails.filter((x) => x !== e) })} aria-label={`Remover ${e}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input placeholder="dp@empresa.com.br" value={novoEmail} onChange={(ev) => setNovoEmail(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && addEmail()} />
            <Button variant="outline" onClick={addEmail}><Plus className="w-4 h-4" /></Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Alertar com antecedência (dias)</Label>
              <Input type="number" value={cfg.alert_days_before} onChange={(e) => setCfg({ ...cfg, alert_days_before: Number(e.target.value) })} onBlur={() => salvarCfg({})} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frequência da busca (dias)</Label>
              <Input type="number" value={cfg.search_frequency_days} onChange={(e) => setCfg({ ...cfg, search_frequency_days: Number(e.target.value) })} onBlur={() => salvarCfg({})} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={cfg.auto_search_enabled} onCheckedChange={(v) => salvarCfg({ auto_search_enabled: v })} />
              <Label className="text-xs">Busca automática ativa</Label>
            </div>
          </div>
          {cfg.last_run_at && <p className="text-xs text-muted-foreground">Última varredura: {new Date(cfg.last_run_at).toLocaleString('pt-BR')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold">Achados do radar <Badge variant="secondary">{pendentes} pendente(s)</Badge></div>
            <div className="flex gap-1">
              {(['pendente', 'aprovado', 'rejeitado', 'todos'] as const).map((f) => (
                <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} onClick={() => setFiltro(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum achado nesta situação. Rode o radar para varrer as CCTs vencidas ou próximas do vencimento.</p>
          ) : (
            <div className="space-y-3">
              {lista.map((f) => (
                <div key={f.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={f.finding_type === 'termo_aditivo' ? 'outline' : 'default'}>
                      {f.finding_type === 'termo_aditivo' ? 'Termo aditivo' : 'Nova CCT'}
                    </Badge>
                    {f.source_type === 'oficial' ? (
                      <Badge className="gap-1"><ShieldCheck className="w-3 h-3" />Fonte oficial</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Fonte não oficial — conferir</Badge>
                    )}
                    {f.confidence != null && <Badge variant="secondary">Confiança {Math.round(Number(f.confidence) * 100)}%</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div className="font-medium text-sm">{f.title || 'Sem título'}</div>
                  <div className="text-xs text-muted-foreground grid gap-1 sm:grid-cols-2">
                    {f.source_name && <span>Origem: {f.source_name}</span>}
                    {f.numero_registro_mte && <span>Registro MTE: {f.numero_registro_mte}</span>}
                    {(f.vigencia_inicio || f.vigencia_fim) && (
                      <span>Vigência: {f.vigencia_inicio || '—'} a {f.vigencia_fim || '—'}</span>
                    )}
                    {Array.isArray(f.cnpjs) && f.cnpjs.length > 0 && <span>CNPJs: {(f.cnpjs as string[]).join(', ')}</span>}
                  </div>

                  {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                    <div className="rounded bg-muted/50 p-2 space-y-1">
                      <div className="text-xs font-semibold">Evidências</div>
                      {(f.evidence as any[]).map((e, i) => (
                        <p key={i} className="text-xs text-muted-foreground">“{e.trecho}”</p>
                      ))}
                    </div>
                  )}
                  {f.ai_notes && <p className="text-xs text-muted-foreground">{f.ai_notes}</p>}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {f.source_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={f.source_url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />Abrir fonte</a>
                      </Button>
                    )}
                    {f.status === 'pendente' ? (
                      <>
                        <Button size="sm" onClick={() => revisar(f.id, 'aprovado')}><Check className="w-4 h-4 mr-1" />Aprovar</Button>
                        <Button size="sm" variant="destructive" onClick={() => revisar(f.id, 'rejeitado')}><X className="w-4 h-4 mr-1" />Rejeitar</Button>
                      </>
                    ) : (
                      <Badge variant={f.status === 'aprovado' ? 'default' : 'secondary'}>{f.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}</Badge>
                    )}
                    {f.status === 'aprovado' && (
                      <Button size="sm" variant="outline" onClick={() => nav('/gestao-cct/nova')}>Cadastrar CCT</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
