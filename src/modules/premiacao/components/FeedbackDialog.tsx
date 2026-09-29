import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sparkles, Save, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { tbl, brl, fmtComp, type Apuracao, type Catalogo, type Colaborador, type Lancamento, type Politica } from '../hooks/usePremiacao';
import { pdfFeedback } from '../utils/pdfs';

export default function FeedbackDialog({ open, onOpenChange, politica, cat, apuracao, colaborador, empresa, call }: {
  call?: (action: string, extra?: Record<string, unknown>) => Promise<any>;
  open: boolean; onOpenChange: (v: boolean) => void;
  politica: Politica; cat: Catalogo; apuracao: Apuracao; colaborador: Colaborador; empresa: string;
}) {
  const [texto, setTexto] = useState('');
  const [observacao, setObservacao] = useState('');
  const [origem, setOrigem] = useState<'manual' | 'ia'>('manual');
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    (call
      ? call('get_feedback', { colaborador_id: colaborador.id, competencia: apuracao.competencia }).then((r: any) => ({ data: r.feedback }))
      : tbl('premiacao_feedbacks').select('*').eq('politica_id', politica.id).eq('colaborador_id', colaborador.id).eq('competencia', apuracao.competencia).maybeSingle())
      .then(({ data }: any) => { setTexto(data?.texto || ''); setOrigem(data?.origem === 'ia' ? 'ia' : 'manual'); });
  }, [open, politica.id, colaborador.id, apuracao.competencia]);

  const gerarIa = async () => {
    setGerando(true); setTexto('');
    try {
      const { data: lanc } = call
        ? { data: (await call('list_lancamentos', { competencia: apuracao.competencia, colaborador_id: colaborador.id })).items }
        : await tbl('premiacao_lancamentos').select('*')
          .eq('politica_id', politica.id).eq('colaborador_id', colaborador.id).eq('competencia', apuracao.competencia);
      const ocorrencias = ((lanc || []) as Lancamento[]).map(l => ({ tipo: l.tipo, codigo: l.codigo, descricao: l.descricao, pontos: l.pontos_total, observacao: l.observacao }));
      const { data: sess } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/premiacao-feedback`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${sess?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          empresa, colaborador: colaborador.nome, funcao: cat.funcaoDe(colaborador), competencia: fmtComp(apuracao.competencia),
          saldo_inicial: apuracao.saldo_inicial, pontos_medalhas: apuracao.pontos_medalhas, pontos_trofeus: apuracao.pontos_trofeus,
          pontos_desabonos: apuracao.pontos_desabonos, saldo_apurado: apuracao.saldo_apurado, pontuacao_referencia: apuracao.pontuacao_referencia,
          pontos_premiaveis: apuracao.pontos_premiaveis, valor_bonificacao: apuracao.valor_bonificacao, saldo_transportado: apuracao.saldo_transportado,
          metas: apuracao.trofeus_conquistados, ocorrencias, observacao,
        }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || `Falha ao gerar feedback (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() || '';
        for (const line of parts) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') {
              acc += ev.delta; setTexto(acc);
            }
          } catch { /* ignora chunks parciais */ }
        }
      }
      if (!acc.trim()) throw new Error('A IA não retornou texto. Tente novamente.');
      setOrigem('ia');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar o feedback.');
    } finally { setGerando(false); }
  };

  const salvar = async () => {
    setSalvando(true);
    if (call) {
      const r = await call('save_feedback', { colaborador_id: colaborador.id, competencia: apuracao.competencia, texto, origem });
      setSalvando(false);
      if (r.error) return toast.error(r.error);
      return toast.success('Feedback salvo.');
    }
    const { error } = await tbl('premiacao_feedbacks').upsert({
      empresa_id: politica.empresa_id, politica_id: politica.id, colaborador_id: colaborador.id,
      competencia: apuracao.competencia, texto, origem,
    }, { onConflict: 'politica_id,colaborador_id,competencia' });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success('Feedback salvo.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Feedback — {colaborador.nome}</DialogTitle>
          <DialogDescription>
            {fmtComp(apuracao.competencia)} · Saldo {apuracao.saldo_apurado} pts · Referência {apuracao.pontuacao_referencia} pts · Prêmio {brl(Number(apuracao.valor_bonificacao))}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Observação do gestor (opcional, usada pela IA)</Label>
            <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: teve grande evolução no atendimento" />
          </div>
          <div>
            <Label className="text-xs">Texto do feedback</Label>
            <Textarea rows={12} value={texto} onChange={e => { setTexto(e.target.value); setOrigem('manual'); }} placeholder="Escreva o feedback ou gere com IA." />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={gerarIa} disabled={gerando}>
              {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Gerar com IA
            </Button>
            <Button variant="outline" onClick={salvar} disabled={salvando || !texto.trim()}><Save className="w-4 h-4 mr-1" />Salvar</Button>
            <Button disabled={!texto.trim()} onClick={() => pdfFeedback({ politica, cat, apuracao, colaborador, empresa, texto }).save(`feedback-${colaborador.nome}-${apuracao.competencia}.pdf`)}>
              <FileDown className="w-4 h-4 mr-1" />PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
