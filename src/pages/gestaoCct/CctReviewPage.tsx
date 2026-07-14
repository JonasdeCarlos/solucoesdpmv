import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';

export default function CctReviewPage() {
  const { id } = useParams();
  const nav = useNavigate();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav(`/gestao-cct/${id}`)}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
      <Card>
        <CardHeader><CardTitle>Revisar Raio-X — Fase 3</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">A revisão item-a-item (cláusulas + benefícios com trecho de origem, página e nível de confiança) será liberada na Fase 3, após a extração automática pela IA (Fase 2).</p>
        </CardContent>
      </Card>
    </div>
  );
}