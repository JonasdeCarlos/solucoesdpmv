import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Archive, Plus } from 'lucide-react';
import { useDiary } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

const TAGS = ['ponto','variáveis','folha','eSocial','férias','rescisão','benefícios','CCT'];

export default function DiarioTab({ client_id }: { client_id: string }) {
  const { entries, add, archive } = useDiary(client_id);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [showArch, setShowArch] = useState(false);

  const toggle = (t: string) => setSel(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    const { error } = await add({ text, tags: sel });
    if (error) toast.error('Erro'); else { toast.success('Adicionado.'); setText(''); setSel([]); }
  };

  const handleArchive = async (id: string) => {
    const r = prompt('Justificativa do arquivamento:');
    if (!r) return;
    await archive(id, r);
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <Label>Novo relato</Label>
        <Textarea value={text} onChange={(e)=>setText(e.target.value)} rows={3} placeholder="Descreva a particularidade…"/>
        <div className="flex flex-wrap gap-1">
          {TAGS.map(t => (
            <Badge key={t} variant={sel.includes(t) ? 'default' : 'outline'} className="cursor-pointer" onClick={()=>toggle(t)}>{t}</Badge>
          ))}
        </div>
        <div className="flex justify-end"><Button onClick={handleAdd}><Plus className="w-4 h-4 mr-1"/>Adicionar</Button></div>
      </CardContent></Card>
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={()=>setShowArch(s=>!s)}>{showArch ? 'Ocultar arquivados' : 'Mostrar arquivados'}</Button></div>
      <div className="space-y-2">
        {entries.filter(e => showArch || !e.archived).map(e => (
          <Card key={e.id} className={e.archived ? 'opacity-50' : ''}><CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(e.occurred_at).toLocaleString('pt-BR')}</span>
                  <span>•</span>
                  <span>{e.author_name || 'Sistema'}</span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{e.text}</p>
                {(e.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-2">{e.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}</div>}
                {e.archived && <p className="text-xs italic text-amber-600 mt-1">Arquivado — {e.archived_reason}</p>}
              </div>
              {!e.archived && <Button size="icon" variant="ghost" onClick={()=>handleArchive(e.id)} title="Arquivar"><Archive className="w-4 h-4"/></Button>}
            </div>
          </CardContent></Card>
        ))}
        {entries.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Sem relatos.</p>}
      </div>
    </div>
  );
}