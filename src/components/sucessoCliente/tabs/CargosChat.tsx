import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessagesSquare, Trash2, Wand2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Proposta = {
  resumo?: string;
  cargos?: any[];
  faixas?: any[];
  escala_evolucao?: any[];
};

type Msg = { role: 'user' | 'assistant'; content: string; proposta?: Proposta | null };

function extrairProposta(raw: string): { text: string; proposta: Proposta | null } {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let proposta: Proposta | null = null;
  let text = raw;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const p = parsed?.proposta ?? parsed;
      if (p && (p.cargos?.length || p.faixas?.length || p.escala_evolucao?.length)) {
        proposta = p;
        text = text.replace(m[0], '');
      }
    } catch { /* bloco não é JSON válido */ }
  }
  return { text: text.trim(), proposta };
}

const brl = (v: any) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

const SUGESTOES = [
  'Como definir a amplitude das faixas salariais?',
  'Quantos níveis por cargo são recomendados?',
  'Como usar o piso da CCT como salário inicial?',
  'Quais critérios objetivos para promoção entre níveis?',
  'Minha estrutura atual está coerente? Aponte riscos.',
];

export default function CargosChat({ empresa, setor, cargos, estrutura, pisos, onAplicar }: {
  empresa?: string; setor?: string; cargos: any[]; estrutura: any; pisos?: any[];
  onAplicar?: (p: Proposta) => Promise<void> | void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
  const [aplicando, setAplicando] = useState<number | null>(null);
  const [aplicadas, setAplicadas] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || sending) return;
    const history = msgs.slice(-8);
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setQ('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('cargos-chat', {
        body: { question: text, history, empresa, setor, cargos, estrutura, pisos },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { text, proposta } = extrairProposta((data as any)?.answer || 'Sem resposta.');
      setMsgs((m) => [...m, { role: 'assistant', content: text || 'Sem resposta.', proposta }]);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao consultar a IA.');
      setMsgs((m) => [...m, { role: 'assistant', content: 'Não foi possível responder agora. Tente novamente.' }]);
    } finally {
      setSending(false);
    }
  };

  const aplicar = async (p: Proposta, i: number) => {
    if (!onAplicar) return;
    setAplicando(i);
    try {
      await onAplicar(p);
      setAplicadas((a) => [...a, i]);
      toast.success('Alterações aplicadas aos cargos e à estrutura salarial.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao aplicar as alterações.');
    } finally {
      setAplicando(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-primary" />Consultor IA — Estrutura Salarial
        </CardTitle>
        {msgs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMsgs([])}><Trash2 className="w-4 h-4 mr-1" />Limpar</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={sending}>{s}</Button>
          ))}
        </div>

        <div className="space-y-3 max-h-[420px] overflow-y-auto rounded-md border p-3">
          {msgs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Pergunte sobre faixas, níveis, pisos de CCT, progressão e governança do plano. A IA usa os cargos e a estrutura já cadastrados deste cliente.
            </p>
          ) : msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-2'}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {m.content}
              </div>
              {m.proposta && (
                <div className="w-full rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-primary">Mudanças detectadas {m.proposta.resumo ? `— ${m.proposta.resumo}` : ''}</p>
                  {!!m.proposta.cargos?.length && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Cargos ({m.proposta.cargos.length})</p>
                      {m.proposta.cargos.slice(0, 8).map((c: any, k: number) => (
                        <p key={k} className="text-muted-foreground">• {c.nome} — salário {brl(c.salario_atual)} / piso {brl(c.piso_salarial)}</p>
                      ))}
                    </div>
                  )}
                  {!!m.proposta.faixas?.length && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Faixas ({m.proposta.faixas.length})</p>
                      {m.proposta.faixas.slice(0, 8).map((f: any, k: number) => (
                        <p key={k} className="text-muted-foreground">• {f.cargo}: {(f.niveis || []).map((n: any) => `${n.nome} ${brl(n.valor)}`).join(' → ')}</p>
                      ))}
                    </div>
                  )}
                  {!!m.proposta.escala_evolucao?.length && (
                    <p className="text-xs text-muted-foreground">Escala de evolução: {m.proposta.escala_evolucao.map((e: any) => `${e.etapa} ${e.percentual_base}%`).join(' · ')}</p>
                  )}
                  <Button
                    size="sm"
                    disabled={aplicando !== null || aplicadas.includes(i) || !onAplicar}
                    onClick={() => aplicar(m.proposta!, i)}
                  >
                    {aplicadas.includes(i)
                      ? <><Check className="w-4 h-4 mr-1" />Aplicado</>
                      : aplicando === i
                        ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Aplicando…</>
                        : <><Wand2 className="w-4 h-4 mr-1" />Aplicar aos cargos e estrutura</>}
                  </Button>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />Analisando a estrutura…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ex.: qual o % ideal entre Inicial e Referência?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
            disabled={sending}
          />
          <Button onClick={() => ask(q)} disabled={sending || !q.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
