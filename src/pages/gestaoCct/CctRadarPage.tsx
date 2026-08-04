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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Radar, Mail, Loader2, Check, X, ExternalLink, ShieldCheck, AlertTriangle, Plus, Trash2, ArrowLeft, MessageCircle, GitCompareArrows, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';

interface FonteCct {
  id: string;
  ids?: string[];
  clientes?: number;
  sindicato: string | null;
  uf: string | null;
  validity_end: string | null;
  radar_site_oficial: string | null;
  radar_cnpjs: string[] | null;
  radar_termos: string[] | null;
  radar_mediador_registro: string | null;
  radar_enabled: boolean | null;
}

interface RadarSettings {
  id?: string;
  emails: string[];
  whatsapp_numeros: string[];
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
  const [cfg, setCfg] = useState<RadarSettings>({ emails: [], whatsapp_numeros: [], alert_days_before: 60, auto_search_enabled: true, search_frequency_days: 7 });
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fontes, setFontes] = useState<FonteCct[]>([]);
  const [salvandoFonte, setSalvandoFonte] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [filtro, setFiltro] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'todos'>('pendente');
  const [analises, setAnalises] = useState<any[]>([]);
  const [mapaCctAnalise, setMapaCctAnalise] = useState<Record<string, string>>({});
  const [derivacao, setDerivacao] = useState<{ finding: Finding; base: string; texto: string } | null>(null);
  const [derivando, setDerivando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: f }, { data: cc }, { data: an }, { data: vinc }] = await Promise.all([
      supabase.from('cct_radar_settings' as any).select('*').limit(1),
      supabase.from('cct_radar_findings' as any).select('*').order('created_at', { ascending: false }),
      supabase
        .from('client_ccts' as any)
        .select('id, sindicato, uf, validity_end, radar_site_oficial, radar_cnpjs, radar_termos, radar_mediador_registro, radar_enabled')
        .is('deleted_at', null)
        .order('validity_end', { ascending: true }),
      supabase.from('cct_analyses' as any).select('id, title, created_at').order('created_at', { ascending: false }),
      supabase.from('client_ccts' as any).select('id, cct_analysis_id').not('cct_analysis_id', 'is', null),
    ]);
    if (s && (s as any[]).length) {
      const row = (s as any[])[0];
      setCfg({ ...row, emails: row.emails || [], whatsapp_numeros: row.whatsapp_numeros || [] });
    }
    setFindings(((f || []) as any) as Finding[]);
    setAnalises(((an || []) as any[]));
    const mapa2: Record<string, string> = {};
    for (const r of ((vinc || []) as any[])) if (r.cct_analysis_id) mapa2[r.id] = r.cct_analysis_id;
    setMapaCctAnalise(mapa2);
    // A mesma CCT é cadastrada por cliente: agrupa para não repetir na lista do radar.
    const brutos = ((cc || []) as any) as FonteCct[];
    const mapa = new Map<string, FonteCct>();
    for (const r of brutos) {
      const chave = [
        (r.sindicato || '').trim().toUpperCase(),
        (r.uf || '').trim().toUpperCase(),
        r.validity_end || '',
      ].join('|');
      const atual = mapa.get(chave);
      if (!atual) {
        mapa.set(chave, { ...r, ids: [r.id], clientes: 1 });
      } else {
        atual.ids = [...(atual.ids || []), r.id];
        atual.clientes = (atual.clientes || 1) + 1;
        atual.radar_site_oficial = atual.radar_site_oficial || r.radar_site_oficial;
        atual.radar_mediador_registro = atual.radar_mediador_registro || r.radar_mediador_registro;
        atual.radar_cnpjs = (atual.radar_cnpjs?.length ? atual.radar_cnpjs : r.radar_cnpjs) || [];
        atual.radar_termos = (atual.radar_termos?.length ? atual.radar_termos : r.radar_termos) || [];
      }
    }
    setFontes(Array.from(mapa.values()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvarCfg = async (patch: Partial<RadarSettings>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    const payload = {
      emails: next.emails,
      whatsapp_numeros: next.whatsapp_numeros,
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

  const addNumero = () => {
    const n = novoNumero.replace(/\D/g, '');
    if (n.length < 10) return toast.error('Informe o número com DDD (ex.: 35988395876).');
    if (cfg.whatsapp_numeros.includes(n)) return toast.error('Número já cadastrado.');
    setNovoNumero('');
    salvarCfg({ whatsapp_numeros: [...cfg.whatsapp_numeros, n] });
  };

  const rodarRadar = async () => {
    setScanning(true);
    const { data, error } = await supabase.functions.invoke('cct-radar-scan', { body: { notify: true } });
    setScanning(false);
    if (error) return toast.error('Falha ao executar o radar.');
    const d = data as any;
    toast.success(`Radar concluído: ${d?.verificadas ?? 0} CCT(s) verificada(s), ${d?.novos ?? 0} achado(s).`);
    if (d?.novos > 0 && d?.whatsapp?.enviado === false) {
      toast.warning(
        d?.whatsapp?.motivo === 'sem_numeros'
          ? 'Nenhum número de WhatsApp cadastrado para aviso do DP.'
          : 'Falha ao enviar o aviso por WhatsApp (Digisac).',
      );
    }
    await load();
  };

  const preencherFontesAutomaticamente = async () => {
    setAutofillLoading(true);
    const { data, error } = await supabase.functions.invoke('cct-radar-autofill', { body: {} });
    setAutofillLoading(false);
    if (error) return toast.error('Falha ao preencher fontes automaticamente.');
    const d = data as any;
    if (d?.error) return toast.error(String(d.error));
    const semSite = d?.sem_site ?? 0;
    toast.success(`${d?.atualizados ?? 0} CCT(s) preenchidas.`, {
      description: semSite
        ? `${semSite} sem site oficial identificado — informe manualmente se souber.`
        : 'CNPJs, registro no Mediador, site oficial e termos de busca atualizados.',
    });
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

  const patchFonte = (id: string, patch: Partial<FonteCct>) =>
    setFontes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const salvarFonte = async (f: FonteCct) => {
    setSalvandoFonte(f.id);
    const { error } = await supabase.from('client_ccts' as any).update({
      radar_site_oficial: f.radar_site_oficial || null,
      radar_cnpjs: f.radar_cnpjs || [],
      radar_termos: f.radar_termos || [],
      radar_mediador_registro: f.radar_mediador_registro || null,
      radar_enabled: f.radar_enabled !== false,
    } as any).in('id', f.ids?.length ? f.ids : [f.id]);
    setSalvandoFonte(null);
    if (error) return toast.error('Falha ao salvar as fontes desta CCT.');
    toast.success('Fontes de busca salvas.');
  };

  const toList = (v: string) => v.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);

  const ehDocumentoCompleto = (f: Finding) =>
    f.finding_type === 'nova_cct' && f.source_type === 'oficial';

  const abrirDerivacao = (f: Finding) =>
    setDerivacao({ finding: f, base: (f.client_cct_id && mapaCctAnalise[f.client_cct_id]) || '', texto: '' });

  const gerarDerivada = async () => {
    if (!derivacao) return;
    if (!derivacao.base) return toast.error('Selecione a CCT vigente que será atualizada.');
    setDerivando(true);
    const { data, error } = await supabase.functions.invoke('cct-derivar', {
      body: { base_analysis_id: derivacao.base, finding_id: derivacao.finding.id, texto_alteracao: derivacao.texto || null },
    });
    setDerivando(false);
    if (error) return toast.error('Falha ao gerar a CCT consolidada.');
    if ((data as any)?.error) return toast.error(String((data as any).error));
    const novaId = (data as any).analysis_id;
    setDerivacao(null);
    toast.success('Nova CCT gerada com os pontos alterados. Revise antes de aprovar.');
    nav(`/gestao-cct/comparar?anterior=${derivacao.base}&nova=${novaId}`);
  };

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
          <div className="font-semibold flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" />WhatsApp do Departamento Pessoal (Digisac)</div>
          <p className="text-xs text-muted-foreground">Ao encontrar novidades, o radar envia o resumo dos achados por WhatsApp para estes números.</p>
          <div className="flex flex-wrap gap-2">
            {cfg.whatsapp_numeros.length === 0 && <span className="text-sm text-muted-foreground">Nenhum número cadastrado.</span>}
            {cfg.whatsapp_numeros.map((n) => (
              <Badge key={n} variant="secondary" className="gap-1">
                {n}
                <button onClick={() => salvarCfg({ whatsapp_numeros: cfg.whatsapp_numeros.filter((x) => x !== n) })} aria-label={`Remover ${n}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input placeholder="35988395876" value={novoNumero} onChange={(ev) => setNovoNumero(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && addNumero()} />
            <Button variant="outline" onClick={addNumero}><Plus className="w-4 h-4" /></Button>
          </div>

          <div className="font-semibold flex items-center gap-2 pt-2"><Mail className="w-4 h-4 text-primary" />E-mails do Departamento Pessoal (opcional)</div>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Fontes de busca por CCT</div>
            <Button variant="outline" size="sm" onClick={preencherFontesAutomaticamente} disabled={autofillLoading || fontes.length === 0}>
              {autofillLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Radar className="w-4 h-4 mr-1" />}
              Preencher automaticamente das CCTs
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O radar monta a busca a partir destes dados: o site oficial do sindicato é lido diretamente, os CNPJs participantes
            e os termos livres viram consultas na web, e o nº de registro no Mediador serve de referência para a IA comparar
            se o instrumento encontrado é realmente novo. Sem preencher nada, o radar usa o nome do sindicato + UF + ano como
            termo padrão. Clique no botão acima para tentar extrair CNPJs, site e registro do MTE diretamente da CCT enviada.
          </p>
          {fontes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma CCT cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {fontes.map((f) => (
                <div key={f.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{f.sindicato || 'Sem sindicato'}</span>
                    {f.uf && <Badge variant="secondary">{f.uf}</Badge>}
                    {f.validity_end && <Badge variant="outline">Vigência até {f.validity_end}</Badge>}
                    {(f.clientes || 1) > 1 && <Badge variant="outline">{f.clientes} clientes</Badge>}
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch checked={f.radar_enabled !== false} onCheckedChange={(v) => patchFonte(f.id, { radar_enabled: v })} />
                      <Label className="text-xs">Monitorar</Label>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Site oficial do sindicato</Label>
                      <Input
                        placeholder="https://sindicato.org.br"
                        value={f.radar_site_oficial || ''}
                        onChange={(e) => patchFonte(f.id, { radar_site_oficial: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Preenchido apenas se constar na CCT enviada; caso contrário, informe manualmente.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nº de registro no Mediador (MTE)</Label>
                      <Input
                        placeholder="MG000123/2025"
                        value={f.radar_mediador_registro || ''}
                        onChange={(e) => patchFonte(f.id, { radar_mediador_registro: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CNPJs participantes (separe por vírgula)</Label>
                      <Input
                        placeholder="00.000.000/0001-00, 11.111.111/0001-11"
                        value={(f.radar_cnpjs || []).join(', ')}
                        onChange={(e) => patchFonte(f.id, { radar_cnpjs: toList(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Termos de busca (um por linha)</Label>
                      <Textarea
                        rows={2}
                        placeholder={'"SINDICATO X" convenção coletiva 2026 vigência'}
                        value={(f.radar_termos || []).join('\n')}
                        onChange={(e) => patchFonte(f.id, { radar_termos: toList(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => salvarFonte(f)} disabled={salvandoFonte === f.id}>
                    {salvandoFonte === f.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Salvar fontes
                  </Button>
                </div>
              ))}
            </div>
          )}
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
