import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClientes } from '@/hooks/useClientes';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EscalaRevezamentoPage from '@/modules/escala-revezamento/pages/EscalaRevezamentoPage';
import NecessidadeContratacao from '../components/NecessidadeContratacao';
import { MARCOS_PADRAO } from '../calculo';

const KEY = 'escala-cliente'; // mesmo contexto de empresa da Escala de Revezamento
const dias = (iso: string) => Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000);

export default function Pec5x2Page() {
  const { clientes } = useClientes();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') === 'escala' ? 'escala' : 'necessidade';
  const [clienteId, setRaw] = useState(() => localStorage.getItem(KEY) || '');
  const setClienteId = (v: string) => { setRaw(v); localStorage.setItem(KEY, v); };
  const [busca, setBusca] = useState('');
  const [escalaKey, setEscalaKey] = useState(0);
  useEffect(() => { setEscalaKey((k) => k + 1); }, [clienteId, tab]);
  const filtrados = useMemo(() => clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())), [clientes, busca]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">PEC – 5x2</h1>
          <p className="text-sm text-muted-foreground">Transição da escala 6x1 para 5x2 com redução da jornada semanal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MARCOS_PADRAO.filter((m) => m.data).map((m) => (
            <Badge key={m.id} variant="secondary" className="text-xs py-1">
              {m.data.split('-').reverse().join('/')} · {m.jornada}h/semana{dias(m.data) > 0 ? ` · faltam ${dias(m.data)} dias` : ' · vigente'}
            </Badge>
          ))}
        </div>
      </div>
      <Card className="p-3 flex flex-wrap gap-2 items-end">
        <div><Label>Buscar empresa</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" /></div>
        <div><Label>Empresa</Label>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm w-80" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione…</option>
            {filtrados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></div>
      </Card>
      <Tabs value={tab} onValueChange={(v) => setSp(v === 'escala' ? { aba: 'escala' } : {})}>
        <TabsList>
          <TabsTrigger value="necessidade">Necessidade de Contratação</TabsTrigger>
          <TabsTrigger value="escala">Escala de Revezamento</TabsTrigger>
        </TabsList>
        <TabsContent value="necessidade">
          {clienteId ? <NecessidadeContratacao empresaId={clienteId} empresa={clientes.find((c) => c.id === clienteId)}
            onAbrirEscala={(id) => { sessionStorage.setItem('escala-aberta', id); setSp({ aba: 'escala' }); }} />
            : <p className="text-sm text-muted-foreground p-4">Escolha uma empresa.</p>}
        </TabsContent>
        <TabsContent value="escala"><EscalaRevezamentoPage key={escalaKey} embutido /></TabsContent>
      </Tabs>
    </div>
  );
}
