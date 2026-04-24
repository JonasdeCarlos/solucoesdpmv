import { Fragment, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFeriadosExtendidos, useProvisionEntries, useVerbasDsr, useDsrResults } from '@/hooks/useDsrModule';
import { apurarDsr, contarDiasMes, exportarCsvApuracao } from '@/utils/dsrCalculations';
import { gerarPdfApuracaoDsr, gerarPdfApuracaoDsrAnual } from '@/utils/dsrPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { type ProvisionEntry, type DsrMonthlyResult } from '@/types/dsr';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  empresa: string;
  competencia: string;
}

export default function DsrApuracaoTab({ empresa, competencia }: Props) {
  const { verbas } = useVerbasDsr();
  const { entries } = useProvisionEntries(empresa, competencia);
  const { feriados, overrides } = useFeriadosExtendidos();
  const { saveResult, deleteResult, deletePeriodo } = useDsrResults();
  const [anualMode, setAnualMode] = useState(false);
  const ano = competencia ? Number(competencia.split('-')[0]) : new Date().getFullYear();
  const [entriesAno, setEntriesAno] = useState<ProvisionEntry[]>([]);
  const [loadingAno, setLoadingAno] = useState(false);

  useEffect(() => {
    if (!anualMode || !competencia) return;
    setLoadingAno(true);
    (async () => {
      let q = supabase
        .from('provision_entries' as any)
        .select('*')
        .gte('competencia', `${ano}-01`)
        .lte('competencia', `${ano}-12`);
      if (empresa) q = q.eq('empresa_nome', empresa);
      const { data } = await q;
      setEntriesAno(
        ((data as any[]) || []).map((d) => ({
          id: d.id,
          empresaNome: d.empresa_nome,
          competencia: d.competencia,
          centroCusto: d.centro_custo || '',
          colaborador: d.colaborador || '',
          verbaId: d.verba_id,
          tipoLancamento: d.tipo_lancamento,
          valor: Number(d.valor) || 0,
          quantidade: Number(d.quantidade) || 0,
          valorUnitario: Number(d.valor_unitario) || 0,
          observacao: d.observacao || '',
        })),
      );
      setLoadingAno(false);
    })();
  }, [anualMode, ano, empresa, competencia]);

  const apuracao = useMemo(() => {
    if (!competencia) return null;
    return apurarDsr(empresa, competencia, verbas, entries, feriados, overrides);
  }, [empresa, competencia, verbas, entries, feriados, overrides]);

  const contagem = useMemo(() => {
    if (!competencia) return null;
    return contarDiasMes(competencia, feriados, overrides);
  }, [competencia, feriados, overrides]);

  const apuracoesAno = useMemo(() => {
    if (!anualMode) return [];
    const meses: { competencia: string; resultado: DsrMonthlyResult; erro?: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const comp = `${ano}-${String(m).padStart(2, '0')}`;
      const entriesMes = entriesAno.filter((e) => e.competencia === comp);
      const ap = apurarDsr(empresa, comp, verbas, entriesMes, feriados, overrides);
      meses.push({ competencia: comp, resultado: ap.resultado, erro: ap.erro });
    }
    return meses;
  }, [anualMode, ano, empresa, verbas, entriesAno, feriados, overrides]);

  const totaisAno = useMemo(() => {
    if (!anualMode) return null;
    return apuracoesAno.reduce(
      (acc, m) => ({
        base: acc.base + m.resultado.totalBase,
        dsr: acc.dsr + m.resultado.totalDsr,
      }),
      { base: 0, dsr: 0 },
    );
  }, [anualMode, apuracoesAno]);

  if (!competencia) {
    return <p className="text-sm text-muted-foreground">Selecione uma competência na aba “Lançamentos”.</p>;
  }

  if (!apuracao || !contagem) return null;
  const r = apuracao.resultado;

  const downloadCsv = () => {
    const csv = exportarCsvApuracao(r);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuracao-dsr-${r.competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const { error } = await saveResult(r);
    if (error) toast.error('Erro ao salvar apuração.');
    else toast.success('Apuração salva.');
  };

  const handleClear = async () => {
    if (!confirm(`Limpar apuração salva de ${r.competencia}?`)) return;
    const { error } = await deleteResult(empresa, r.competencia);
    if (error) toast.error('Erro ao limpar apuração.');
    else toast.success('Apuração removida.');
  };

  const handleClearAno = async () => {
    if (!confirm(`Limpar todas as apurações salvas de ${ano}?`)) return;
    const { error } = await deletePeriodo(empresa, `${ano}-01`, `${ano}-12`);
    if (error) toast.error('Erro ao limpar apurações do ano.');
    else toast.success(`Apurações de ${ano} removidas.`);
  };

  const downloadCsvAno = () => {
    const linhas: string[] = ['Competência;Dias úteis;Dias DSR;Total base;Total DSR;Total geral'];
    apuracoesAno.forEach((m) => {
      const r = m.resultado;
      linhas.push(
        [
          r.competencia,
          r.diasUteis,
          r.diasDsr,
          r.totalBase.toFixed(2).replace('.', ','),
          r.totalDsr.toFixed(2).replace('.', ','),
          (r.totalBase + r.totalDsr).toFixed(2).replace('.', ','),
        ].join(';'),
      );
    });
    if (totaisAno) {
      linhas.push(
        [
          `TOTAL ${ano}`,
          '',
          '',
          totaisAno.base.toFixed(2).replace('.', ','),
          totaisAno.dsr.toFixed(2).replace('.', ','),
          (totaisAno.base + totaisAno.dsr).toFixed(2).replace('.', ','),
        ].join(';'),
      );
    }
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuracao-dsr-${ano}-anual.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveAllAno = async () => {
    let ok = 0;
    let fail = 0;
    for (const m of apuracoesAno) {
      if (m.resultado.totalBase === 0 && m.resultado.totalDsr === 0) continue;
      const { error } = await saveResult(m.resultado);
      if (error) fail++;
      else ok++;
    }
    if (fail) toast.error(`${fail} meses falharam.`);
    else toast.success(`${ok} apurações salvas.`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <Label className="text-base">Apurar o ano todo ({ano})</Label>
            <p className="text-xs text-muted-foreground">
              Calcula DSR de janeiro a dezembro de {ano} usando os lançamentos cadastrados em cada competência.
            </p>
          </div>
          <Switch checked={anualMode} onCheckedChange={setAnualMode} />
        </CardContent>
      </Card>

      {anualMode && (
        <Card>
          <CardHeader>
            <CardTitle>Apuração anual — {ano}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAno ? (
              <p className="text-sm text-muted-foreground">Carregando lançamentos do ano…</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {entriesAno.length} lançamento(s) encontrado(s) em {ano}
                  {empresa ? ` para "${empresa}"` : ' (todas as empresas)'}.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-center">DU</TableHead>
                      <TableHead className="text-center">DSR (dias)</TableHead>
                      <TableHead className="text-right">Total base</TableHead>
                      <TableHead className="text-right">Total DSR</TableHead>
                      <TableHead className="text-right">Total geral</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apuracoesAno.map((m) => (
                      <Fragment key={m.competencia}>
                        <TableRow className="bg-muted/20">
                          <TableCell className="font-mono text-xs font-semibold">{m.competencia}</TableCell>
                          <TableCell className="text-center">{m.resultado.diasUteis}</TableCell>
                          <TableCell className="text-center">{m.resultado.diasDsr}</TableCell>
                          <TableCell className="text-right">{fmtBRL(m.resultado.totalBase)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(m.resultado.totalDsr)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {fmtBRL(m.resultado.totalBase + m.resultado.totalDsr)}
                          </TableCell>
                        </TableRow>
                        {m.resultado.detalheVerbas.map((v) => (
                          <TableRow key={`${m.competencia}-${v.verbaId}-${v.colaborador || ''}`}>
                            <TableCell className="pl-6 text-xs text-muted-foreground" colSpan={3}>
                              ↳ {v.nome}
                              {v.colaborador && (
                                <span className="ml-1 font-medium text-foreground/80">· {v.colaborador}</span>
                              )}
                              <span className="opacity-70"> — {v.formula}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs">{fmtBRL(v.base)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtBRL(v.dsr)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtBRL(v.total)}</TableCell>
                          </TableRow>
                        ))}
                        {m.resultado.detalheVerbas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="pl-6 text-xs text-muted-foreground italic">
                              Sem lançamentos nesta competência.
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                    {totaisAno && (
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell>Total {ano}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right">{fmtBRL(totaisAno.base)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(totaisAno.dsr)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(totaisAno.base + totaisAno.dsr)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => gerarPdfApuracaoDsrAnual(ano, empresa, apuracoesAno)}>
                    <FileDown className="w-4 h-4 mr-1" />Exportar PDF anual
                  </Button>
                  <Button variant="outline" onClick={downloadCsvAno}>
                    <FileDown className="w-4 h-4 mr-1" />Exportar CSV anual
                  </Button>
                  <Button variant="outline" onClick={saveAllAno}>
                    <Save className="w-4 h-4 mr-1" />Salvar todas as apurações
                  </Button>
                  <Button variant="outline" onClick={handleClearAno}>
                    <Trash2 className="w-4 h-4 mr-1 text-destructive" />Limpar apurações do ano
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {apuracao.erro && (
        <div className="p-3 border-l-4 border-destructive bg-destructive/10 text-sm">
          ⚠️ {apuracao.erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumo do mês — {r.competencia}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Dias úteis (DU)" value={r.diasUteis} highlight />
            <Stat label="Dias DSR" value={r.diasDsr} highlight />
            <Stat label="Domingos" value={r.domingos} />
            <Stat label="Feriados não úteis" value={r.feriadosNaoUteis} />
          </div>

          {contagem.feriadosListados.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Feriados do mês:</p>
              <div className="flex flex-wrap gap-2">
                {contagem.feriadosListados.map((f) => (
                  <span key={f.data + f.nome} className="text-xs px-2 py-1 bg-muted rounded">
                    {f.data.split('-').reverse().join('/')} — {f.nome}
                    <span className="ml-1 text-muted-foreground">({f.escopo})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por verba</CardTitle>
        </CardHeader>
        <CardContent>
          {r.detalheVerbas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento na competência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verba</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-center">DU</TableHead>
                  <TableHead className="text-center">DSR (dias)</TableHead>
                  <TableHead className="text-right">DSR (R$)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.detalheVerbas.map((v, idx) => (
                  <TableRow key={`${v.verbaId}-${v.colaborador || ''}-${idx}`}>
                    <TableCell>
                      <div className="font-medium">{v.nome}</div>
                      <div className="text-xs text-muted-foreground">{v.formula}</div>
                    </TableCell>
                    <TableCell className="text-sm">{v.colaborador || '—'}</TableCell>
                    <TableCell className="text-right">{fmtBRL(v.base)}</TableCell>
                    <TableCell className="text-center">{v.diasUteis}</TableCell>
                    <TableCell className="text-center">{v.diasDsr}</TableCell>
                    <TableCell className="text-right">{fmtBRL(v.dsr)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
            <Stat label="Total base" value={fmtBRL(r.totalBase)} />
            <Stat label="Total DSR" value={fmtBRL(r.totalDsr)} highlight />
            <Stat label="Total geral" value={fmtBRL(r.totalBase + r.totalDsr)} highlight />
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => gerarPdfApuracaoDsr(r, contagem)}>
              <FileDown className="w-4 h-4 mr-1" />Exportar PDF
            </Button>
            <Button variant="outline" onClick={downloadCsv}>
              <FileDown className="w-4 h-4 mr-1" />Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />Salvar apuração
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-1 text-destructive" />Limpar apuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}