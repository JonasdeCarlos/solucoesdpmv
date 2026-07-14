import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Send, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCctAnalysis, type CctAnalysis } from '@/hooks/cct/useCctAnalyses';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Qual o piso salarial da categoria?',
  'Qual o percentual de reajuste e a data-base?',
  'Quais benefícios são obrigatórios e seus valores?',
  'Quais são as regras de jornada e banco de horas?',
  'Qual o percentual de hora extra e adicional noturno?',
  'Quais contribuições sindicais estão previstas?',
];

export default function CctAskPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [a, setA] = useState<CctAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const data = await fetchCctAnalysis(id);
      setA(data);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const ask = async (question: string) => {
    if (!id || !question.trim() || sending) return;
    const userMsg: Msg = { role: 'user', content: question.trim() };
    const history = msgs.slice(-8);
    setMsgs((m) => [...m, userMsg]);
    setQ('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('cct-ask', {
        body: { analysis_id: id, question: userMsg.content, history },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const answer = (data as any)?.answer || 'Sem resposta.';
      setMsgs((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao consultar a CCT.');
      setMsgs((m) => [...m, { role: 'assistant', content: 'Não foi possível responder agora. Tente novamente.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav(`/gestao-cct/${id}`)}><ChevronLeft className="w-4 h-4" />Voltar</Button>
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Perguntar à CCT</h2>
        <p className="text-sm text-muted-foreground">Chat com IA sobre o Raio-X extraído {a?.ocr_text ? 'e o texto integral' : ''}.</p>
        {a && <div className="mt-1 flex flex-wrap gap-1 text-xs"><Badge variant="outline">{a.title || 'CCT'}</Badge>{a.ocr_applied ? <Badge>Raio-X pronto</Badge> : <Badge variant="secondary">Ainda sem Raio-X</Badge>}</div>}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : !a?.ocr_applied ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Execute "Analisar com IA" na tela da CCT antes de perguntar — sem Raio-X extraído, a IA não tem dados para responder.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Sugestões</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={sending}>{s}</Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3 min-h-[300px] max-h-[520px] overflow-y-auto">
              {msgs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Faça uma pergunta ou escolha uma sugestão.</p>
              ) : msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Consultando a CCT…</div></div>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Qual o valor do vale-alimentação?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
              disabled={sending}
            />
            <Button onClick={() => ask(q)} disabled={sending || !q.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}