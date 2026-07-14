import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertTriangle, CheckCircle2, XCircle, FileText, Plus, ArrowRightLeft, Bell, Loader2, Check } from 'lucide-react';
import { useCctAnalyses, type CctAnalysis } from '@/hooks/cct/useCctAnalyses';
import { useCctAlerts } from '@/hooks/cct/useCctAlerts';
import { toast } from 'sonner';
import { useState as useReactState } from 'react';

type LinkedRow = {
  id: string;
  client_id: string;
  sindicato: string;
  uf: string;
  validity_end: string | null;
  data_base: string;
  cliente_nome?: string;
  codigo_cliente?: string;
  cct_analysis_id: string | null;
};

function statusVigencia(end: string | null) {
  if (!end) return { label: 'Sem vigência', tone: 'none' as const, dias: null };
  const dias = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: `Vencida há ${Math.abs(dias)}d`, tone: 'expired' as const, dias };
  if (dias <= 90) return { label: `Vence em ${dias}d`, tone: 'soon' as const, dias };
  return { label: `Vigente (${dias}d)`, tone: 'ok' as const, dias };
}

function statusAnaliseBadge(s: CctAnalysis['status']) {
  const map: Record<string, { label: string; variant: any }> = {
    em_analise: { label: 'Em análise', variant: 'secondary' },
    revisar: { label: 'Revisar', variant: 'outline' },
    aprovada: { label: 'Aprovada', variant: 'default' },
    arquivada: { label: 'Arquivada', variant: 'secondary' },
    substituida: { label: 'Substituída', variant: 'secondary' },
  };
  return map[s] || { label: s, variant: 'secondary' };
}

