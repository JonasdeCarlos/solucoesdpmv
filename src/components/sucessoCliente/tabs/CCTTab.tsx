import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Copy, AlertTriangle } from 'lucide-react';
import { useCCTs } from '@/hooks/useSucessoCliente';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';

(pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.js`;

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return text;
}

export default function CCTTab({ client_id }: { client_id: string }) {
  const { items, reload } = useCCTs(client_id);
  const [busy, setBusy] = useState(false);
  const [replicaOpen, setReplicaOpen] = useState(false);
  const [origemList, setOrigemList] = useState<any[]>([]);
  const [view, setView] = useState<any>(null);

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else {
        text = await file.text();
      }
      const path = `${client_id}/cct/${Date.now()}_${file.name}`;
      await supabase.storage.from('cliente-dp-uploads').upload(path, file);
      const { data, error } = await supabase.functions.invoke('ai-resumo-cct', { body: { text } });
      if (error) throw error;
      const r = data as any;
      await supabase.from('client_ccts' as any).insert({
        client_id, union_base: r.union_base || '', sindicato: r.sindicato || '', uf: r.uf || '',
        data_base: r.data_base || '', validity_start: r.validity_start || null, validity_end: r.validity_end || null,
        doc_path: path, doc_name: file.name, ai_summary: r.summary || '', ai_clauses: r.clauses || [],
        version: items.length + 1, is_active: true,
      } as any);
      toast.success('CCT processada pela IA.');
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setBusy(false); }
  };

  const openReplica = async (sindicato: string) => {
    const { data } = await supabase.from('client_ccts' as any).select('*, clientes:client_id(nome)').eq('sindicato', sindicato).neq('client_id', client_id).order('created_at', { ascending: false });
    setOrigemList((data || []) as any);
    setReplicaOpen(true);
  };

  const replicar = async (origem: any) => {
    await supabase.from('client_ccts' as any).insert({
      client_id, union_base: origem.union_base, sindicato: origem.sindicato, uf: origem.uf,
      data_base: origem.data_base, validity_start: origem.validity_start, validity_end: origem.validity_end,
      doc_path: origem.doc_path, doc_name: origem.doc_name + ' (replicada)', ai_summary: origem.ai_summary,
      ai_clauses: origem.ai_clauses, version: items.length + 1, is_active: true,
    } as any);
    toast.success('CCT replicada.');
    setReplicaOpen(false); reload();
  };

  const daysToEnd = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-end gap-2">
        <label className="inline-flex">
          <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e)=>e.target.files?.[0] && handleUpload(e.target.files[0])}/>
          <span className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer hover:opacity-90"><Upload className="w-4 h-4 mr-1"/>{busy ? 'Processando…' : 'Enviar CCT (IA resume)'}</span>
        </label>
        {items[0]?.sindicato && <Button variant="outline" onClick={()=>openReplica(items[0].sindicato)}><Copy className="w-4 h-4 mr-1"/>Replicar de outro cliente</Button>}
      </CardContent></Card>

      <div className="space-y-2">
        {items.map(c => {
          const d = daysToEnd(c.validity_end);
          const alert = d !== null && d <= 90;
          return (
            <Card key={c.id} className={alert ? 'border-amber-500' : ''}><CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold flex items-center gap-2"><FileText className="w-4 h-4"/>{c.sindicato || 'Sindicato'}</div>
                  <div className="text-xs text-muted-foreground">{c.union_base} {c.uf && '• ' + c.uf} • Data-base: {c.data_base || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.validity_end && <Badge variant={alert ? 'destructive' : 'outline'}>Vence: {new Date(c.validity_end).toLocaleDateString('pt-BR')}{d!==null && ` (${d}d)`}</Badge>}
                  {alert && <AlertTriangle className="w-4 h-4 text-amber-500"/>}
                  <Button size="sm" variant="outline" onClick={()=>setView(c)}>Ver resumo</Button>
                </div>
              </div>
            </CardContent></Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma CCT cadastrada.</p>}
      </div>

      <Dialog open={!!view} onOpenChange={()=>setView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>{view?.sindicato} — Resumo IA</DialogTitle></DialogHeader>
          {view && <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{view.ai_summary}</p>
            <h4 className="font-bold text-sm">Cláusulas-chave</h4>
            <ul className="space-y-2">
              {(view.ai_clauses || []).map((cl: any, i: number) => (
                <li key={i} className="border-l-2 border-primary pl-3 text-sm">
                  <strong>{cl.titulo}:</strong> {cl.descricao}
                </li>
              ))}
            </ul>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={replicaOpen} onOpenChange={setReplicaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Replicar CCT</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {origemList.map((o: any) => (
              <Card key={o.id}><CardContent className="p-3 flex justify-between items-center">
                <div><div className="font-medium text-sm">{(o.clientes as any)?.nome}</div><div className="text-xs text-muted-foreground">{o.sindicato} • {new Date(o.created_at).toLocaleDateString('pt-BR')}</div></div>
                <Button size="sm" onClick={()=>replicar(o)}>Replicar</Button>
              </CardContent></Card>
            ))}
            {origemList.length === 0 && <p className="text-sm text-muted-foreground">Sem CCTs disponíveis da mesma base sindical.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}