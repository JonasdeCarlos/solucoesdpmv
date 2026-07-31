import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, Loader2, Save, Send, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { logCctAudit } from '@/hooks/cct/useCctAnalyses';

export function CctResumoClienteCard({ analysis, onChanged }: { analysis: any; onChanged?: () => void }) {
  const [text, setText] = useState<string>(analysis?.client_summary || '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [empresaId, setEmpresaId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const { empresas } = useAvisoEmpresas();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ativos = empresas.filter((e) => e.ativo !== false);
    if (!q) return ativos.slice(0, 60);
    return ativos.filter((e) =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.code || '').toLowerCase().includes(q) ||
      (e.cnpj || '').toLowerCase().includes(q),
    ).slice(0, 60);
  }, [empresas, query]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('cct-resumo-cliente', { body: { analysis_id: analysis.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setText((data as any).client_summary || '');
      toast.success('Resumo para cliente gerado.');
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao gerar resumo.');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('cct_analyses' as any).update({ client_summary: text } as any).eq('id', analysis.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Resumo salvo.');
    onChanged?.();
  };

  const mensagem = useMemo(() => {
    const titulo = analysis?.title || 'Convenção Coletiva';
    return `*Resumo da CCT — ${titulo}*\n\n${text.trim()}\n\nQualquer dúvida, estamos à disposição.`;
  }, [text, analysis?.title]);

  const send = async () => {
    if (!empresaId) { toast.error('Selecione a empresa destinatária.'); return; }
    if (text.trim().length < 20) { toast.error('Gere ou escreva o resumo antes de enviar.'); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('avisos-digisac-mensagem', {
        body: { empresa_id: empresaId, mensagem: mensagem.slice(0, 4000) },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      await logCctAudit(analysis.id, 'resumo_cliente_enviado_digisac', { empresa_id: empresaId });
      toast.success('Resumo enviado via Digisac.');
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar pelo Digisac.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Resumo para o cliente</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={generate} disabled={generating || !analysis?.ocr_applied}>
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Sparkles className="w-4 h-4 mr-1"/>}
            Gerar com IA
          </Button>
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Save className="w-4 h-4 mr-1"/>}Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={text.trim().length < 20}>
            <Send className="w-4 h-4 mr-1"/>Enviar via Digisac
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Versão curta e objetiva, escrita para o empresário. Editável antes do envio.</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder='Clique em "Gerar com IA" para criar o resumo objetivo do cliente.'
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar resumo via Digisac</DialogTitle>
            <DialogDescription>Selecione a empresa cadastrada no módulo Avisos. A mensagem vai para os WhatsApp cadastrados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar empresa por nome, código ou CNPJ…" className="pl-8"/>
            </div>
            <div className="max-h-56 overflow-y-auto border rounded divide-y">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Nenhuma empresa encontrada.</p>
              ) : filtered.map((e) => (
                <label key={e.id} className={`flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/40 ${empresaId === e.id ? 'bg-muted' : ''}`}>
                  <input type="radio" name="empresa-digisac" checked={empresaId === e.id} onChange={() => setEmpresaId(e.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.code} — {e.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {(e.whatsapp_numeros?.length ? e.whatsapp_numeros.join(', ') : e.whatsapp) || 'sem WhatsApp cadastrado'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div>
              <Label className="text-xs">Prévia da mensagem</Label>
              <Textarea value={mensagem} readOnly rows={8} className="text-xs"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={send} disabled={sending || !empresaId}>
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Send className="w-4 h-4 mr-1"/>}Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}