export default function GestaoCctDashboardPage() {
  const nav = useNavigate();
  const { items: analyses, loading: loadingA } = useCctAnalyses();
  const { items: alerts, refresh: refreshAlerts, resolve: resolveAlert, loading: loadingAlerts } = useCctAlerts();
  const [refreshingAlerts, setRefreshingAlerts] = useReactState(false);
  const [rows, setRows] = useState<LinkedRow[]>([]);
  const [loadingR, setLoadingR] = useState(true);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'analises' | 'vinculos'>('analises');
  const [statusF, setStatusF] = useState<'todos' | 'vigente' | 'vencendo' | 'vencida' | 'sem'>('todos');

  useEffect(() => {
    (async () => {
      setLoadingR(true);
      const { data } = await supabase
        .from('client_ccts' as any)
        .select('id, client_id, sindicato, uf, data_base, validity_end, cct_analysis_id, is_active, deleted_at, clientes:client_id(nome, codigo_cliente)')
        .order('validity_end', { ascending: true, nullsFirst: false });
      const list: LinkedRow[] = ((data || []) as any[])
        .filter((c) => !c.deleted_at && c.is_active !== false)
        .map((c) => ({
          id: c.id,
          client_id: c.client_id,
          sindicato: c.sindicato,
          uf: c.uf,
          validity_end: c.validity_end,
          data_base: c.data_base,
          cliente_nome: c.clientes?.nome || '',
          codigo_cliente: c.clientes?.codigo_cliente || '',
          cct_analysis_id: c.cct_analysis_id || null,
        }));
      setRows(list);
      setLoadingR(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const c = { ok: 0, soon: 0, expired: 0, none: 0 };
    rows.forEach((r) => { c[statusVigencia(r.validity_end).tone]++; });
    return c;
  }, [rows]);

  const semRevisao = useMemo(() => analyses.filter((a) => a.status !== 'aprovada' && a.status !== 'arquivada' && a.status !== 'substituida').length, [analyses]);

  const doRefreshAlerts = async () => {
    setRefreshingAlerts(true);
    const { data, error } = await refreshAlerts();
    setRefreshingAlerts(false);
    if (error) toast.error(error.message || 'Falha ao atualizar alertas.');
    else toast.success(`Alertas atualizados${data && (data as any).created != null ? ` (${(data as any).created})` : ''}.`);
  };

  const filteredAnalyses = useMemo(() => {
    const s = q.toLowerCase().trim();
    return analyses.filter((a) => (a.title || '').toLowerCase().includes(s));
  }, [analyses, q]);

  const filteredRows = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows.filter((r) => {
      const st = statusVigencia(r.validity_end);
      if (statusF === 'vigente' && st.tone !== 'ok') return false;
      if (statusF === 'vencendo' && st.tone !== 'soon') return false;
      if (statusF === 'vencida' && st.tone !== 'expired') return false;
      if (statusF === 'sem' && st.tone !== 'none') return false;
      if (!s) return true;
      return (r.sindicato + ' ' + (r.cliente_nome || '') + ' ' + (r.codigo_cliente || '') + ' ' + r.uf).toLowerCase().includes(s);
    });
  }, [rows, q, statusF]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Gestão de CCT — Convenções Coletivas</h2>
          <p className="text-sm text-muted-foreground">Central completa: upload, Raio-X inteligente, vinculação, alertas e replicação.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav('/sucesso-cliente/gestao-cct')}><ArrowRightLeft className="w-4 h-4 mr-1"/>Ver por cliente</Button>
          <Button onClick={() => nav('/gestao-cct/nova')}><Plus className="w-4 h-4 mr-1"/>Nova CCT</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Vigentes</div><div className="text-2xl font-bold text-emerald-600">{counts.ok}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Vencendo ≤90d</div><div className="text-2xl font-bold text-amber-600">{counts.soon}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3"/>Vencidas</div><div className="text-2xl font-bold text-destructive">{counts.expired}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Sem vigência</div><div className="text-2xl font-bold">{counts.none}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3"/>Sem revisão</div><div className="text-2xl font-bold">{semRevisao}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Alertas abertos <Badge variant="secondary">{alerts.length}</Badge></div>
            <Button size="sm" variant="outline" onClick={doRefreshAlerts} disabled={refreshingAlerts}>
              {refreshingAlerts ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Bell className="w-4 h-4 mr-1" />}
              Recalcular alertas
            </Button>
          </div>
          {loadingAlerts ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta aberto. Clique em "Recalcular alertas" para varrer as CCTs vinculadas.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.slice(0, 20).map((al) => (
                <div key={al.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                  <Badge variant={al.severity === 'alta' ? 'destructive' : al.severity === 'media' ? 'outline' : 'secondary'}>{al.severity}</Badge>
                  <span className="flex-1">{al.message}</span>
                  {al.due_date && <span className="text-xs text-muted-foreground">{new Date(al.due_date).toLocaleDateString('pt-BR')}</span>}
                  {al.cct_analysis_id && <Button size="sm" variant="ghost" onClick={() => nav(`/gestao-cct/${al.cct_analysis_id}`)}>Abrir</Button>}
                  <Button size="sm" variant="ghost" onClick={() => resolveAlert(al.id)}><Check className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b">
        <button className={`px-3 py-2 text-sm font-medium border-b-2 ${tab==='analises'?'border-primary text-primary':'border-transparent text-muted-foreground'}`} onClick={()=>setTab('analises')}>Raio-X / Análises ({analyses.length})</button>
        <button className={`px-3 py-2 text-sm font-medium border-b-2 ${tab==='vinculos'?'border-primary text-primary':'border-transparent text-muted-foreground'}`} onClick={()=>setTab('vinculos')}>Vínculos por cliente ({rows.length})</button>
      </div>

      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Busca</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Título, sindicato, cliente…" className="pl-8"/>
          </div>
        </div>
        {tab === 'vinculos' && (
          <div>
            <label className="text-xs text-muted-foreground">Status vigência</label>
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
        )}
      </CardContent></Card>

      {tab === 'analises' ? (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>OCR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loadingA ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              ) : filteredAnalyses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma análise. Clique em <b>Nova CCT</b> para começar.</TableCell></TableRow>
              ) : filteredAnalyses.map((a) => {
                const b = statusAnaliseBadge(a.status);
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => nav(`/gestao-cct/${a.id}`)}>
                    <TableCell className="font-medium">{a.title || 'Sem título'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.original_file_name || '—'}</TableCell>
                    <TableCell><Badge variant={a.ocr_applied ? 'default' : 'secondary'}>{a.ocr_applied ? 'Aplicado' : 'Não'}</Badge></TableCell>
                    <TableCell><Badge variant={b.variant}>{b.label}</Badge></TableCell>
                    <TableCell>{a.confidence_score != null ? `${Number(a.confidence_score).toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Sindicato</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Data-base</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Raio-X</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loadingR ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum vínculo.</TableCell></TableRow>
              ) : filteredRows.map((r) => {
                const st = statusVigencia(r.validity_end);
                const variant = st.tone === 'ok' ? 'default' : st.tone === 'soon' ? 'outline' : st.tone === 'expired' ? 'destructive' : 'secondary';
                return (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium cursor-pointer" onClick={() => nav(`/sucesso-cliente/${r.client_id}`)}>{r.cliente_nome || '—'}{r.codigo_cliente ? <span className="text-xs text-muted-foreground ml-2">#{r.codigo_cliente}</span> : null}</TableCell>
                    <TableCell>{r.sindicato || '—'}</TableCell>
                    <TableCell>{r.uf || '—'}</TableCell>
                    <TableCell>{r.data_base || '—'}</TableCell>
                    <TableCell><Badge variant={variant as any}>{st.label}</Badge></TableCell>
                    <TableCell>
                      {r.cct_analysis_id ? (
                        <Button size="sm" variant="outline" onClick={() => nav(`/gestao-cct/${r.cct_analysis_id}`)}>Abrir</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem análise</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}