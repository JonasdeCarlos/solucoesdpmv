import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useBhAll, getDailyMinutes, getTrendThreshold } from '@/hooks/useBancoHorasModulo';
import {
  classifyFaixa, formatHHMM, classifyTrend, toDays, FAIXA_CLASS, FAIXA_LABEL, competenciaLabel,
} from '@/utils/bancoHoras/calc';
import { SaldoChip } from '@/components/bancohoras/SaldoChip';
import { TrendArrow } from '@/components/bancohoras/TrendArrow';
import { exportCsv, exportPdf, ReportRow } from '@/utils/bancoHoras/exporters';

type FaixaFilter = 'todos' | 'verde' | 'amarelo' | 'laranja' | 'vermelho';
type SinalFilter = 'todos' | 'positivo' | 'negativo' | 'zero';

export default function BhDashboardPage() {
  const { imports, employees, balances, settings, loading } = useBhAll();

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => e.empresa_cnpj && map.set(e.empresa_cnpj, e.empresa_nome || e.empresa_cnpj));
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [employees]);

  const [empresa, setEmpresa] = useState<string>('all');
  const [empregado, setEmpregado] = useState<string>('all');
  const [faixa, setFaixa] = useState<FaixaFilter>('todos');
  const [sinal, setSinal] = useState<SinalFilter>('todos');
  const [compIni, setCompIni] = useState<string>('');
  const [compFim, setCompFim] = useState<string>('');

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      if (empresa !== 'all' && b.empresa_cnpj !== empresa) return false;
      if (empregado !== 'all' && b.employee_id !== empregado) return false;
      if (compIni && b.competencia < `${compIni}-01`) return false;
      if (compFim && b.competencia > `${compFim}-31`) return false;
      const f = classifyFaixa(b.balance_minutes);
      if (faixa !== 'todos' && f !== faixa) return false;
      if (sinal === 'positivo' && b.balance_minutes <= 0) return false;
      if (sinal === 'negativo' && b.balance_minutes >= 0) return false;
      if (sinal === 'zero' && b.balance_minutes !== 0) return false;
      return true;
    });
  }, [balances, empresa, empregado, compIni, compFim, faixa, sinal]);

  // último mês do período filtrado
  const ultimoMes = useMemo(() => {
    const meses = [...new Set(filteredBalances.map((b) => b.competencia))].sort();
    return meses[meses.length - 1] || null;
  }, [filteredBalances]);

  const balancesUltimoMes = useMemo(
    () => filteredBalances.filter((b) => b.competencia === ultimoMes),
    [filteredBalances, ultimoMes],
  );

  // KPIs
  const totalColabs = balancesUltimoMes.length;
  const saldoConsolidado = balancesUltimoMes.reduce((s, b) => s + b.balance_minutes, 0);
  const distFaixa = useMemo(() => {
    const d: Record<string, number> = { verde: 0, amarelo: 0, laranja: 0, vermelho: 0 };
    balancesUltimoMes.forEach((b) => { d[classifyFaixa(b.balance_minutes)]++; });
    return d;
  }, [balancesUltimoMes]);

  const top10Pos = useMemo(() => [...balancesUltimoMes]
    .filter((b) => b.balance_minutes > 0)
    .sort((a, b) => b.balance_minutes - a.balance_minutes).slice(0, 10), [balancesUltimoMes]);
  const top10Neg = useMemo(() => [...balancesUltimoMes]
    .filter((b) => b.balance_minutes < 0)
    .sort((a, b) => a.balance_minutes - b.balance_minutes).slice(0, 10), [balancesUltimoMes]);

  // série mensal (saldo total)
  const serieMensal = useMemo(() => {
    const map = new Map<string, number>();
    filteredBalances.forEach((b) => {
      map.set(b.competencia, (map.get(b.competencia) || 0) + b.balance_minutes);
    });
    return Array.from(map.entries()).sort().map(([c, m]) => ({
      competencia: competenciaLabel(c),
      saldo: Math.round((m / 60) * 10) / 10,
      saldoMin: m,
    }));
  }, [filteredBalances]);

  // distribuição por faixa por mês (empilhado)
  const distMes = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    filteredBalances.forEach((b) => {
      const k = b.competencia;
      const f = classifyFaixa(b.balance_minutes);
      if (!map.has(k)) map.set(k, { verde: 0, amarelo: 0, laranja: 0, vermelho: 0 });
      map.get(k)![f]++;
    });
    return Array.from(map.entries()).sort().map(([c, d]) => ({ competencia: competenciaLabel(c), ...d }));
  }, [filteredBalances]);

  // série por colaborador (se selecionado)
  const serieEmpregado = useMemo(() => {
    if (empregado === 'all') return [];
    return filteredBalances
      .filter((b) => b.employee_id === empregado)
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map((b) => ({
        competencia: competenciaLabel(b.competencia),
        saldoMin: b.balance_minutes,
        saldo: Math.round((b.balance_minutes / 60) * 10) / 10,
      }));
  }, [filteredBalances, empregado]);

  const threshold = getTrendThreshold(settings);

  // monta linhas do relatório com tendência
  const reportRows = useMemo<ReportRow[]>(() => {
    return balancesUltimoMes.map((b) => {
      const emp = empById.get(b.employee_id);
      const dailyMin = emp ? getDailyMinutes(settings, b.empresa_cnpj, b.employee_id, emp.daily_minutes_override) : 480;
      // mês anterior
      const ano = parseInt(b.competencia.slice(0, 4), 10);
      const mes = parseInt(b.competencia.slice(5, 7), 10);
      const prevMes = mes === 1 ? 12 : mes - 1;
      const prevAno = mes === 1 ? ano - 1 : ano;
      const prevKey = `${prevAno}-${String(prevMes).padStart(2, '0')}-01`;
      const prev = balances.find((x) => x.employee_id === b.employee_id && x.competencia === prevKey);
      const variacao = prev ? b.balance_minutes - prev.balance_minutes : null;
      const tend = classifyTrend(b.balance_minutes, prev?.balance_minutes ?? null, threshold);
      return {
        empresa: emp?.empresa_nome || '',
        competencia: b.competencia,
        codigo: emp?.codigo || '',
        nome: emp?.nome || '',
        bsaldo: formatHHMM(b.balance_minutes),
        minutes: b.balance_minutes,
        dias: toDays(b.balance_minutes, dailyMin),
        faixa: classifyFaixa(b.balance_minutes),
        tendencia: tend,
        variacao,
      };
    });
  }, [balancesUltimoMes, balances, empById, settings, threshold]);

  const empregadosFiltrados = useMemo(() => {
    if (empresa === 'all') return employees;
    return employees.filter((e) => e.empresa_cnpj === empresa);
  }, [employees, empresa]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const meses = [...new Set(balances.map((b) => b.competencia.slice(0, 7)))].sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={empresa} onValueChange={(v) => { setEmpresa(v); setEmpregado('all'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Colaborador</Label>
            <Select value={empregado} onValueChange={setEmpregado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {empregadosFiltrados.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Compet. inicial</Label>
            <Input type="month" value={compIni} onChange={(e) => setCompIni(e.target.value)} list="bh-meses" />
          </div>
          <div>
            <Label className="text-xs">Compet. final</Label>
            <Input type="month" value={compFim} onChange={(e) => setCompFim(e.target.value)} />
            <datalist id="bh-meses">{meses.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <Label className="text-xs">Faixa</Label>
            <Select value={faixa} onValueChange={(v) => setFaixa(v as FaixaFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="verde">Verde</SelectItem>
                <SelectItem value="amarelo">Amarelo</SelectItem>
                <SelectItem value="laranja">Laranja</SelectItem>
                <SelectItem value="vermelho">Vermelho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Sinal</Label>
            <Select value={sinal} onValueChange={(v) => setSinal(v as SinalFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="positivo">Positivo</SelectItem>
                <SelectItem value="negativo">Negativo</SelectItem>
                <SelectItem value="zero">Zerado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Colaboradores no mês</p>
          <p className="text-2xl font-bold">{totalColabs}</p>
          <p className="text-xs text-muted-foreground">{ultimoMes ? competenciaLabel(ultimoMes) : '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Saldo consolidado</p>
          <p className="text-2xl font-bold font-mono">{formatHHMM(saldoConsolidado)}</p>
          <p className="text-xs text-muted-foreground">soma do mês</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-2">Distribuição por faixa</p>
          <div className="space-y-1">
            {(['verde', 'amarelo', 'laranja', 'vermelho'] as const).map((f) => (
              <div key={f} className="flex items-center justify-between text-xs">
                <span className={`px-1.5 py-0.5 rounded border ${FAIXA_CLASS[f]}`}>{FAIXA_LABEL[f]}</span>
                <span className="font-mono">{distFaixa[f]}{totalColabs ? ` (${Math.round(distFaixa[f] * 100 / totalColabs)}%)` : ''}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Exportar relatório</p>
          <Button size="sm" variant="outline" onClick={() => exportCsv(reportRows, `banco-horas-${ultimoMes || 'periodo'}.csv`)}>
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportPdf(reportRows, `Banco de Horas — ${ultimoMes ? competenciaLabel(ultimoMes) : ''}`, `banco-horas-${ultimoMes || 'periodo'}.pdf`)}>
            <FileText className="w-3 h-3 mr-1" /> PDF
          </Button>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução do saldo total (horas)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="competencia" />
                <YAxis />
                <Tooltip formatter={(v: any) => `${v} h`} />
                <Bar dataKey="saldo" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por faixa / mês</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="competencia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="verde" stackId="a" fill="#22c55e" />
                <Bar dataKey="amarelo" stackId="a" fill="#eab308" />
                <Bar dataKey="laranja" stackId="a" fill="#f97316" />
                <Bar dataKey="vermelho" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {empregado !== 'all' && serieEmpregado.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução por colaborador (horas)</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieEmpregado}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="competencia" />
                <YAxis />
                <Tooltip formatter={(v: any) => `${v} h`} />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 saldos positivos</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {top10Pos.map((b) => {
                  const e = empById.get(b.employee_id);
                  return (
                    <tr key={b.id} className="border-b">
                      <td className="p-1.5">{e?.nome}</td>
                      <td className="p-1.5 text-right"><SaldoChip minutes={b.balance_minutes} /></td>
                    </tr>
                  );
                })}
                {top10Pos.length === 0 && <tr><td className="p-2 text-muted-foreground">—</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 saldos negativos</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {top10Neg.map((b) => {
                  const e = empById.get(b.employee_id);
                  return (
                    <tr key={b.id} className="border-b">
                      <td className="p-1.5">{e?.nome}</td>
                      <td className="p-1.5 text-right"><SaldoChip minutes={b.balance_minutes} /></td>
                    </tr>
                  );
                })}
                {top10Neg.length === 0 && <tr><td className="p-2 text-muted-foreground">—</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalhe — {ultimoMes ? competenciaLabel(ultimoMes) : '—'}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Cód.</th>
                <th className="p-2 text-left">Colaborador</th>
                <th className="p-2 text-left">BSALDO</th>
                <th className="p-2 text-right">Dias</th>
                <th className="p-2 text-left">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r) => (
                <tr key={`${r.codigo}-${r.nome}`} className="border-b">
                  <td className="p-2 font-mono">{r.codigo}</td>
                  <td className="p-2">{r.nome}</td>
                  <td className="p-2"><SaldoChip minutes={r.minutes} /></td>
                  <td className="p-2 text-right font-mono">{r.dias.toFixed(2)}</td>
                  <td className="p-2"><TrendArrow tend={r.tendencia as any} delta={r.variacao} /></td>
                </tr>
              ))}
              {reportRows.length === 0 && (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhum saldo encontrado para os filtros atuais.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
