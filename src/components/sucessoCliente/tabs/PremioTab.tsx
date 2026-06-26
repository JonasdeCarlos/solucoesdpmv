import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Wand2, Save, Pencil, X, Users, Upload, FileDown } from 'lucide-react';
import { usePrizePolicies, usePrizeCriteria, usePrizeEmployees, type PrizePolicy } from '@/hooks/usePrizePolicies';
import { useEmpregados } from '@/hooks/useEmpregados';
import { toast } from 'sonner';
import PremioAplicacaoSection from './PremioAplicacaoSection';
import { generatePremioPoliticaPdf } from '@/utils/sucessoCliente/premioPoliticaPdf';

const VERBA_PRESETS = ['Prêmio', 'Gratificação', 'Bonificação', 'Bônus', 'PLR', 'Adicional de Desempenho'];

export default function PremioTab({ client_id, cliente }: { client_id: string; cliente: any }) {
  const { items, create, update, remove } = usePrizePolicies(client_id);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    verba_label: 'Prêmio',
    verba_label_custom: '',
    nome: '',
    objetivo: '',
    periodo_tipo: 'mensal',
    valor_base: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  const handleCreate = async () => {
    const label = (newForm.verba_label === '__custom__' ? newForm.verba_label_custom : newForm.verba_label).trim();
    if (!label) { toast.error('Informe o nome da verba.'); return; }
    if (!newForm.nome.trim()) { toast.error('Informe o nome da política.'); return; }
    const { data, error } = await create({
      verba_label: label,
      nome: newForm.nome,
      objetivo: newForm.objetivo || null,
      periodo_tipo: newForm.periodo_tipo,
      valor_base: Number(newForm.valor_base || 0),
    });
    if (error) { toast.error('Erro ao criar política.'); return; }
    toast.success('Política criada.');
    setCreating(false);
    setNewForm({ verba_label: 'Prêmio', verba_label_custom: '', nome: '', objetivo: '', periodo_tipo: 'mensal', valor_base: 0 });
    if (data?.id) setSelectedId(data.id);
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Verba Variável — Prêmio, Gratificação, Bonificação…</h3>
            <p className="text-xs text-muted-foreground">Cadastre políticas com critérios objetivos para apuração e alinhamento com a equipe. O nome da verba é livre.</p>
          </div>
          {!creating && <Button size="sm" onClick={()=>setCreating(true)}><Plus className="w-3 h-3 mr-1"/>Nova política</Button>}
        </div>
      </CardContent></Card>

      {creating && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Nova política</h4>
            <Button size="sm" variant="ghost" onClick={()=>setCreating(false)}><X className="w-4 h-4"/></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome da verba *</Label>
              <Select value={newForm.verba_label} onValueChange={(v)=>setNewForm({...newForm, verba_label: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {VERBA_PRESETS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  <SelectItem value="__custom__">Outro (personalizado)…</SelectItem>
                </SelectContent>
              </Select>
              {newForm.verba_label === '__custom__' && (
                <Input className="mt-2" placeholder="Ex.: Incentivo de Produtividade" value={newForm.verba_label_custom} onChange={(e)=>setNewForm({...newForm, verba_label_custom: e.target.value})}/>
              )}
            </div>
            <div>
              <Label>Nome da política *</Label>
              <Input value={newForm.nome} onChange={(e)=>setNewForm({...newForm, nome: e.target.value})} placeholder="Ex.: Prêmio Atendimento — Salão"/>
            </div>
            <div>
              <Label>Periodicidade</Label>
              <Select value={newForm.periodo_tipo} onValueChange={(v)=>setNewForm({...newForm, periodo_tipo: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="bimestral">Bimestral</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor base (R$)</Label>
              <Input type="number" step="0.01" value={newForm.valor_base} onChange={(e)=>setNewForm({...newForm, valor_base: Number(e.target.value)})}/>
            </div>
            <div className="md:col-span-2">
              <Label>Objetivo (opcional)</Label>
              <Textarea rows={2} value={newForm.objetivo} onChange={(e)=>setNewForm({...newForm, objetivo: e.target.value})} placeholder="Ex.: estimular pontualidade e qualidade do atendimento ao cliente."/>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar política</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {items.length === 0 && !creating && <p className="text-sm text-muted-foreground">Nenhuma política cadastrada.</p>}
        {items.map(p => (
          <PolicyCard
            key={p.id}
            policy={p}
            cliente={cliente}
            expanded={selectedId === p.id}
            onToggle={()=>setSelectedId(selectedId === p.id ? null : p.id)}
            onUpdate={async (patch)=>{ const { error } = await update(p.id, patch); if (error) toast.error('Erro ao salvar.'); else toast.success('Atualizado.'); }}
            onRemove={async ()=>{ if (!confirm(`Excluir política "${p.nome}"?`)) return; const { error } = await remove(p.id); if (error) toast.error('Erro ao excluir.'); else { toast.success('Excluído.'); if (selectedId === p.id) setSelectedId(null); } }}
          />
        ))}
      </div>
    </div>
  );
}

function PolicyCard({ policy, expanded, onToggle, onUpdate, onRemove, cliente }: {
  policy: PrizePolicy; expanded: boolean; onToggle: () => void;
  onUpdate: (patch: Partial<PrizePolicy>) => Promise<void>;
  onRemove: () => Promise<void>; cliente: any;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    verba_label: policy.verba_label,
    nome: policy.nome,
    objetivo: policy.objetivo || '',
    periodo_tipo: policy.periodo_tipo,
    valor_base: policy.valor_base,
    status: policy.status,
  });

  const saveEdit = async () => {
    if (!form.verba_label.trim() || !form.nome.trim()) { toast.error('Nome da verba e da política são obrigatórios.'); return; }
    await onUpdate({
      verba_label: form.verba_label.trim(),
      nome: form.nome.trim(),
      objetivo: form.objetivo || null,
      periodo_tipo: form.periodo_tipo,
      valor_base: Number(form.valor_base || 0),
      status: form.status,
    });
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="cursor-pointer flex-1" onClick={onToggle}>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{policy.verba_label}</Badge>
              <span className="font-semibold">{policy.nome}</span>
              <Badge variant={policy.status === 'ativo' ? 'default' : 'secondary'}>{policy.status}</Badge>
              <span className="text-xs text-muted-foreground">{policy.periodo_tipo}</span>
              {policy.valor_base > 0 && <span className="text-xs text-muted-foreground">R$ {Number(policy.valor_base).toFixed(2)}</span>}
            </div>
            {policy.objetivo && <p className="text-xs text-muted-foreground mt-1">{policy.objetivo}</p>}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={()=>setEditing(e => !e)}><Pencil className="w-3 h-3"/></Button>
            <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="w-3 h-3"/></Button>
          </div>
        </div>

        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
            <div>
              <Label>Nome da verba</Label>
              <Input value={form.verba_label} onChange={(e)=>setForm({...form, verba_label: e.target.value})}/>
              <p className="text-[10px] text-muted-foreground mt-1">Ex.: Prêmio, Gratificação, Bonificação, PLR…</p>
            </div>
            <div><Label>Nome da política</Label><Input value={form.nome} onChange={(e)=>setForm({...form, nome: e.target.value})}/></div>
            <div>
              <Label>Periodicidade</Label>
              <Select value={form.periodo_tipo} onValueChange={(v)=>setForm({...form, periodo_tipo: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="bimestral">Bimestral</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor base (R$)</Label><Input type="number" step="0.01" value={form.valor_base} onChange={(e)=>setForm({...form, valor_base: Number(e.target.value)})}/></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Objetivo</Label><Textarea rows={2} value={form.objetivo} onChange={(e)=>setForm({...form, objetivo: e.target.value})}/></div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={()=>setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveEdit}><Save className="w-3 h-3 mr-1"/>Salvar</Button>
            </div>
          </div>
        )}

        {expanded && (
          <div className="border-t pt-3 space-y-4">
            <CriteriaSection policy={policy} cliente={cliente}/>
            <EmployeesSection policy={policy} cliente={cliente}/>
            <PremioAplicacaoSection policy={policy} cliente={cliente}/>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CriteriaSection({ policy, cliente }: { policy: PrizePolicy; cliente: any }) {
  const { items, create, createMany, update, remove, suggest } = usePrizeCriteria(policy.id);
  const { items: participantes } = usePrizeEmployees(policy.id);
  const [novo, setNovo] = useState({ nome: '', descricao: '', peso: 1, essencial: false });
  const [iaCtx, setIaCtx] = useState({ cargo: '', quantidade: 6 });
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    if (items.length === 0) { toast.error('Cadastre ao menos um critério antes de exportar.'); return; }
    setExporting(true);
    try {
      await generatePremioPoliticaPdf({
        empresa: cliente?.razao_social || cliente?.nome_fantasia || 'Empresa',
        cnpj: cliente?.cnpj || undefined,
        verba_label: policy.verba_label,
        politica_nome: policy.nome,
        objetivo: policy.objetivo,
        periodo_tipo: policy.periodo_tipo,
        valor_base: policy.valor_base,
        criterios: items.map(c => ({ nome: c.nome, descricao: c.descricao, peso: c.peso, essencial: c.essencial })),
        participantes: (participantes || []).filter(p => p.ativo).map(p => ({ nome: p.nome, cpf: p.cpf, cargo: p.cargo, matricula: p.matricula })),
      });
      toast.success('PDF gerado.');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    } finally {
      setExporting(false);
    }
  };

  const handleAdd = async () => {
    if (!novo.nome.trim()) { toast.error('Informe o nome do critério.'); return; }
    const { error } = await create({ ...novo, peso: Number(novo.peso || 1) });
    if (error) { toast.error('Erro.'); return; }
    setNovo({ nome: '', descricao: '', peso: 1, essencial: false });
  };

  const handleSuggest = async () => {
    setGenerating(true);
    const { criterios, error } = await suggest({
      setor: cliente?.segmento || undefined,
      cargo: iaCtx.cargo || undefined,
      objetivo: policy.objetivo || undefined,
      verba_label: policy.verba_label,
      quantidade: iaCtx.quantidade,
    });
    setGenerating(false);
    if (error || !criterios?.length) { toast.error('Falha ao sugerir critérios.'); return; }
    const { error: e2 } = await createMany(criterios.map(c => ({ ...c, origem: 'ia' as const })));
    if (e2) { toast.error('Erro ao salvar sugestões.'); return; }
    toast.success(`${criterios.length} critérios sugeridos pela IA.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold">Critérios de apuração — {policy.verba_label}</h4>
        <div className="flex gap-2 items-center flex-wrap">
          <Input placeholder="Cargo/função (contexto IA)" value={iaCtx.cargo} onChange={(e)=>setIaCtx({...iaCtx, cargo: e.target.value})} className="h-8 w-44"/>
          <Input type="number" min={3} max={12} value={iaCtx.quantidade} onChange={(e)=>setIaCtx({...iaCtx, quantidade: Number(e.target.value)})} className="h-8 w-16"/>
          <Button size="sm" variant="outline" onClick={handleSuggest} disabled={generating}>
            {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Wand2 className="w-3 h-3 mr-1"/>}Sugerir com IA
          </Button>
          <Button size="sm" variant="default" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <FileDown className="w-3 h-3 mr-1"/>}PDF da política
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/30">
        <div className="md:col-span-3"><Label className="text-xs">Critério</Label><Input value={novo.nome} onChange={(e)=>setNovo({...novo, nome: e.target.value})} placeholder="Ex.: Pontualidade"/></div>
        <div className="md:col-span-5"><Label className="text-xs">Descrição</Label><Input value={novo.descricao} onChange={(e)=>setNovo({...novo, descricao: e.target.value})} placeholder="Como apurar…"/></div>
        <div className="md:col-span-1"><Label className="text-xs">Peso</Label><Input type="number" min={1} max={5} value={novo.peso} onChange={(e)=>setNovo({...novo, peso: Number(e.target.value)})}/></div>
        <div className="md:col-span-2 flex items-center gap-2"><Switch checked={novo.essencial} onCheckedChange={(v)=>setNovo({...novo, essencial: v})}/><span className="text-xs">Essencial</span></div>
        <div className="md:col-span-1"><Button size="sm" onClick={handleAdd}><Plus className="w-3 h-3"/></Button></div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum critério ainda. Use "Sugerir com IA" ou cadastre manualmente.</p>
      ) : (
        <div className="space-y-1">
          {items.map(c => (
            <CriterionRow key={c.id} c={c} onUpdate={(patch)=>update(c.id, patch)} onRemove={()=>remove(c.id)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function CriterionRow({ c, onUpdate, onRemove }: { c: any; onUpdate: (patch: any) => Promise<any>; onRemove: () => Promise<any>; }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ nome: c.nome, descricao: c.descricao || '', peso: c.peso, essencial: c.essencial });
  if (!edit) {
    return (
      <div className="flex items-start gap-2 border rounded-md p-2 text-sm">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{c.nome}</span>
            <Badge variant="outline" className="text-[10px]">peso {c.peso}</Badge>
            {c.essencial && <Badge variant="destructive" className="text-[10px]">essencial</Badge>}
            {c.origem === 'ia' && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
          </div>
          {c.descricao && <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={()=>setEdit(true)}><Pencil className="w-3 h-3"/></Button>
        <Button size="sm" variant="ghost" onClick={async ()=>{ if (confirm('Excluir critério?')) await onRemove(); }}><Trash2 className="w-3 h-3"/></Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/20">
      <div className="md:col-span-3"><Input value={f.nome} onChange={(e)=>setF({...f, nome: e.target.value})}/></div>
      <div className="md:col-span-5"><Input value={f.descricao} onChange={(e)=>setF({...f, descricao: e.target.value})}/></div>
      <div className="md:col-span-1"><Input type="number" min={1} max={5} value={f.peso} onChange={(e)=>setF({...f, peso: Number(e.target.value)})}/></div>
      <div className="md:col-span-2 flex items-center gap-2"><Switch checked={f.essencial} onCheckedChange={(v)=>setF({...f, essencial: v})}/><span className="text-xs">Essencial</span></div>
      <div className="md:col-span-1 flex gap-1">
        <Button size="sm" onClick={async ()=>{ await onUpdate(f); setEdit(false); }}><Save className="w-3 h-3"/></Button>
        <Button size="sm" variant="ghost" onClick={()=>setEdit(false)}><X className="w-3 h-3"/></Button>
      </div>
    </div>
  );
}

function EmployeesSection({ policy, cliente }: { policy: PrizePolicy; cliente: any }) {
  const { items, create, createMany, update, remove } = usePrizeEmployees(policy.id);
  const { empregados } = useEmpregados();
  const [novo, setNovo] = useState({ nome: '', cpf: '', codigo_folha: '', matricula: '', cargo: '', setor: '', data_admissao: '' });
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const empresaNome = (cliente?.nome || cliente?.razao_social || '').trim();
  const empresaEmpregados = empregados.filter(e =>
    empresaNome && e.empresaNome?.trim().toUpperCase() === empresaNome.toUpperCase()
    && !items.some(i => (i.cpf || '').replace(/\D/g,'') === (e.cpf || '').replace(/\D/g,'') && i.cpf)
    && !items.some(i => i.nome.trim().toUpperCase() === e.nome.trim().toUpperCase())
  );

  const handleAdd = async () => {
    if (!novo.nome.trim()) { toast.error('Informe o nome do colaborador.'); return; }
    const { error } = await create({ ...novo, data_admissao: novo.data_admissao || null } as any);
    if (error) { toast.error('Erro ao adicionar.'); return; }
    setNovo({ nome: '', cpf: '', codigo_folha: '', matricula: '', cargo: '', setor: '', data_admissao: '' });
    toast.success('Colaborador adicionado.');
  };

  const handleBulk = async () => {
    const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map(l => {
      const [nome, cpf = '', cargo = '', setor = ''] = l.split(/[;\t,|]/).map(p => p.trim());
      return { nome, cpf: cpf || null, cargo: cargo || null, setor: setor || null };
    }).filter(r => r.nome);
    const { error } = await createMany(rows as any);
    if (error) { toast.error('Erro ao importar.'); return; }
    toast.success(`${rows.length} colaborador(es) adicionado(s).`);
    setBulk(''); setShowBulk(false);
  };

  const handleImportEmpresa = async (emp: { nome: string; cpf: string; funcao: string }) => {
    const { error } = await create({ nome: emp.nome, cpf: emp.cpf || null, cargo: emp.funcao || null });
    if (error) toast.error('Erro ao incluir.');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-1"><Users className="w-4 h-4"/>Colaboradores participantes ({items.length})</h4>
        <div className="flex gap-2">
          {empresaEmpregados.length > 0 && (
            <Button size="sm" variant="outline" onClick={()=>setShowImport(s => !s)}>
              <Users className="w-3 h-3 mr-1"/>Importar da empresa ({empresaEmpregados.length})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={()=>setShowBulk(s => !s)}>
            <Upload className="w-3 h-3 mr-1"/>Colar lista
          </Button>
        </div>
      </div>

      {showImport && empresaEmpregados.length > 0 && (
        <div className="border rounded-md p-2 bg-muted/20 max-h-48 overflow-y-auto space-y-1">
          <p className="text-[11px] text-muted-foreground">Colaboradores cadastrados em <strong>{empresaNome}</strong> — clique para incluir:</p>
          {empresaEmpregados.map(e => (
            <button key={e.id} type="button" onClick={()=>handleImportEmpresa(e)}
              className="w-full text-left text-xs px-2 py-1 hover:bg-muted rounded flex justify-between gap-2">
              <span>{e.nome}</span>
              <span className="text-muted-foreground">{e.funcao}{e.cpf ? ` • ${e.cpf}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {showBulk && (
        <div className="space-y-2 border rounded-md p-2 bg-muted/20">
          <Label className="text-xs">Um colaborador por linha. Separe campos por <code>;</code> ou tab: <em>Nome;CPF;Cargo;Setor</em></Label>
          <Textarea rows={4} value={bulk} onChange={(e)=>setBulk(e.target.value)} placeholder={'Maria Silva;111.222.333-44;Garçonete;Salão\nJoão Souza;;Cozinheiro;Cozinha'}/>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={()=>{ setShowBulk(false); setBulk(''); }}>Cancelar</Button>
            <Button size="sm" onClick={handleBulk}>Importar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/30">
        <div className="md:col-span-3"><Label className="text-xs">Nome *</Label><Input value={novo.nome} onChange={(e)=>setNovo({...novo, nome: e.target.value})}/></div>
        <div className="md:col-span-2"><Label className="text-xs">CPF</Label><Input value={novo.cpf} onChange={(e)=>setNovo({...novo, cpf: e.target.value})}/></div>
        <div className="md:col-span-1"><Label className="text-xs">Cód. folha</Label><Input value={novo.codigo_folha} onChange={(e)=>setNovo({...novo, codigo_folha: e.target.value})}/></div>
        <div className="md:col-span-2"><Label className="text-xs">Admissão</Label><Input type="date" value={novo.data_admissao} onChange={(e)=>setNovo({...novo, data_admissao: e.target.value})}/></div>
        <div className="md:col-span-2"><Label className="text-xs">Cargo</Label><Input value={novo.cargo} onChange={(e)=>setNovo({...novo, cargo: e.target.value})}/></div>
        <div className="md:col-span-1"><Label className="text-xs">Setor</Label><Input value={novo.setor} onChange={(e)=>setNovo({...novo, setor: e.target.value})}/></div>
        <div className="md:col-span-1"><Button size="sm" onClick={handleAdd}><Plus className="w-3 h-3"/></Button></div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum colaborador vinculado a esta política ainda.</p>
      ) : (
        <div className="space-y-1">
          {items.map(e => (
            <EmployeeRow key={e.id} e={e} onUpdate={(patch)=>update(e.id, patch)} onRemove={()=>remove(e.id)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ e, onUpdate, onRemove }: { e: any; onUpdate: (patch: any) => Promise<any>; onRemove: () => Promise<any>; }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ nome: e.nome, cpf: e.cpf || '', matricula: e.matricula || '', cargo: e.cargo || '', setor: e.setor || '', ativo: e.ativo });
  if (!edit) {
    return (
      <div className="flex items-start gap-2 border rounded-md p-2 text-sm">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{e.nome}</span>
            {!e.ativo && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
            {e.cargo && <Badge variant="outline" className="text-[10px]">{e.cargo}</Badge>}
            {e.setor && <span className="text-[11px] text-muted-foreground">{e.setor}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {e.cpf && <>CPF {e.cpf} </>}{e.matricula && <>• Matr. {e.matricula}</>}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={()=>setEdit(true)}><Pencil className="w-3 h-3"/></Button>
        <Button size="sm" variant="ghost" onClick={async ()=>{ if (confirm('Remover colaborador?')) await onRemove(); }}><Trash2 className="w-3 h-3"/></Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/20">
      <div className="md:col-span-3"><Input value={f.nome} onChange={(ev)=>setF({...f, nome: ev.target.value})}/></div>
      <div className="md:col-span-2"><Input value={f.cpf} placeholder="CPF" onChange={(ev)=>setF({...f, cpf: ev.target.value})}/></div>
      <div className="md:col-span-2"><Input value={f.matricula} placeholder="Matr." onChange={(ev)=>setF({...f, matricula: ev.target.value})}/></div>
      <div className="md:col-span-2"><Input value={f.cargo} placeholder="Cargo" onChange={(ev)=>setF({...f, cargo: ev.target.value})}/></div>
      <div className="md:col-span-2"><Input value={f.setor} placeholder="Setor" onChange={(ev)=>setF({...f, setor: ev.target.value})}/></div>
      <div className="md:col-span-1 flex gap-1">
        <Button size="sm" onClick={async ()=>{ await onUpdate(f); setEdit(false); }}><Save className="w-3 h-3"/></Button>
        <Button size="sm" variant="ghost" onClick={()=>setEdit(false)}><X className="w-3 h-3"/></Button>
      </div>
    </div>
  );
}