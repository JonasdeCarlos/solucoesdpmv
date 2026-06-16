import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Search, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

type Row = {
  id: string; client_id: string; sindicato: string; uf: string; union_base: string;
  data_base: string; validity_start: string | null; validity_end: string | null;
  is_active: boolean; deleted_at: string | null;
  cliente_nome?: string; codigo_cliente?: string;
};

function statusVigencia(end: string | null): { label: string; tone: 'ok' | 'soon' | 'expired' | 'none'; dias: number | null } {
  if (!end) return { label: 'Sem vigência', tone: 'none', dias: null };
  const dias = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: `Vencida há ${Math.abs(dias)}d`, tone: 'expired', dias };
  if (dias <= 90) return { label: `Vence em ${dias}d`, tone: 'soon', dias };
  return { label: `Vigente (${dias}d)`, tone: 'ok', dias };
}

export default function GestaoCctPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<'todos' | 'vigente' | 'vencendo' | 'vencida' | 'sem'>('todos');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('client_ccts' as any)
        .select('id, client_id, sindicato, uf, union_base, data_base, validity_start, validity_end, is_active, deleted_at, clientes:client_id(nome, codigo_cliente)')
        .order('validity_end', { ascending: true, nullsFirst: false });
      const list: Row[] = ((data || []) as any[])
        .filter((c) => !c.deleted_at && c.is_active !== false)
        .map((c) => ({
          id: c.id, client_id: c.client_id, sindicato: c.sindicato, uf: c.uf,
          union_base: c.union_base, data_base: c.data_base,
          validity_start: c.validity_start, validity_end: c.validity_end,
          is_active: c.is_active, deleted_at: c.deleted_at,
          cliente_nome: c.clientes?.nome || '',
          codigo_cliente: c.clientes?.codigo_cliente || '',
        }));
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows.filter((r) => {
      const st = statusVigencia(r.validity_end);
      if (statusF === 'vigente' && st.tone !== 'ok') return false;
      if (statusF === 'vencendo' && st.tone !== 'soon') return false;
      if (statusF === 'vencida' && st.tone !== 'expired') return false;
      if (statusF === 'sem' && st.tone !== 'none') return false;
      if (!s) return true;
      return (r.sindicato + ' ' + (r.cliente_nome || '') + ' ' + (r.codigo_cliente || '') + ' ' + r.uf + ' ' + r.union_base).toLowerCase().includes(s);
    });
  }, [rows, q, statusF]);

  const counts = useMemo(() => {
    const c = { ok: 0, soon: 0, expired: 0, none: 0 };
    rows.forEach((r) => { c[statusVigencia(r.validity_end).tone]++; });
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" onClick={() => nav('/sucesso-cliente')} className="mb-1"><ChevronLeft className="w-4 h-4"/>Voltar</Button>
        <h2 className="text-2xl font-bold">Gestão de CCT</h2>
        <p className="text-sm text-muted-foreground">Vigência das CCTs cadastradas, agregadas por cliente.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Vigentes</div><div className="text-2xl font-bold text-emerald-600">{counts.ok}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Vencendo (≤90d)</div><div className="text-2xl font-bold text-amber-600">{counts.soon}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3"/>Vencidas</div><div className="text-2xl font-bold text-destructive">{counts.expired}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Sem vigência</div><div className="text-2xl font-bold">{counts.none}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Busca</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Sindicato, cliente, código, UF…" className="pl-8"/>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusF} onValueChange={(v)=>setStatusF(v as any)}>
            <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="vigente">Vigentes</SelectItem>
              <SelectItem value="vencendo">Vencendo (≤90d)</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="sem">Sem vigência</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Sindicato</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Data-base</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma CCT.</TableCell></TableRow>
            ) : filtered.map((r) => {
              const st = statusVigencia(r.validity_end);
              const variant = st.tone === 'ok' ? 'default' : st.tone === 'soon' ? 'outline' : st.tone === 'expired' ? 'destructive' : 'secondary';
              return (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={()=>nav(`/sucesso-cliente/${r.client_id}`)}>
                  <TableCell className="font-medium">{r.cliente_nome || '—'}{r.codigo_cliente ? <span className="text-xs text-muted-foreground ml-2">#{r.codigo_cliente}</span> : null}</TableCell>
                  <TableCell>{r.sindicato || '—'}</TableCell>
                  <TableCell>{r.uf || '—'}</TableCell>
                  <TableCell>{r.data_base || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {r.validity_start ? new Date(r.validity_start).toLocaleDateString('pt-BR') : '—'}
                    {' a '}
                    {r.validity_end ? new Date(r.validity_end).toLocaleDateString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell><Badge variant={variant as any}>{st.label}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}