import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Plus, FileDown, Trash2, ChevronLeft, Loader2, Save, Check, Paperclip, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuditorias, useAuditoriaDetail } from '@/hooks/useAuditoria';
import { generateAuditoriaPdf } from '@/utils/sucessoCliente/auditoriaPdf';
import { DebouncedInput, DebouncedTextarea } from '@/components/sucessoCliente/DebouncedField';

const STATUS = [
  { v: 'pendente', l: 'Pendente' },
  { v: 'conforme', l: 'Conforme' },
  { v: 'nao_conforme', l: 'Não Conforme' },
  { v: 'nao_aplicavel', l: 'Não Aplicável' },
];
const PRIO = [{ v:'alta',l:'Alta' },{ v:'media',l:'Média' },{ v:'baixa',l:'Baixa' }];
const PSTAT = [{ v:'nao_iniciado',l:'Não iniciado' },{ v:'em_andamento',l:'Em andamento' },{ v:'concluido',l:'Concluído' }];

function TopicoCard({ it, updateItem, deleteItem }: { it: any; updateItem: (id: string, patch: any) => Promise<any>; deleteItem: (id: string) => Promise<any> }) {
  const draftKey = `auditoria-item-draft:${it.id}`;
  const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); }
    catch { return null; }
  };
  const draft = readDraft();
  const [resp, setResp] = useState(draft?.responsavel_empresa ?? it.responsavel_empresa ?? '');
  const [docs, setDocs] = useState(draft?.documentos ?? it.documentos ?? '');
  const [obs, setObs] = useState(draft?.observacoes ?? it.observacoes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty =
    resp !== (it.responsavel_empresa || '') ||
    docs !== (it.documentos || '') ||
    obs !== (it.observacoes || '');

  const salvar = async () => {
    setSaving(true);
    try {
      await updateItem(it.id, { responsavel_empresa: resp, documentos: docs, observacoes: obs });
      try { localStorage.removeItem(draftKey); } catch { /* noop */ }
      setSaved(true);
      toast.success('Tópico salvo.');
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    try {
      if (!dirty) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ responsavel_empresa: resp, documentos: docs, observacoes: obs }));
    } catch { /* noop */ }
  }, [dirty, docs, draftKey, obs, resp]);

  return (
    <Card className="border-l-4" style={{ borderLeftColor: it.status === 'conforme' ? '#16a34a' : it.status === 'nao_conforme' ? '#dc2626' : it.status === 'nao_aplicavel' ? '#94a3b8' : '#f59e0b' }}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm flex-1">{it.titulo}</div>
          <Button size="icon" variant="ghost" className="h-7 w-7 -mt-1 -mr-1" onClick={() => { if (confirm(`Excluir o tópico "${it.titulo}"?`)) deleteItem(it.id); }}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        {it.descricao && <div className="text-xs text-muted-foreground">{it.descricao}</div>}
        {it.acao && <div className="text-xs"><span className="font-semibold">Ação:</span> {it.acao}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><Label className="text-xs">Status</Label>
            <Select value={it.status} onValueChange={(v) => updateItem(it.id, { status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Responsável (empresa)</Label><Input value={resp} onChange={e => setResp(e.target.value)} /></div>
          <div><Label className="text-xs">Documentos analisados</Label><Input value={docs} onChange={e => setDocs(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">Observações / evidências</Label><Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} /></div>
        <div className="flex justify-end">
          <Button size="sm" onClick={salvar} disabled={saving || !dirty} variant={saved ? 'secondary' : 'default'}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : saved ? <Check className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {saved ? 'Salvo' : 'Salvar tópico'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuditoriaTab({ client_id, cliente }: { client_id: string; cliente: any }) {
  const { items, loading, create, remove } = useAuditorias(client_id);
  const selectedStorageKey = `auditoria:${client_id}:selected`;
  const draftStorageKey = `auditoria:${client_id}:nova-draft`;
  const [selected, setSelectedState] = useState<string | null>(() => {
    try { return localStorage.getItem(selectedStorageKey); }
    catch { return null; }
  });
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>(() => {
    const fallback = { empresa_nome: cliente?.nome || '', cnpj: cliente?.cnpj || '', responsavel: '', consultor: '', data_inicio: new Date().toISOString().slice(0,10), objetivo: '' };
    try { return { ...fallback, ...(JSON.parse(localStorage.getItem(draftStorageKey) || 'null') || {}) }; }
    catch { return fallback; }
  });
  const [gen, setGen] = useState(false);

  const handleCreate = async () => {
    if (!draft.empresa_nome) return toast.error('Informe a empresa.');
    setCreating(true);
    const { data, error } = await create(draft);
    setCreating(false);
    if (error) return toast.error('Erro: '+error.message);
    try { localStorage.removeItem(draftStorageKey); } catch { /* noop */ }
    setSelected((data as any)?.id || null);
    toast.success('Auditoria criada.');
  };

  const setSelected = (id: string | null) => {
    setSelectedState(id);
    try {
      if (id) localStorage.setItem(selectedStorageKey, id);
      else localStorage.removeItem(selectedStorageKey);
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (!loading && selected && items.length > 0 && !items.some((a: any) => a.id === selected)) setSelected(null);
  }, [items, loading, selected]);

  useEffect(() => {
    try { localStorage.setItem(draftStorageKey, JSON.stringify(draft)); }
    catch { /* noop */ }
  }, [draft, draftStorageKey]);

  if (selected) {
    return <AuditoriaDetail id={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nova auditoria</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><Label className="text-xs">Empresa</Label><Input value={draft.empresa_nome} onChange={e=>setDraft({...draft,empresa_nome:e.target.value})}/></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={draft.cnpj} onChange={e=>setDraft({...draft,cnpj:e.target.value})}/></div>
          <div><Label className="text-xs">Responsável (empresa)</Label><Input value={draft.responsavel} onChange={e=>setDraft({...draft,responsavel:e.target.value})}/></div>
          <div><Label className="text-xs">Consultor</Label><Input value={draft.consultor} onChange={e=>setDraft({...draft,consultor:e.target.value})}/></div>
          <div><Label className="text-xs">Data de início</Label><Input type="date" value={draft.data_inicio} onChange={e=>setDraft({...draft,data_inicio:e.target.value})}/></div>
          <div className="md:col-span-3"><Label className="text-xs">Objetivo</Label><Textarea rows={2} value={draft.objetivo} onChange={e=>setDraft({...draft,objetivo:e.target.value})}/></div>
          <div className="md:col-span-3 flex justify-end"><Button onClick={handleCreate} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}<Plus className="w-4 h-4 mr-1"/>Criar auditoria</Button></div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Auditorias cadastradas</h3>
        {items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">Nenhuma auditoria.</p> :
          items.map((a: any) => (
            <Card key={a.id}><CardContent className="p-3 flex items-center justify-between">
              <div className="cursor-pointer flex-1" onClick={()=>setSelected(a.id)}>
                <div className="font-medium">{a.empresa_nome}</div>
                <div className="text-xs text-muted-foreground">Início: {a.data_inicio ? new Date(a.data_inicio).toLocaleDateString('pt-BR'):'—'} • Consultor: {a.consultor||'—'} <Badge variant="outline" className="ml-2">{a.status}</Badge></div>
              </div>
              <Button size="icon" variant="ghost" onClick={()=>{ if(confirm('Excluir auditoria?')) remove(a.id); }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
            </CardContent></Card>
          ))
        }
      </div>
    </div>
  );
}

function AuditoriaDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { auditoria, itens, acoes, acaoFiles, insertItens, updateItem, deleteItem, updateAuditoria, upsertAcao, deleteAcao, addAcaoFile, removeAcaoFile, getAcaoFileUrl } = useAuditoriaDetail(id);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const sugestaoStorageKey = `auditoria:${id}:sugestao-draft`;
  const sugestaoDraft = (() => {
    try { return JSON.parse(localStorage.getItem(sugestaoStorageKey) || 'null') || {}; }
    catch { return {}; }
  })();
  const [sugArea, setSugArea] = useState(sugestaoDraft.area || '');
  const [sugTitulo, setSugTitulo] = useState(sugestaoDraft.titulo || '');
  const [sugDescricao, setSugDescricao] = useState(sugestaoDraft.descricao || '');
  const [sugIa, setSugIa] = useState(false);

  const areas = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const i of itens) { if (!map.has(i.area)) map.set(i.area, []); map.get(i.area)!.push(i); }
    return Array.from(map.entries());
  }, [itens]);

  const sugerirTema = async () => {
    const titulo = sugTitulo.trim();
    const area = (sugArea.trim() || 'Tema sugerido');
    if (!titulo) { toast.error('Informe o tema/título.'); return; }
    setSugIa(true);
    try {
      let descricao = sugDescricao.trim();
      let acao = '';
      try {
        const { data } = await supabase.functions.invoke('auditoria-gerar-roteiro', {
          body: {
            empresa: auditoria.empresa_nome,
            cnpj: auditoria.cnpj,
            objetivo: `Detalhar APENAS o tema solicitado: "${titulo}" (área: ${area}). Retorne 1 área com 1 item somente.`,
          },
        });
        const it = data?.areas?.[0]?.itens?.[0];
        if (it) {
          if (!descricao) descricao = it.descricao || '';
          acao = it.acao || '';
        }
      } catch { /* segue sem IA */ }
      const lista = itens.filter(i => i.area === area);
      const area_ordem = areas.findIndex(([a]) => a === area);
      await insertItens([{
        area,
        area_ordem: area_ordem >= 0 ? area_ordem : areas.length,
        item_ordem: lista.length,
        titulo,
        descricao,
        acao,
        status: 'pendente',
      }]);
      setSugArea(''); setSugTitulo(''); setSugDescricao('');
      try { localStorage.removeItem(sugestaoStorageKey); } catch { /* noop */ }
      toast.success('Tema adicionado à auditoria.');
    } catch (e: any) {
      toast.error('Falha ao adicionar tema: ' + e.message);
    } finally { setSugIa(false); }
  };

  useEffect(() => {
    try {
      if (!sugArea && !sugTitulo && !sugDescricao) localStorage.removeItem(sugestaoStorageKey);
      else localStorage.setItem(sugestaoStorageKey, JSON.stringify({ area: sugArea, titulo: sugTitulo, descricao: sugDescricao }));
    } catch { /* noop */ }
  }, [sugArea, sugDescricao, sugTitulo, sugestaoStorageKey]);

  const progresso = useMemo(() => {
    if (!itens.length) return 0;
    return Math.round(itens.filter(i => i.status !== 'pendente').length / itens.length * 100);
  }, [itens]);

  const gerarRoteiro = async () => {
    if (itens.length && !confirm('Já existem itens. Deseja gerar e adicionar novos?')) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('auditoria-gerar-roteiro', {
        body: { empresa: auditoria.empresa_nome, cnpj: auditoria.cnpj, objetivo: auditoria.objetivo },
      });
      if (error) throw error;
      const rows: any[] = [];
      (data?.areas || []).forEach((ar: any, ai: number) => {
        (ar.itens || []).forEach((it: any, ii: number) => {
          rows.push({ area: ar.nome, area_ordem: ai, item_ordem: ii, titulo: it.titulo, descricao: it.descricao, acao: it.acao, status: 'pendente' });
        });
      });
      await insertItens(rows);
      toast.success(`${rows.length} itens gerados.`);
    } catch (e: any) {
      toast.error('Falha ao gerar roteiro: '+e.message);
    } finally { setGenerating(false); }
  };

  const gerarPlanoAcao = async () => {
    const ncs = itens.filter(i => i.status === 'nao_conforme');
    if (!ncs.length) return toast.info('Nenhum item não-conforme.');
    setBusy('plano');
    try {
      const { data } = await supabase.functions.invoke('auditoria-acao-sugerir', {
        body: { itens: ncs.map(i => ({ item_id: i.id, area: i.area, titulo: i.titulo, observacoes: i.observacoes })) },
      });
      const sug: any[] = data?.acoes || [];
      for (const nc of ncs) {
        if (acoes.some(a => a.item_id === nc.id)) continue;
        const s = sug.find((x: any) => x.item_id === nc.id);
        await upsertAcao({
          item_id: nc.id,
          acao_corretiva: s?.acao_corretiva || `Corrigir: ${nc.titulo}`,
          prioridade: s?.prioridade || 'media',
          status: 'nao_iniciado',
        });
      }
      toast.success('Plano de ação atualizado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const exportPdf = async (tipo: 'diagnostico' | 'plano' | 'final') => {
    setBusy(tipo);
    try {
      let parecer: string | undefined;
      let resumoNarrativo: string | undefined;
      if (tipo === 'diagnostico' || tipo === 'final' || (tipo as any) === 'dossie') {
        const resumo = {
          total: itens.length,
          conformes: itens.filter(i=>i.status==='conforme').length,
          nao_conformes: itens.filter(i=>i.status==='nao_conforme').length,
        };
        const { data } = await supabase.functions.invoke('auditoria-parecer', {
          body: { empresa: auditoria.empresa_nome, resumo, itens: itens.map(i=>({titulo:i.titulo,area:i.area,status:i.status})), acoes, tipo: (tipo==='final'||(tipo as any)==='dossie')?'final':'diagnostico' },
        });
        if (tipo === 'final' || (tipo as any) === 'dossie') parecer = data?.texto;
        else resumoNarrativo = data?.texto;
      }
      await generateAuditoriaPdf({ tipo: tipo as any, auditoria, itens, acoes, acaoFiles, parecer, resumoNarrativo });
      toast.success('PDF gerado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  if (!auditoria) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
          <h3 className="text-lg font-bold">{auditoria.empresa_nome}</h3>
          <div className="text-xs text-muted-foreground">{auditoria.cnpj || ''} • Consultor: {auditoria.consultor||'—'}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={gerarRoteiro} disabled={generating}>{generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}{itens.length ? 'Gerar mais itens' : 'Gerar roteiro com IA'}</Button>
          <Button variant="outline" onClick={gerarPlanoAcao} disabled={busy==='plano'}>{busy==='plano' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}Gerar Plano de Ação</Button>
          <Select onValueChange={(v)=>exportPdf(v as any)}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="Exportar relatório PDF"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="diagnostico">Relatório Diagnóstico</SelectItem>
              <SelectItem value="plano">Plano de Ação</SelectItem>
              <SelectItem value="final">Relatório Final</SelectItem>
              <SelectItem value="dossie">Dossiê (PDF + Anexos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {busy && busy !== 'plano' && <p className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1"/>A IA está analisando...</p>}
      {generating && <p className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1"/>A IA está gerando o roteiro...</p>}

      <Card><CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1"><div className="text-xs text-muted-foreground">Progresso geral</div><Progress value={progresso}/></div>
        <div className="text-2xl font-bold">{progresso}%</div>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sugerir tema não contemplado</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <Label className="text-xs">Área</Label>
            <Input list="auditoria-areas" placeholder="Ex.: Jornada, Férias…" value={sugArea} onChange={e=>setSugArea(e.target.value)}/>
            <datalist id="auditoria-areas">
              {areas.map(([a]) => <option key={a} value={a}/>)}
            </datalist>
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Tema / Título</Label>
            <Input value={sugTitulo} onChange={e=>setSugTitulo(e.target.value)} placeholder="Ex.: Controle de banco de horas"/>
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={sugDescricao} onChange={e=>setSugDescricao(e.target.value)} placeholder="A IA complementa se vazio"/>
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={sugerirTema} disabled={sugIa} className="w-full">
              {sugIa ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {itens.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum item ainda. Clique em <strong>Gerar roteiro com IA</strong> para começar.
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {areas.map(([area, list]) => {
            const verif = list.filter((i: any) => i.status !== 'pendente').length;
            const pct = Math.round(verif / list.length * 100);
            return (
              <AccordionItem key={area} value={area} className="border rounded-md px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 mr-2">
                    <span className="font-medium">{area}</span>
                    <Badge variant="secondary">{verif}/{list.length}</Badge>
                    <Progress value={pct} className="flex-1 max-w-[200px]"/>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  {list.map((it: any) => (
                    <TopicoCard key={it.id} it={it} updateItem={updateItem} deleteItem={deleteItem}/>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Plano de Ação</CardTitle>
            <Button size="sm" variant="outline" onClick={() => upsertAcao({ titulo: 'Conclusão', acao_corretiva: '', prioridade: 'media', status: 'nao_iniciado' })}>
              <Plus className="w-4 h-4 mr-1"/>Adicionar ação manual
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {acoes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma ação. Use "Gerar Plano de Ação" ou "Adicionar ação manual".</p>
            )}
            {acoes.map(a => {
              const item = itens.find(i => i.id === a.item_id);
              const filesDaAcao = (acaoFiles || []).filter((f: any) => f.acao_id === a.id);
              return (
                <Card key={a.id}><CardContent className="p-3 space-y-2">
                  {item ? (
                    <div className="text-xs text-muted-foreground">{item.area} • {item.titulo}</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Tópico</Label>
                      <DebouncedInput value={a.titulo || 'Conclusão'} onCommit={(v)=>upsertAcao({...a, titulo: v})} placeholder="Conclusão"/>
                    </div>
                  )}
                  <DebouncedTextarea rows={2} value={a.acao_corretiva} onCommit={(v)=>upsertAcao({...a, acao_corretiva: v})}/>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div><Label className="text-xs">Responsável</Label><DebouncedInput value={a.responsavel||''} onCommit={(v)=>upsertAcao({...a, responsavel: v})}/></div>
                    <div><Label className="text-xs">Prazo</Label><DebouncedInput type="date" value={a.prazo||''} onCommit={(v)=>upsertAcao({...a, prazo: v})}/></div>
                    <div><Label className="text-xs">Prioridade</Label>
                      <Select value={a.prioridade} onValueChange={v=>upsertAcao({...a,prioridade:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PRIO.map(p=><SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div><Label className="text-xs">Status</Label>
                      <Select value={a.status} onValueChange={v=>upsertAcao({...a,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PSTAT.map(p=><SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="flex items-end"><Button size="icon" variant="ghost" onClick={()=>deleteAcao(a.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button></div>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs flex items-center gap-1"><Paperclip className="w-3 h-3"/>Documentos (PDF/Word)</Label>
                      <label className="cursor-pointer">
                        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = '';
                            for (const f of files) {
                              try { await addAcaoFile(a.id, f); }
                              catch (err: any) { toast.error('Falha no upload de ' + f.name + ': ' + err.message); }
                            }
                            if (files.length) toast.success('Documento(s) anexado(s).');
                          }}/>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent">
                          <Plus className="w-3 h-3"/> Anexar
                        </span>
                      </label>
                    </div>
                    {filesDaAcao.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filesDaAcao.map((f: any) => (
                          <li key={f.id} className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                            <button className="flex items-center gap-1 truncate hover:underline text-left flex-1"
                              onClick={async () => {
                                const url = await getAcaoFileUrl(f.id);
                                if (url) window.open(url, '_blank');
                              }}>
                              <FileText className="w-3 h-3 shrink-0"/>
                              <span className="truncate">{f.file_name}</span>
                            </button>
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => { if (confirm('Remover este documento?')) removeAcaoFile(f.id); }}>
                              <Trash2 className="w-3 h-3 text-destructive"/>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent></Card>
              );
            })}
          </CardContent>
      </Card>
    </div>
  );
}