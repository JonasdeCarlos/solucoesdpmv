import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Star, Download, Upload } from 'lucide-react';
import { useRubrics } from '@/hooks/useSucessoCliente';
import type { ClientRubric } from '@/types/sucessoCliente';
import { toast } from 'sonner';

function blank(): Partial<ClientRubric> { return { code: '', name: '', kind: 'provento', percents_text: '', incidences: {}, is_critical: false, notes: '' }; }

export default function RubricasTab({ client_id }: { client_id: string }) {
  const { items, save, remove } = useRubrics(client_id);
  const [editing, setEditing] = useState<Partial<ClientRubric> | null>(null);

  const exportCsv = () => {
    const rows = [['codigo','nome','tipo','percentuais','critica','inss','fgts','irrf','dsr','esocial','observacoes']];
    items.forEach(r => rows.push([r.code, r.name, r.kind, r.percents_text, r.is_critical ? 'sim' : 'nao',
      r.incidences.inss ? 'sim':'nao', r.incidences.fgts ? 'sim':'nao', r.incidences.irrf ? 'sim':'nao', r.incidences.dsr ? 'sim':'nao', r.incidences.esocial ? 'sim':'nao', r.notes || '']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rubricas-${client_id}.csv`; a.click();
  };

  const handleSave = async () => {
    if (!editing?.code || !editing.name) { toast.error('Código e nome obrigatórios'); return; }
    const { error } = await save(editing);
    if (error) toast.error('Erro: ' + (error as any).message);
    else { toast.success('Salvo.'); setEditing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-between flex-wrap">
        <Button onClick={()=>setEditing(blank())}><Plus className="w-4 h-4 mr-1"/>Nova rubrica</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1"/>Exportar CSV</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Cód</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>%</TableHead><TableHead>Incidências</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map(r => (
              <TableRow key={r.id} className={r.is_critical ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.is_critical && <Star className="w-3 h-3 inline mr-1 text-amber-500"/>}{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                <TableCell className="text-xs">{r.percents_text}</TableCell>
                <TableCell className="text-xs">
                  {['inss','fgts','irrf','dsr','esocial'].filter(k => (r.incidences as any)[k]).map(k => <Badge key={k} variant="secondary" className="mr-1">{k.toUpperCase()}</Badge>)}
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={()=>setEditing(r)}><Pencil className="w-4 h-4"/></Button>
                  <Button size="icon" variant="ghost" onClick={()=>remove(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma rubrica.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Rubrica</DialogTitle></DialogHeader>
          {editing && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Código *</Label><Input value={editing.code || ''} onChange={(e)=>setEditing({...editing, code: e.target.value})}/></div>
              <div><Label>Tipo</Label>
                <Select value={editing.kind} onValueChange={(v)=>setEditing({...editing, kind: v as any})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provento">Provento</SelectItem>
                    <SelectItem value="desconto">Desconto</SelectItem>
                    <SelectItem value="informativa">Informativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nome *</Label><Input value={editing.name || ''} onChange={(e)=>setEditing({...editing, name: e.target.value})}/></div>
            <div><Label>Percentuais</Label><Input value={editing.percents_text || ''} onChange={(e)=>setEditing({...editing, percents_text: e.target.value})} placeholder="ex.: 50% / 100%"/></div>
            <div>
              <Label>Incidências</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {['inss','fgts','irrf','dsr','esocial'].map(k => (
                  <label key={k} className="flex items-center gap-1 text-sm">
                    <Checkbox checked={!!(editing.incidences as any)?.[k]} onCheckedChange={(v)=>setEditing({...editing, incidences: {...(editing.incidences||{}), [k]: !!v}})}/>
                    {k.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!editing.is_critical} onCheckedChange={(v)=>setEditing({...editing, is_critical: !!v})}/>Marcar como crítica</label>
            <div><Label>Observações</Label><Input value={editing.notes || ''} onChange={(e)=>setEditing({...editing, notes: e.target.value})}/></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}