import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Star, Download, Upload, Loader2, FileText } from 'lucide-react';
import { useRubrics } from '@/hooks/useSucessoCliente';
import type { ClientRubric } from '@/types/sucessoCliente';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

function blank(): Partial<ClientRubric> { return { code: '', name: '', kind: 'provento', percents_text: '', incidences: {}, is_critical: false, notes: '' }; }

export default function RubricasTab({ client_id }: { client_id: string }) {
  const { items, save, remove } = useRubrics(client_id);
  const [editing, setEditing] = useState<Partial<ClientRubric> | null>(null);
  const [importing, setImporting] = useState(false);
  const [extracted, setExtracted] = useState<Array<{ code: string; name: string; kind: 'provento' | 'desconto' | 'informativa'; referencia?: string; valor: number; selected: boolean }> | null>(null);
  const [meta, setMeta] = useState<{ competencia?: string; empresa?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const rows = [['codigo','nome','tipo','percentuais','critica','inss','fgts','irrf','dsr','esocial','observacoes']];
    items.forEach(r => rows.push([r.code, r.name, r.kind, r.percents_text, r.is_critical ? 'sim' : 'nao',
      r.incidences.inss ? 'sim':'nao', r.incidences.fgts ? 'sim':'nao', r.incidences.irrf ? 'sim':'nao', r.incidences.dsr ? 'sim':'nao', r.incidences.esocial ? 'sim':'nao', r.notes || '']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rubricas-${client_id}.csv`; a.click();
  };

  const handlePdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Envie um PDF.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('PDF muito grande (máx 15MB).'); return; }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const pdf_base64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke('ai-extract-rubricas', { body: { pdf_base64 } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const rubricas = ((data as any).rubricas || []) as Array<{ code: string; name: string; kind: any; referencia?: string; valor: number }>;
      setMeta({ competencia: (data as any).competencia, empresa: (data as any).empresa });
      if (rubricas.length === 0) { toast.error('Nenhuma rubrica encontrada no PDF.'); return; }
      // Importa automaticamente todas as novas; abre o diálogo apenas para revisão posterior.
      let ok = 0, skip = 0, fail = 0;
      for (const r of rubricas) {
        if (items.some(i => i.code === r.code)) { skip++; continue; }
        const { error: saveErr } = await save({
          code: r.code, name: r.name, kind: (r.kind || 'provento'),
          percents_text: r.referencia || '', incidences: {}, is_critical: false, notes: '',
        });
        if (saveErr) { fail++; console.error('save rubrica falhou', r.code, saveErr); }
        else ok++;
      }
      setExtracted(rubricas.map(r => ({ ...r, kind: (r.kind || 'provento'), selected: false })));
      if (fail > 0) toast.error(`${ok} importadas, ${skip} já existiam, ${fail} falharam (ver console).`);
      else toast.success(`${ok} importadas, ${skip} já existiam.`);
    } catch (e: unknown) {
      toast.error('Falha ao extrair: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  };

  const importSelected = async () => {
    if (!extracted) return;
    const sel = extracted.filter(r => r.selected);
    if (sel.length === 0) { toast.error('Selecione ao menos uma rubrica.'); return; }
    let ok = 0, skip = 0;
    for (const r of sel) {
      if (items.some(i => i.code === r.code)) { skip++; continue; }
      const { error } = await save({ code: r.code, name: r.name, kind: r.kind, percents_text: r.referencia || '', incidences: {}, is_critical: false, notes: '' });
      if (!error) ok++;
    }
    toast.success(`${ok} importadas, ${skip} já existiam.`);
    setExtracted(null); setMeta({});
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
        <div className="flex gap-2 flex-wrap">
          <Button onClick={()=>setEditing(blank())}><Plus className="w-4 h-4 mr-1"/>Nova rubrica</Button>
          <Button type="button" variant="outline" disabled={importing} onClick={()=>fileInputRef.current?.click()}>
            {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Upload className="w-4 h-4 mr-1"/>}
            {importing ? 'Extraindo via IA...' : 'Importar Extrato Mensal (PDF)'}
          </Button>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" disabled={importing}
            onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.currentTarget.value=''; }}/>
        </div>
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

      <Dialog open={!!extracted} onOpenChange={(o)=>!o && setExtracted(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4"/>Rubricas extraídas do Extrato Mensal</DialogTitle>
          </DialogHeader>
          {extracted && (
            <div className="space-y-3">
              {(meta.empresa || meta.competencia) && (
                <div className="text-xs text-muted-foreground">
                  {meta.empresa && <span>{meta.empresa}</span>}
                  {meta.competencia && <span className="ml-2">Competência: {meta.competencia}</span>}
                </div>
              )}
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"><Checkbox checked={extracted.every(r=>r.selected)} onCheckedChange={(v)=>setExtracted(extracted.map(r=>({...r, selected: !!v})))}/></TableHead>
                  <TableHead>Cód</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {extracted.map((r, i) => {
                    const exists = items.some(it => it.code === r.code);
                    return (
                      <TableRow key={i} className={exists ? 'opacity-60' : ''}>
                        <TableCell><Checkbox checked={r.selected} onCheckedChange={(v)=>{ const next=[...extracted]; next[i]={...r, selected: !!v}; setExtracted(next); }}/></TableCell>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="text-sm">{r.name}{exists && <Badge variant="outline" className="ml-2">já existe</Badge>}</TableCell>
                        <TableCell><Badge variant={r.kind==='desconto' ? 'destructive' : r.kind==='informativa' ? 'secondary' : 'default'}>{r.kind}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-xs">{r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>setExtracted(null)}>Cancelar</Button>
                <Button onClick={importSelected}>Importar selecionadas</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}