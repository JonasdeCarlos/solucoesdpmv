import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useBhAll, getDailyMinutes, getTrendThreshold } from '@/hooks/useBancoHorasModulo';
import { classifyFaixa, classifyTrend, toDays, formatHHMM, competenciaLabel } from '@/utils/bancoHoras/calc';
import { SaldoChip } from '@/components/bancohoras/SaldoChip';
import { TrendArrow } from '@/components/bancohoras/TrendArrow';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function BhEmployeesPage() {
  const { employees, balances, settings, loading } = useBhAll();
  const meses = useMemo(() => [...new Set(balances.map((b) => b.competencia))].sort().reverse(), [balances]);
  const [mes, setMes] = useState<string>('');
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  const competencia = mes || meses[0] || '';
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const threshold = getTrendThreshold(settings);

  const rows = useMemo(() => {
    return balances
      .filter((b) => b.competencia === competencia)
      .map((b) => {
        const emp = empById.get(b.employee_id);
        const dailyMin = emp ? getDailyMinutes(settings, b.empresa_cnpj, b.employee_id, emp.daily_minutes_override) : 480;
        const ano = parseInt(b.competencia.slice(0, 4), 10);
        const mesNum = parseInt(b.competencia.slice(5, 7), 10);
        const prevKey = `${mesNum === 1 ? ano - 1 : ano}-${String(mesNum === 1 ? 12 : mesNum - 1).padStart(2, '0')}-01`;
        const prev = balances.find((x) => x.employee_id === b.employee_id && x.competencia === prevKey);
        const variacao = prev ? b.balance_minutes - prev.balance_minutes : null;
        return {
          ...b,
          emp,
          dias: toDays(b.balance_minutes, dailyMin),
          variacao,
          tend: classifyTrend(b.balance_minutes, prev?.balance_minutes ?? null, threshold),
        };
      })
      .sort((a, b) => (a.emp?.nome || '').localeCompare(b.emp?.nome || ''));
  }, [balances, competencia, empById, settings, threshold]);

  const detalhe = useMemo(() => {
    if (!selectedEmp) return [];
    return balances
      .filter((b) => b.employee_id === selectedEmp)
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map((b) => ({
        competencia: competenciaLabel(b.competencia),
        saldoMin: b.balance_minutes,
        saldo: Math.round((b.balance_minutes / 60) * 10) / 10,
      }));
  }, [balances, selectedEmp]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Competência</Label>
            <Select value={competencia} onValueChange={setMes}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {meses.map((m) => <SelectItem key={m} value={m}>{competenciaLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Colaboradores</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Cód.</th>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Empresa</th>
                <th className="p-2 text-left">BSALDO</th>
                <th className="p-2 text-right">Dias</th>
                <th className="p-2 text-left">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b cursor-pointer hover:bg-muted/40 ${selectedEmp === r.employee_id ? 'bg-muted/60' : ''}`}
                  onClick={() => setSelectedEmp(r.employee_id)}
                >
                  <td className="p-2 font-mono">{r.emp?.codigo}</td>
                  <td className="p-2">{r.emp?.nome}</td>
                  <td className="p-2 text-muted-foreground">{r.emp?.empresa_nome}</td>
                  <td className="p-2"><SaldoChip minutes={r.balance_minutes} /></td>
                  <td className="p-2 text-right font-mono">{r.dias.toFixed(2)}</td>
                  <td className="p-2"><TrendArrow tend={r.tend as any} delta={r.variacao} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedEmp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Histórico — {empById.get(selectedEmp)?.nome}
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={detalhe}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="competencia" />
                <YAxis />
                <Tooltip formatter={(v: any, _n, p: any) => formatHHMM(p.payload.saldoMin)} />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
