import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useChecklistRun, useChecklistTemplates } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

export default function ChecklistTab({ client_id }: { client_id: string }) {
  const today = new Date(); const defComp = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const [comp, setComp] = useState(defComp);
  const { items: templates } = useChecklistTemplates();
  const { run, upsert } = useChecklistRun(client_id, comp);
  const [steps, setSteps] = useState<any[]>([]);
  const [tmplId, setTmplId] = useState<string>('');

  useEffect(() => {
    if (run) { setSteps(run.steps_status || []); setTmplId(run.template_id || ''); }
    else if (templates.length > 0) {
      const def = templates.find(t => t.is_default) || templates[0];
      setTmplId(def.id);
      setSteps(def.steps.map(s => ({ id: s.id, title: s.title, status: 'pendente', responsible: '', marked_at: null, observation: '', attachment_path: '' })));
    }
  }, [run, templates]);

  const concluidos = useMemo(() => steps.filter(s => s.status === 'concluido').length, [steps]);
  const pct = steps.length ? Math.round(concluidos*100/steps.length) : 0;

  const updateStep = (i: number, patch: any) => setSteps(s => s.map((x, idx) => idx === i ? { ...x, ...patch, marked_at: patch.status ? new Date().toISOString() : x.marked_at } : x));

  const save = async () => {
    const { error } = await upsert(steps, tmplId || null);
    if (error) toast.error('Erro'); else toast.success('Salvo.');
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div><Label>Competência</Label><Input type="month" value={comp} onChange={(e)=>setComp(e.target.value)}/></div>
        <div className="flex-1 min-w-[160px]"><Label>Template</Label>
          <Select value={tmplId} onValueChange={setTmplId}>
            <SelectTrigger><SelectValue placeholder="Padrão"/></SelectTrigger>
            <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label>Progresso: {pct}%</Label>
          <Progress value={pct}/>
        </div>
      </CardContent></Card>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <Card key={s.id}><CardContent className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div className="md:col-span-2"><div className="font-medium text-sm">{i+1}. {s.title}</div>{s.marked_at && <div className="text-xs text-muted-foreground">{new Date(s.marked_at).toLocaleString('pt-BR')}</div>}</div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={s.status} onValueChange={(v)=>updateStep(i, { status: v })}>
                <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Responsável</Label><Input className="h-8" value={s.responsible} onChange={(e)=>updateStep(i, { responsible: e.target.value })}/></div>
            <div><Label className="text-xs">Obs</Label><Input className="h-8" value={s.observation} onChange={(e)=>updateStep(i, { observation: e.target.value })}/></div>
          </CardContent></Card>
        ))}
      </div>
      <div className="flex justify-end"><Button onClick={save}>Salvar checklist</Button></div>
    </div>
  );
}