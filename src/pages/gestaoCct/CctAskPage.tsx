import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Send } from 'lucide-react';

export default function CctAskPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav(`/gestao-cct/${id}`)}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
      <Card>
        <CardHeader><CardTitle>Perguntar à CCT — Fase 5</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Chat semântico sobre o texto da CCT. Será ativado após a extração de OCR (Fase 2). Interface disponível para prévia:</p>
          <div className="flex gap-2">
            <Input placeholder="Ex.: Qual o piso da categoria?" value={q} onChange={(e)=>setQ(e.target.value)} disabled/>
            <Button disabled><Send className="w-4 h-4"/></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}