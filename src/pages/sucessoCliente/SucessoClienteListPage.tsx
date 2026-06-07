import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Plus, Search, AlertTriangle } from 'lucide-react';
import { useClientesDP } from '@/hooks/useSucessoCliente';
import ImportClientesDialog from '@/components/sucessoCliente/ImportClientesDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function SucessoClienteListPage() {
  const navigate = useNavigate();
  const { list, loading, reload } = useClientesDP();
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('todos');
  const [gestorF, setGestorF] = useState('todos');
  const [importOpen, setImportOpen] = useState(false);

  const gestores = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c: any) => { if (c.gestor_carteira) s.add(c.gestor_carteira); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [list]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return list.filter((c: any) => {
      if (statusF !== 'todos' && c.status !== statusF) return false;
      if (gestorF !== 'todos' && (c.gestor_carteira || '') !== gestorF) return false;
      if (!s) return true;
      return (c.nome + ' ' + c.cnpj + ' ' + c.codigo_cliente + ' ' + c.nome_fantasia + ' ' + c.municipio + ' ' + (c.gestor_carteira || '')).toLowerCase().includes(s);
    });
  }, [list, q, statusF, gestorF]);

  const createNew = async () => {
    const nome = prompt('Razão social / Nome do cliente:');
    if (!nome) return;
    const { data, error } = await supabase.from('clientes' as any).insert({ nome, tipo: 'PJ', status: 'ativo' } as any).select('id').maybeSingle();
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Cliente criado.');
    if (data) navigate(`/sucesso-cliente/${(data as any).id}`);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Sucesso do Cliente – DP</h2>
          <p className="text-sm text-muted-foreground">Guia operacional centralizado por cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1"/>Importar Excel</Button>
          <Button onClick={createNew}><Plus className="w-4 h-4 mr-1"/>Novo cliente</Button>
        </div>
      </div>

      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Busca</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Nome, CNPJ, código, município…" className="pl-8"/>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Gestor da Carteira</label>
          <Select value={gestorF} onValueChange={setGestorF}>
            <SelectTrigger className="w-56"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {gestores.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ / CPF</TableHead>
              <TableHead>Município/UF</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cliente.</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={()=>navigate(`/sucesso-cliente/${c.id}`)}>
                <TableCell className="font-mono text-xs">{c.codigo_cliente || '—'}</TableCell>
                <TableCell className="font-medium">{c.nome}{c.nome_fantasia ? <span className="text-xs text-muted-foreground ml-2">({c.nome_fantasia})</span> : null}</TableCell>
                <TableCell>{c.tipo === 'PJ' ? c.cnpj : c.cpf}</TableCell>
                <TableCell>{c.municipio}{c.uf ? '/' + c.uf : ''}</TableCell>
                <TableCell>{(c as any).gestor_carteira || '—'}</TableCell>
                <TableCell><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <ImportClientesDialog open={importOpen} onOpenChange={setImportOpen} onDone={reload}/>
    </div>
  );
}