import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessagesSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGESTOES = [
  'Como definir a amplitude das faixas salariais?',
  'Quantos níveis por cargo são recomendados?',
  'Como usar o piso da CCT como salário inicial?',
  'Quais critérios objetivos para promoção entre níveis?',
  'Minha estrutura atual está coerente? Aponte riscos.',
];

export default function CargosChat({ empresa, setor, cargos, estrutura, pisos }: {
  empresa?: string; setor?: string; cargos: any[]; estrutura: any; pisos?: any[];
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
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
      setMsgs((m) => [...m, { role: 'assistant', content: (data as any)?.answer || 'Sem resposta.' }]);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao consultar a IA.');
      setMsgs((m) => [...m, { role: 'assistant', content: 'Não foi possível responder agora. Tente novamente.' }]);
    } finally {
      setSending(false);
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
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {m.content}
              </div>
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
