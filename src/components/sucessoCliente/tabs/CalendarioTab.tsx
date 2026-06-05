import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import { useCalendar } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

const TYPES = [
  { v: 'envio_ponto', l: 'Envio de ponto/variáveis' },
  { v: 'envio_previa', l: 'Envio de prévia' },
  { v: 'fechamento', l: 'Fechamento interno' },
  { v: 'pagamento', l: 'Pagamento' },
  { v: 'vencimento_inss', l: 'Vencimento INSS' },
  { v: 'vencimento_fgts', l: 'Vencimento FGTS' },
  { v: 'vencimento_esocial', l: 'Vencimento DCTFWeb/eSocial' },
  { v: 'outro', l: 'Outro' },
];

export default function CalendarioTab({ client_id }: { client_id: string }) {
  const { items, save, remove } = useCalendar(client_id);
  const [draft, setDraft] = useState<any>({ event_date: '', event_type: 'envio_ponto', title: '', notes: '' });

  const add = async () => {
    if (!draft.event_date || !draft.title) { toast.error('Data e título obrigatórios'); return; }
    await save(draft);
    setDraft({ event_date: '', event_type: 'envio_ponto', title: '', notes: '' });
    toast.success('Adicionado.');
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div><Label className="text-xs">Data</Label><Input type="date" value={draft.event_date} onChange={(e)=>setDraft({...draft, event_date: e.target.value})}/></div>
        <div><Label className="text-xs">Tipo</Label>
          <Select value={draft.event_type} onValueChange={(v)=>setDraft({...draft, event_type: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2"><Label className="text-xs">Título</Label><Input value={draft.title} onChange={(e)=>setDraft({...draft, title: e.target.value})}/></div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1"/>Adicionar</Button>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem eventos.</TableCell></TableRow> :
            items.map(e => (
              <TableRow key={e.id}>
                <TableCell><CalendarDays className="w-4 h-4 inline mr-1"/>{new Date(e.event_date+'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-xs">{TYPES.find(t=>t.v===e.event_type)?.l || e.event_type}</TableCell>
                <TableCell>{e.title}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={()=>remove(e.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}