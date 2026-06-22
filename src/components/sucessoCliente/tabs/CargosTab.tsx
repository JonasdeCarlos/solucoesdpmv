import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, Plus, Trash2, Copy, Pencil, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCargos, useEstruturaSalarial } from '@/hooks/useCargos';
import { generateCargosPdf } from '@/utils/sucessoCliente/cargosPdf';
import { DebouncedInput } from '@/components/sucessoCliente/DebouncedField';

const NIVEIS = [
  { v:'operacional', l:'Operacional' },
  { v:'tecnico', l:'Técnico' },
  { v:'analista', l:'Analista' },
  { v:'especialista', l:'Especialista' },
  { v:'gestao', l:'Gestão' },
  { v:'diretoria', l:'Diretoria' },
];

const emptyDraft = () => ({
  nome: '', cbo: '', area: '', nivel: 'analista', entrevista: '',
  descricao_sumaria: '', atividades: [] as string[],
  requisitos: { escolaridade: '', experiencia: '', competencias: [] as string[] },
  salario_atual: '' as any,
});

export default function CargosTab({ client_id, cliente }: { client_id: string; cliente: any }) {
  const { items, save, remove, duplicate } = useCargos(client_id);
  const { estrutura, save: saveEstrutura } = useEstruturaSalarial(client_id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [filterArea, setFilterArea] = useState('all');
  const [filterNivel, setFilterNivel] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);

  const areas = useMemo(() => Array.from(new Set(items.map(i => i.area).filter(Boolean))), [items]);
  const filtered = items.filter(i =>
    (filterArea === 'all' || i.area === filterArea) &&
    (filterNivel === 'all' || i.nivel === filterNivel)
  );

  const openNew = () => { setDraft(emptyDraft()); setOpen(true); };
  const openEdit = (c: any) => { setDraft({ ...c, atividades: c.atividades||[], requisitos: c.requisitos||{} }); setOpen(true); };

  const formalizar = async () => {
    if (!draft.entrevista?.trim()) return toast.error('Informe o texto da entrevista.');
    setBusy('formalizar');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-formalizar', {
        body: { nome: draft.nome, cbo: draft.cbo, entrevista: draft.entrevista },
      });
      if (error) throw error;
      setDraft((d:any) => ({ ...d, descricao_sumaria: data?.descricao_sumaria || d.descricao_sumaria, atividades: data?.atividades || d.atividades, requisitos: data?.requisitos || d.requisitos }));
      toast.success('Cargo formalizado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const salvar = async () => {
    if (!draft.nome) return toast.error('Informe o nome do cargo.');
    const payload = { ...draft, salario_atual: draft.salario_atual === '' ? null : Number(draft.salario_atual) };
    await save(payload);
    setOpen(false); toast.success('Cargo salvo.');
  };

  const sugerirEstrutura = async () => {
    if (items.length < 2) return toast.info('Cadastre ao menos 2 cargos.');
    setBusy('estrutura');
    try {
      const { data, error } = await supabase.functions.invoke('estrutura-salarial-sugerir', {
        body: { empresa: cliente?.nome, cargos: items.map(i => ({ nome: i.nome, cbo: i.cbo, nivel: i.nivel, salario_atual: i.salario_atual })) },
      });
      if (error) throw error;
      await saveEstrutura({ faixas: data?.faixas || [], escala_evolucao: data?.escala_evolucao || [] });
      toast.success('Estrutura salarial sugerida.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const exportarPdf = async () => {
    setBusy('pdf');
    try {
      let introducao = ''; let consideracoes = '';
      try {
        const { data } = await supabase.functions.invoke('cargos-relatorio-textos', { body: { empresa: cliente?.nome, totalCargos: items.length } });
        introducao = data?.introducao_metodologia || '';
        consideracoes = data?.consideracoes_finais || '';
      } catch {}
      await generateCargosPdf({ empresa: cliente?.nome || '—', cargos: items, estrutura, introducao, consideracoes });
      toast.success('PDF gerado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const updateFaixa = (idx: number, patch: any) => {
    const faixas = (estrutura?.faixas || []).map((f:any,i:number)=> i===idx ? { ...f, ...patch } : f);
    saveEstrutura({ faixas, escala_evolucao: estrutura?.escala_evolucao || [] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[160px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas áreas</SelectItem>{areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterNivel} onValueChange={setFilterNivel}>
            <SelectTrigger className="w-[160px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos níveis</SelectItem>{NIVEIS.map(n=><SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1"/>Novo cargo</Button>
          <Button variant="outline" onClick={sugerirEstrutura} disabled={busy==='estrutura'}>{busy==='estrutura' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}Sugerir Estrutura Salarial</Button>
          <Button variant="outline" onClick={exportarPdf} disabled={busy==='pdf'}>{busy==='pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileDown className="w-4 h-4 mr-2"/>}Gerar Relatório Final</Button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">Nenhum cargo cadastrado.</p> :
          filtered.map(c => (
            <Card key={c.id}><CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{c.nome} {c.cbo && <span className="text-xs text-muted-foreground">(CBO {c.cbo})</span>}</div>
                <div className="text-xs text-muted-foreground">{c.area || '—'} • <Badge variant="outline">{NIVEIS.find(n=>n.v===c.nivel)?.l || c.nivel}</Badge> {c.salario_atual ? ' • R$ '+Number(c.salario_atual).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={()=>openEdit(c)}><Pencil className="w-4 h-4"/></Button>
                <Button size="icon" variant="ghost" onClick={()=>duplicate(c)}><Copy className="w-4 h-4"/></Button>
                <Button size="icon" variant="ghost" onClick={()=>{if(confirm('Excluir cargo?')) remove(c.id);}}><Trash2 className="w-4 h-4 text-destructive"/></Button>
              </div>
            </CardContent></Card>
          ))
        }
      </div>

      {estrutura && (estrutura.faixas?.length || estrutura.escala_evolucao?.length) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Estrutura Salarial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto">
              <table className="w-full text-sm border">
                <thead className="bg-muted"><tr>
                  <th className="p-2 text-left">Faixa</th><th className="p-2 text-left">Cargos</th><th className="p-2">Mín.</th><th className="p-2">Médio</th><th className="p-2">Máx.</th>
                </tr></thead>
                <tbody>
                {(estrutura.faixas || []).map((f:any, idx:number) => (
                  <tr key={idx} className="border-t">
                    <td className="p-1"><DebouncedInput value={f.nome||''} onCommit={(v)=>updateFaixa(idx,{nome:v})}/></td>
                    <td className="p-1 text-xs">{(f.cargos||[]).join(', ')}</td>
                    <td className="p-1"><DebouncedInput type="number" value={f.min||0} onCommit={(v)=>updateFaixa(idx,{min:Number(v)})}/></td>
                    <td className="p-1"><DebouncedInput type="number" value={f.mid||0} onCommit={(v)=>updateFaixa(idx,{mid:Number(v)})}/></td>
                    <td className="p-1"><DebouncedInput type="number" value={f.max||0} onCommit={(v)=>updateFaixa(idx,{max:Number(v)})}/></td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            {estrutura.escala_evolucao?.length ? (
              <div>
                <div className="text-sm font-semibold mb-1">Escala de evolução</div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {estrutura.escala_evolucao.map((e:any,i:number) => (
                    <Card key={i}><CardContent className="p-2 text-center">
                      <div className="text-xs text-muted-foreground">{e.etapa}</div>
                      <div className="text-xl font-bold">{e.percentual_base}%</div>
                      <div className="text-xs">{e.descricao}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{draft.id ? 'Editar cargo' : 'Novo cargo'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><Label className="text-xs">Nome do cargo</Label><Input value={draft.nome} onChange={e=>setDraft({...draft,nome:e.target.value})}/></div>
            <div><Label className="text-xs">CBO</Label><Input value={draft.cbo} onChange={e=>setDraft({...draft,cbo:e.target.value})}/></div>
            <div><Label className="text-xs">Área / Departamento</Label><Input value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}/></div>
            <div><Label className="text-xs">Nível</Label>
              <Select value={draft.nivel} onValueChange={v=>setDraft({...draft,nivel:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{NIVEIS.map(n=><SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Salário atual (opcional)</Label><Input type="number" value={draft.salario_atual} onChange={e=>setDraft({...draft,salario_atual:e.target.value})}/></div>
            <div className="md:col-span-2"><Label className="text-xs">Entrevista com ocupante/gestor</Label><Textarea rows={5} value={draft.entrevista} onChange={e=>setDraft({...draft,entrevista:e.target.value})}/></div>
            <div className="md:col-span-2 flex justify-end">
              <Button variant="outline" onClick={formalizar} disabled={busy==='formalizar'}>{busy==='formalizar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}Formalizar com IA</Button>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Descrição sumária</Label><Textarea rows={4} value={draft.descricao_sumaria} onChange={e=>setDraft({...draft,descricao_sumaria:e.target.value})}/></div>
            <div className="md:col-span-2"><Label className="text-xs">Atividades (uma por linha)</Label>
              <Textarea rows={6} value={(draft.atividades||[]).join('\n')} onChange={e=>setDraft({...draft,atividades:e.target.value.split('\n').filter(Boolean)})}/>
            </div>
            <div><Label className="text-xs">Escolaridade</Label><Input value={draft.requisitos?.escolaridade||''} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,escolaridade:e.target.value}})}/></div>
            <div><Label className="text-xs">Experiência</Label><Input value={draft.requisitos?.experiencia||''} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,experiencia:e.target.value}})}/></div>
            <div className="md:col-span-2"><Label className="text-xs">Competências (vírgula)</Label>
              <Input value={(draft.requisitos?.competencias||[]).join(', ')} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,competencias:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}})}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}