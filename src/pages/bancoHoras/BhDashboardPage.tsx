import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, FileText, ImagePlus, X, AlertTriangle, CalendarRange } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useBhAll, getDailyMinutes, getTrendThreshold } from '@/hooks/useBancoHorasModulo';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocument } from 'pdf-lib';
import {
  classifyFaixa, formatHHMM, classifyTrend, toDays, FAIXA_CLASS, FAIXA_LABEL, competenciaLabel,
} from '@/utils/bancoHoras/calc';
import { SaldoChip } from '@/components/bancohoras/SaldoChip';
import { TrendArrow } from '@/components/bancohoras/TrendArrow';
import { exportCsv, exportPdf, ReportRow, loadMonteVerdeLogo } from '@/utils/bancoHoras/exporters';

type FaixaFilter = 'todos' | 'verde' | 'amarelo' | 'laranja' | 'vermelho';
type SinalFilter = 'todos' | 'positivo' | 'negativo' | 'zero';

export default function BhDashboardPage() {
  const { imports, employees, balances, settings, loading } = useBhAll();

  // Logo da empresa (persistida em localStorage por CNPJ)
  const [empresaLogo, setEmpresaLogo] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Período do banco (data início / fim) — persistido em localStorage por CNPJ
  const [periodoInicio, setPeriodoInicio] = useState<string>('');
  const [periodoFim, setPeriodoFim] = useState<string>('');

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

  useEffect(() => {
    if (empresa === 'all') { setEmpresaLogo(''); return; }
    const k = `bh:logo:${empresa}`;
    setEmpresaLogo(localStorage.getItem(k) || '');
  }, [empresa]);

  useEffect(() => {
    const scope = empresa === 'all' ? 'all' : empresa;
    setPeriodoInicio(localStorage.getItem(`bh:periodo-ini:${scope}`) || '');
    setPeriodoFim(localStorage.getItem(`bh:periodo-fim:${scope}`) || '');
  }, [empresa]);

  const savePeriodo = (ini: string, fim: string) => {
    const scope = empresa === 'all' ? 'all' : empresa;
    if (ini) localStorage.setItem(`bh:periodo-ini:${scope}`, ini);
    else localStorage.removeItem(`bh:periodo-ini:${scope}`);
    if (fim) localStorage.setItem(`bh:periodo-fim:${scope}`, fim);
    else localStorage.removeItem(`bh:periodo-fim:${scope}`);
  };

  const periodoDias = useMemo(() => {
    if (!periodoInicio || !periodoFim) return null;
    const a = new Date(periodoInicio + 'T00:00:00');
    const b = new Date(periodoFim + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return null;
    return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
  }, [periodoInicio, periodoFim]);

  const periodoFaixa = useMemo<'verde'|'amarelo'|'laranja'|'vermelho'|'alerta'|null>(() => {
    if (periodoDias == null) return null;
    if (periodoDias > 180) return 'alerta';
    if (periodoDias >= 151) return 'vermelho';
    if (periodoDias >= 121) return 'laranja';
    if (periodoDias >= 101) return 'amarelo';
    return 'verde';
  }, [periodoDias]);

  const onPickLogo = async (f: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      setEmpresaLogo(data);
      if (empresa !== 'all') localStorage.setItem(`bh:logo:${empresa}`, data);
    };
    reader.readAsDataURL(f);
  };
  const clearLogo = () => {
    setEmpresaLogo('');
    if (empresa !== 'all') localStorage.removeItem(`bh:logo:${empresa}`);
  };

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

  // Memória de cálculo (evolução mensal por competência)
  const memoriaEvolucao = useMemo(() => {
    const map = new Map<string, { saldoMin: number; colabs: number }>();
    filteredBalances.forEach((b) => {
      const cur = map.get(b.competencia) || { saldoMin: 0, colabs: 0 };
      cur.saldoMin += b.balance_minutes;
      cur.colabs += 1;
      map.set(b.competencia, cur);
    });
    return Array.from(map.entries()).sort().map(([competencia, v]) => ({ competencia, ...v }));
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
    const list = balancesUltimoMes.map((b) => {
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
    // Ordena alfabeticamente por nome (pt-BR, ignorando acentos/caixa)
    return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [balancesUltimoMes, balances, empById, settings, threshold]);

  const empregadosFiltrados = useMemo(() => {
    if (empresa === 'all') return employees;
    return employees.filter((e) => e.empresa_cnpj === empresa);
  }, [employees, empresa]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const meses = [...new Set(balances.map((b) => b.competencia.slice(0, 7)))].sort();

  const empresaLabelStr = empresa === 'all'
    ? 'Todas as empresas'
    : (empresas.find((e) => e.cnpj === empresa)?.nome || empresa);

  const handleExportPdf = async () => {
    try {
    const logoMV = await loadMonteVerdeLogo();
    // Resolve logo da empresa: usa a selecionada; se "Todas", tenta usar a única CNPJ do mês
    let logoEmp = empresaLogo;
    if (!logoEmp) {
      const cnpjs = [...new Set(balancesUltimoMes.map((b) => b.empresa_cnpj).filter(Boolean))];
      if (cnpjs.length === 1) {
        logoEmp = localStorage.getItem(`bh:logo:${cnpjs[0]}`) || '';
      }
    }
    const reportBytes = await exportPdf(reportRows, {
      titulo: 'Relatório gerencial — Banco de Horas',
      empresaLabel: empresaLabelStr,
      competenciaLabel: ultimoMes ? competenciaLabel(ultimoMes) : undefined,
      logoMonteVerdeDataUrl: logoMV,
      logoEmpresaDataUrl: logoEmp || undefined,
      kpis: {
        totalColabs,
        saldoConsolidadoMin: saldoConsolidado,
        distFaixa,
      },
      periodo: periodoDias != null ? {
        inicio: periodoInicio,
        fim: periodoFim,
        dias: periodoDias,
        faixa: periodoFaixa!,
      } : undefined,
      evolucao: memoriaEvolucao,
      distMes: distMes.map((d: any) => ({
        competencia: d.competencia,
        verde: d.verde || 0,
        amarelo: d.amarelo || 0,
        laranja: d.laranja || 0,
        vermelho: d.vermelho || 0,
      })),
      topPos: top10Pos.map((b) => {
        const e = empById.get(b.employee_id);
        return { nome: e?.nome || '', codigo: e?.codigo, minutes: b.balance_minutes };
      }),
      topNeg: top10Neg.map((b) => {
        const e = empById.get(b.employee_id);
        return { nome: e?.nome || '', codigo: e?.codigo, minutes: b.balance_minutes };
      }),
    });

    // Anexa os PDFs de cartão ponto importados no último mês (filtrados pela empresa se houver)
    const merged = await PDFDocument.create();
    const reportDoc = await PDFDocument.load(reportBytes);
    const reportPages = await merged.copyPages(reportDoc, reportDoc.getPageIndices());
    reportPages.forEach((p) => merged.addPage(p));

    if (ultimoMes) {
      const importsUltMes = imports.filter((i) => {
        if (!i.file_path) return false;
        if (i.competencia !== ultimoMes) return false;
        if (empresa !== 'all' && i.empresa_cnpj !== empresa) return false;
        return true;
      });
      for (const imp of importsUltMes) {
        try {
          const { data, error } = await supabase.storage.from('ponto-pdfs').download(imp.file_path!);
          if (error || !data) continue;
          const buf = await data.arrayBuffer();
          const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
          const pages = await merged.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        } catch (err) {
          console.warn('Falha ao anexar ponto:', imp.file_name, err);
        }
      }
    }

    const out = await merged.save();
    const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banco-horas-${ultimoMes || 'periodo'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Erro ao exportar PDF:', e);
      // eslint-disable-next-line no-alert
      alert(`Falha ao gerar PDF: ${e?.message || e}`);
    }
  };

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

      {empresa !== 'all' && (
        <Card>
          <CardContent className="pt-4 flex items-center gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">Logo da empresa (aparece no PDF):</div>
            {empresaLogo ? (
              <div className="flex items-center gap-2">
                <img src={empresaLogo} alt="Logo empresa" className="h-10 w-auto object-contain border rounded p-1 bg-white" />
                <Button size="sm" variant="ghost" onClick={clearLogo}><X className="w-3 h-3 mr-1" /> Remover</Button>
              </div>
            ) : (
              <>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPickLogo(e.target.files[0])}
                />
                <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                  <ImagePlus className="w-3 h-3 mr-1" /> Adicionar logo
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Período do Banco de Horas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            Período do Banco de Horas
            {empresa !== 'all' && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                — {empresaLabelStr}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {empresa === 'all' ? (
            <div className="rounded border border-dashed p-4 text-sm text-muted-foreground bg-muted/30">
              Selecione uma <strong>empresa</strong> no filtro acima para cadastrar e gerenciar o período do banco
              de horas. Cada empresa possui suas próprias datas de início e fim, salvas automaticamente.
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs">Data de início</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => { setPeriodoInicio(e.target.value); savePeriodo(e.target.value, periodoFim); }}
              />
            </div>
            <div>
              <Label className="text-xs">Data fim</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => { setPeriodoFim(e.target.value); savePeriodo(periodoInicio, e.target.value); }}
              />
            </div>
            <div>
              {periodoDias != null ? (
                <div className={`rounded border px-3 py-2 text-sm font-medium ${
                  periodoFaixa === 'verde' ? 'bg-green-100 text-green-800 border-green-300' :
                  periodoFaixa === 'amarelo' ? 'bg-yellow-100 text-yellow-900 border-yellow-300' :
                  periodoFaixa === 'laranja' ? 'bg-orange-100 text-orange-900 border-orange-300' :
                  'bg-red-100 text-red-800 border-red-300'
                }`}>
                  {periodoDias} dia{periodoDias === 1 ? '' : 's'} de banco
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Informe início e fim para calcular.</div>
              )}
            </div>
          </div>

          {periodoFaixa === 'alerta' && (
            <div className="flex items-start gap-3 p-3 rounded border-2 border-red-500 bg-red-50">
              <AlertTriangle className="w-8 h-8 text-yellow-500 fill-yellow-300 flex-shrink-0" strokeWidth={2.5} />
              <div>
                <p className="text-sm font-bold text-red-700">Atenção — Banco supera 180 dias</p>
                <p className="text-sm text-red-700">Banco supera 180 dias, verifique a situação.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="px-2 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">Até 100 dias — Verde</span>
            <span className="px-2 py-0.5 rounded border bg-yellow-100 text-yellow-900 border-yellow-300">101–120 — Amarelo</span>
            <span className="px-2 py-0.5 rounded border bg-orange-100 text-orange-900 border-orange-300">121–150 — Laranja</span>
            <span className="px-2 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">151–180 — Vermelho</span>
            <span className="px-2 py-0.5 rounded border border-red-500 bg-red-50 text-red-700">&gt; 180 — Alerta</span>
          </div>
          </>
          )}
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
          <Button size="sm" variant="outline" onClick={handleExportPdf}>
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
