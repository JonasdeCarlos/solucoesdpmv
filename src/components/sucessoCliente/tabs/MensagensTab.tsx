import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, MessageCircle, Mail, Plus, Trash2 } from 'lucide-react';
import { useMessageTemplates } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

export default function MensagensTab({ client_id, clienteNome }: { client_id: string; clienteNome: string }) {
  const { items, save, remove } = useMessageTemplates(client_id);
  const [vars, setVars] = useState({ competencia: '', prazo: '', responsavel: '' });
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<any>({ category: '', channel: 'whatsapp', title: '', body: '' });

  const render = (body: string) => body
    .replace(/\{\{cliente_nome\}\}/g, clienteNome)
    .replace(/\{\{competencia\}\}/g, vars.competencia || '____')
    .replace(/\{\{prazo\}\}/g, vars.prazo || '____')
    .replace(/\{\{responsavel\}\}/g, vars.responsavel || '____');

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado.'); };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <div><Label className="text-xs">Competência</Label><Input value={vars.competencia} onChange={(e)=>setVars({...vars, competencia: e.target.value})} placeholder="ex.: 06/2026"/></div>
        <div><Label className="text-xs">Prazo</Label><Input value={vars.prazo} onChange={(e)=>setVars({...vars, prazo: e.target.value})} placeholder="ex.: dia 25"/></div>
        <div><Label className="text-xs">Responsável</Label><Input value={vars.responsavel} onChange={(e)=>setVars({...vars, responsavel: e.target.value})}/></div>
        <div className="flex items-end"><Button variant="outline" onClick={()=>setNewOpen(true)} className="w-full"><Plus className="w-4 h-4 mr-1"/>Novo modelo</Button></div>
      </CardContent></Card>
      <div className="space-y-2">
        {items.map(m => (
          <Card key={m.id}><CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm flex items-center gap-2">
                {m.channel === 'email' ? <Mail className="w-4 h-4"/> : <MessageCircle className="w-4 h-4"/>}
                {m.title}
                {m.is_global && <Badge variant="secondary" className="text-xs">global</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={()=>copy(render(m.body))}><Copy className="w-3 h-3 mr-1"/>Copiar</Button>
                {!m.is_global && <Button size="sm" variant="ghost" onClick={()=>remove(m.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
              </div>
            </div>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/30 p-2 rounded">{render(m.body)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo modelo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Categoria</Label><Input value={draft.category} onChange={(e)=>setDraft({...draft, category: e.target.value})}/></div>
              <div><Label>Canal</Label>
                <Select value={draft.channel} onValueChange={(v)=>setDraft({...draft, channel: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Título</Label><Input value={draft.title} onChange={(e)=>setDraft({...draft, title: e.target.value})}/></div>
            <div><Label>Corpo (use {`{{cliente_nome}}`}, {`{{competencia}}`}, {`{{prazo}}`}, {`{{responsavel}}`})</Label>
              <Textarea rows={5} value={draft.body} onChange={(e)=>setDraft({...draft, body: e.target.value})}/>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setNewOpen(false)}>Cancelar</Button>
              <Button onClick={async()=>{ await save(draft); setNewOpen(false); setDraft({ category: '', channel: 'whatsapp', title: '', body: '' }); toast.success('Salvo.'); }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}