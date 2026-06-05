import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useRiskFlags } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

const TYPES = [
  { v: 'alta_rotatividade', l: 'Alta rotatividade' },
  { v: 'muitos_afastamentos', l: 'Muitos afastamentos' },
  { v: 'ponto_problematico', l: 'Ponto problemático' },
  { v: 'risco_passivo', l: 'Risco de passivo trabalhista' },
  { v: 'sem_retorno', l: 'Cliente sem retorno frequente' },
];

export default function RiscosTab({ client_id }: { client_id: string }) {
  const { items, save, remove } = useRiskFlags(client_id);
  const [draft, setDraft] = useState<any>({ flag_type: 'ponto_problematico', severity: 'media', notes: '' });

  const add = async () => {
    await save(draft);
    setDraft({ flag_type: 'ponto_problematico', severity: 'media', notes: '' });
    toast.success('Risco registrado.');
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div><Label className="text-xs">Tipo</Label>
          <Select value={draft.flag_type} onValueChange={(v)=>setDraft({...draft, flag_type: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Severidade</Label>
          <Select value={draft.severity} onValueChange={(v)=>setDraft({...draft, severity: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex gap-2"><div className="flex-1"><Label className="text-xs">Notas</Label><Input value={draft.notes} onChange={(e)=>setDraft({...draft, notes: e.target.value})}/></div><Button onClick={add}><Plus className="w-4 h-4"/></Button></div>
      </CardContent></Card>
      <div className="space-y-2">
        {items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">Nenhum risco registrado.</p> :
        items.map(r => (
          <Card key={r.id} className={r.severity === 'alta' ? 'border-destructive' : r.severity === 'media' ? 'border-amber-500' : ''}><CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${r.severity === 'alta' ? 'text-destructive' : r.severity === 'media' ? 'text-amber-500' : 'text-muted-foreground'}`}/>
              <div>
                <div className="font-medium text-sm">{TYPES.find(t=>t.v===r.flag_type)?.l || r.flag_type} <Badge variant="outline" className="ml-2 text-xs">{r.severity}</Badge></div>
                {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={()=>remove(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}