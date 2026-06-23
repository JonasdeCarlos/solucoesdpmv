import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { generateFeedbackPdf } from '@/utils/sucessoCliente/feedbackPdf';

export default function FeedbackPublicPage() {
  const { token } = useParams();
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('feedback-public', { body: { token } });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setRec(data);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar');
      } finally { setLoading(false); }
    })();
  }, [token]);

  const tipoLabel = (t: string) => t === 'feedback' ? 'Feedback' : t === 'cobranca' ? 'Alinhamento/Cobrança' : 'Documento de Alinhamento';

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;
  if (!rec) return null;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card><CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold">{tipoLabel(rec.tipo)}</h1>
              <p className="text-sm text-muted-foreground">{rec.empresa}</p>
            </div>
            <div className="flex gap-2">
              {rec.tom && <Badge variant="secondary">tom: {rec.tom}</Badge>}
              <Button size="sm" variant="outline" onClick={()=>generateFeedbackPdf({
                empresa: rec.empresa, tipo: rec.tipo, employee_name: rec.employee_name,
                employee_role: rec.employee_role, manager_name: rec.manager_name, tom: rec.tom,
                texto: rec.generated_text || '',
              })}><FileDown className="w-4 h-4 mr-1"/>Baixar PDF</Button>
            </div>
          </div>
          <div className="text-sm space-y-1">
            <p><strong>Colaborador:</strong> {rec.employee_name}{rec.employee_role && ` — ${rec.employee_role}`}</p>
            {rec.manager_name && <p><strong>Gestor:</strong> {rec.manager_name}</p>}
            <p className="text-xs text-muted-foreground">Emitido em {new Date(rec.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div className="border-t pt-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{rec.generated_text}</p>
          </div>
          <p className="text-xs text-muted-foreground italic border-t pt-3">
            Documento de comunicação interna gerado com salvaguardas contra assédio moral. Para fins de alinhamento e desenvolvimento profissional.
          </p>
        </CardContent></Card>
      </div>
    </div>
  );
}