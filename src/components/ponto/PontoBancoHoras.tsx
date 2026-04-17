import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BookOpen, Printer, Trash2, Plus, Building2, User, Loader2, FileText, FileStack, Calendar, Pencil } from 'lucide-react';
import { minutesToHHMM } from '@/utils/pontoCalculations';
import { toast } from 'sonner';
import { useBancoHoras, type PontoSnapshot } from '@/hooks/useBancoHoras';
import { useEmpregados } from '@/hooks/useEmpregados';

function formatMesAno(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(m) - 1]}/${y}`;
}

function formatMesAnoLong(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${meses[parseInt(m) - 1] || m}/${y}`;
}

interface Props {
  empregadoNome: string;
  empregadoCpf?: string;
  empregadoFuncao?: string;
  empresaNome: string;
  mesAno: string;
  saldoFinal: number;
  pontoSnapshot?: PontoSnapshot | null;
  onLoadSnapshot?: (snapshot: PontoSnapshot) => void;
}

const PontoBancoHoras: React.FC<Props> = ({ empregadoNome, empregadoCpf, empregadoFuncao, empresaNome, mesAno, saldoFinal, pontoSnapshot, onLoadSnapshot }) => {
  const { entries, loading, upsertEntry, removeEntry, clearByEmpresa } = useBancoHoras();
  const { upsertEmpregado } = useEmpregados();
  const [showReport, setShowReport] = useState(false);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('__all__');
  const [filtroEmpregado, setFiltroEmpregado] = useState<string>('__all__');
  const [competenciaInicio, setCompetenciaInicio] = useState<string>('');
  const [competenciaFim, setCompetenciaFim] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  const empresasUnicas = useMemo(() => {
    const nomes = new Set<string>();
    entries.forEach(e => { if (e.empresaNome) nomes.add(e.empresaNome); });
    return Array.from(nomes).sort();
  }, [entries]);

  const empregadosUnicos = useMemo(() => {
    const nomes = new Set<string>();
    entries.forEach(e => { if (e.empregadoNome) nomes.add(e.empregadoNome); });
    return Array.from(nomes).sort();
  }, [entries]);

  const entriesFiltradas = useMemo(() => {
    let filtered = entries;
    if (filtroEmpresa !== '__all__') {
      filtered = filtered.filter(e => e.empresaNome === filtroEmpresa);
    }
    if (filtroEmpregado !== '__all__') {
      filtered = filtered.filter(e => e.empregadoNome === filtroEmpregado);
    }
    if (competenciaInicio) {
      filtered = filtered.filter(e => e.mesAno >= competenciaInicio);
    }
    if (competenciaFim) {
      filtered = filtered.filter(e => e.mesAno <= competenciaFim);
    }
    return filtered;
  }, [entries, filtroEmpresa, filtroEmpregado, competenciaInicio, competenciaFim]);

  const handleIncluir = async () => {
    const nome = empregadoNome || 'Empregado';
    const empresa = empresaNome || '';
    await upsertEntry({
      empregadoNome: nome,
      empresaNome: empresa,
      mesAno,
      saldoFinal,
      pontoSnapshot: pontoSnapshot || null,
    });
    if (nome && nome !== 'Empregado') {
      await upsertEmpregado({
        nome,
        cpf: empregadoCpf || '',
        funcao: empregadoFuncao || '',
        empresaNome: empresa,
      });
    }
    toast.success(`Banco de Horas salvo para ${formatMesAno(mesAno)}`);
  };

  const handleRemove = async (id: string) => {
    await removeEntry(id);
    toast.info('Período removido do Banco de Horas');
  };

  const handleClearAll = async () => {
    if (filtroEmpresa !== '__all__') {
      await clearByEmpresa(filtroEmpresa);
      toast.info(`Banco de Horas da empresa "${filtroEmpresa}" limpo`);
      setFiltroEmpresa('__all__');
    } else {
      await clearByEmpresa();
      toast.info('Banco de Horas limpo');
    }
  };

  const buildPontoHtml = (snapshot: PontoSnapshot, asFragment = false): string => {
    const { identificacao, config, diasCalculados, resumo } = snapshot;
    const labels = config.colunasMarcacoes === 6
      ? ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída']
      : ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];

    const saldoClass = (v: number) => v > 0 ? 'positive' : v < 0 ? 'negative' : '';

    const jornadaHtml = config.jornadaSemanal ? `
      <table style="font-size:7.5pt; margin-top:2px; border-collapse:collapse; width:auto;">
        <tr>${Object.keys(config.jornadaSemanal).map((d: string) => `<td style="border:1px solid #ccc; padding:1px 4px; font-weight:bold; background:#eee; text-align:center;">${d}</td>`).join('')}</tr>
        <tr>${Object.values(config.jornadaSemanal).map((hr: any) => `<td style="border:1px solid #ccc; padding:1px 4px; text-align:center; font-family:monospace;">${hr || '00:00'}</td>`).join('')}</tr>
      </table>` : '';

    const rowsHtml = diasCalculados.map((d: any) => `
      <tr>
        <td>${String(d.dia).padStart(2, '0')}</td>
        <td>${d.diaSemana}</td>
        <td style="text-align:left">${d.tipoDia}</td>
        ${d.marcacoes.map((m: string) => `<td>${m || ''}</td>`).join('')}
        <td>${d.horasACumprir}</td>
        <td>${minutesToHHMM(d.trabalhoLiquido)}</td>
        <td class="${saldoClass(d.saldoMinutos)}">${minutesToHHMM(d.saldoMinutos)}</td>
        <td>${d.noturnoReal > 0 ? minutesToHHMM(d.noturnoReal) : ''}</td>
        <td>${d.noturnoConvertido > 0 ? minutesToHHMM(d.noturnoConvertido) : ''}</td>
      </tr>`).join('');

    const styles = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 9pt; padding: 15mm; color: #222; }
        h2 { font-size: 13pt; margin-bottom: 4px; }
        .header { margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 8.5pt; margin-top: 6px; }
        .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8pt; }
        th, td { border: 1px solid #999; padding: 2px 3px; text-align: center; }
        th { background: #eee; font-weight: bold; font-size: 7.5pt; }
        .positive { color: #166534; }
        .negative { color: #991b1b; }
        .summary { margin-top: 12px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 8.5pt; }
        .summary-item { text-align: center; border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
        .summary-item .label { font-size: 7pt; color: #666; text-transform: uppercase; }
        .summary-item .value { font-size: 11pt; font-weight: bold; font-family: monospace; }
        .signatures { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-line { text-align: center; width: 45%; }
        .sig-line hr { border: none; border-top: 1px solid #333; margin-bottom: 4px; }
        .disclaimer { margin-top: 12px; font-size: 7pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
        .page-break { page-break-after: always; }
        @media print { body { padding: 10mm; } }`;

    const body = `
      <div class="header">
        <h2>APURAÇÃO DE PONTO</h2>
        <div class="header-grid">
          <div>
            <span class="label">Empresa: </span>${identificacao.empresaNome || ''}<br/>
            <span class="label">CNPJ/CPF: </span>${identificacao.empresaDoc || ''}
            ${identificacao.empresaEndereco ? `<br/><span class="label">Endereço: </span>${identificacao.empresaEndereco}` : ''}
          </div>
          <div>
            <span class="label">Empregado: </span>${identificacao.empregadoNome || ''}<br/>
            <span class="label">CPF: </span>${identificacao.empregadoCpf || ''}<br/>
            ${identificacao.empregadoFuncao ? `<span class="label">Função: </span>${identificacao.empregadoFuncao}<br/>` : ''}
            <span class="label">Período: </span>${formatMesAnoLong(identificacao.mesAno)}<br/>
            <span class="label">Jornada Semanal:</span><br/>
            ${jornadaHtml}
          </div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Dia</th><th>DS</th><th>Tipo</th>
          ${labels.map(l => `<th>${l}</th>`).join('')}
          <th>Cumprir</th><th>Trab.</th><th>Saldo</th><th>Not.R</th><th>Not.C</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="summary">
        <div class="summary-item"><div class="label">Total Trabalhado</div><div class="value">${minutesToHHMM(resumo.totalTrabalhado)}</div></div>
        <div class="summary-item"><div class="label">Total a Cumprir</div><div class="value">${minutesToHHMM(resumo.totalACumprir)}</div></div>
        <div class="summary-item"><div class="label">Saldo Positivo</div><div class="value positive">${minutesToHHMM(resumo.totalSaldoPositivo)}</div></div>
        <div class="summary-item"><div class="label">Saldo Negativo</div><div class="value negative">${minutesToHHMM(resumo.totalSaldoNegativo)}</div></div>
        <div class="summary-item"><div class="label">Saldo Final</div><div class="value ${saldoClass(resumo.saldoFinal)}">${minutesToHHMM(resumo.saldoFinal)}</div></div>
      </div>
      <div class="signatures">
        <div class="sig-line"><hr/> Empregado</div>
        <div class="sig-line"><hr/> Empresa / Responsável</div>
      </div>
      <div class="disclaimer">⚠️ Apuração estimativa para conferência.</div>`;

    if (asFragment) return body;
    return `<!DOCTYPE html><html><head><title>Ponto - ${identificacao.empregadoNome}</title><style>${styles}</style></head><body>${body}</body></html>`;
  };

  const openPrint = (html: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintPonto = (snapshot: PontoSnapshot) => {
    openPrint(buildPontoHtml(snapshot, false));
  };

  const handlePrintCombinado = () => {
    const content = reportRef.current;
    if (!content) return;
    const sharedStyles = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; padding: 15mm; color: #222; }
        h2 { font-size: 14pt; margin-bottom: 6px; }
        .info { font-size: 9pt; margin-bottom: 10px; }
        .info .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }
        th, td { border: 1px solid #999; padding: 4px 8px; text-align: center; }
        th { background: #eee; font-weight: bold; }
        .positive { color: #166534; font-weight: bold; }
        .negative { color: #991b1b; font-weight: bold; }
        .total-row { background: #f5f5f5; font-weight: bold; }
        .header { margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 8.5pt; margin-top: 6px; }
        .label { font-weight: bold; }
        .summary { margin-top: 12px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 8.5pt; }
        .summary-item { text-align: center; border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
        .summary-item .label { font-size: 7pt; color: #666; text-transform: uppercase; }
        .summary-item .value { font-size: 11pt; font-weight: bold; font-family: monospace; }
        .signatures { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-line { text-align: center; width: 45%; }
        .sig-line hr { border: none; border-top: 1px solid #333; margin-bottom: 4px; }
        .disclaimer { margin-top: 12px; font-size: 7pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
        .page-break { page-break-after: always; }
        @media print { body { padding: 10mm; } }`;

    const pontosHtml = entriesFiltradas
      .filter(e => e.pontoSnapshot)
      .map(e => `<div class="page-break"></div>${buildPontoHtml(e.pontoSnapshot!, true)}`)
      .join('');

    const fullHtml = `<!DOCTYPE html><html><head><title>Banco de Horas + Pontos</title><style>${sharedStyles}</style></head><body>${content.innerHTML}${pontosHtml}</body></html>`;
    openPrint(fullHtml);
  };

  const handlePrintReport = () => {
    const content = reportRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório Banco de Horas</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; padding: 15mm; color: #222; }
        h2 { font-size: 14pt; margin-bottom: 6px; }
        .info { font-size: 9pt; margin-bottom: 10px; }
        .info .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }
        th, td { border: 1px solid #999; padding: 4px 8px; text-align: center; }
        th { background: #eee; font-weight: bold; }
        .positive { color: #166534; font-weight: bold; }
        .negative { color: #991b1b; font-weight: bold; }
        .total-row { background: #f5f5f5; font-weight: bold; }
        .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-line { text-align: center; width: 45%; }
        .sig-line hr { border: none; border-top: 1px solid #333; margin-bottom: 4px; }
        .disclaimer { margin-top: 16px; font-size: 7pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
        @media print { body { padding: 10mm; } }
      </style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  let saldoAcumulado = 0;
  const entriesWithBalance = entriesFiltradas.map(e => {
    saldoAcumulado += e.saldoFinal;
    return { ...e, saldoAcumulado };
  });

  const totalCredito = entriesFiltradas.reduce((s, e) => s + (e.saldoFinal > 0 ? e.saldoFinal : 0), 0);
  const totalDebito = entriesFiltradas.reduce((s, e) => s + (e.saldoFinal < 0 ? e.saldoFinal : 0), 0);

  const saldoClass = (v: number) => v > 0 ? 'text-green-700 dark:text-green-400' : v < 0 ? 'text-red-700 dark:text-red-400' : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleIncluir} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Incluir no Banco de Horas
        </Button>
        <Button
          variant={showReport ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowReport(!showReport)}
          className="gap-1.5"
        >
          <BookOpen className="w-4 h-4" />
          {showReport ? 'Ocultar' : 'Ver'} Banco de Horas ({entries.length})
        </Button>
      </div>

      {showReport && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle className="text-base">Relatório de Banco de Horas</CardTitle>
              <div className="flex gap-2 flex-wrap items-center">
                {empresasUnicas.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                      <SelectTrigger className="h-8 w-[200px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas as Empresas</SelectItem>
                        {empresasUnicas.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {empregadosUnicos.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <Select value={filtroEmpregado} onValueChange={setFiltroEmpregado}>
                      <SelectTrigger className="h-8 w-[200px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os Funcionários</SelectItem>
                        {empregadosUnicos.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="month"
                    value={competenciaInicio}
                    onChange={(e) => setCompetenciaInicio(e.target.value)}
                    className="h-8 w-[140px] text-xs"
                    placeholder="De"
                    title="Competência inicial"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="month"
                    value={competenciaFim}
                    onChange={(e) => setCompetenciaFim(e.target.value)}
                    className="h-8 w-[140px] text-xs"
                    placeholder="Até"
                    title="Competência final"
                  />
                  {(competenciaInicio || competenciaFim) && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setCompetenciaInicio(''); setCompetenciaFim(''); }}>
                      Limpar
                    </Button>
                  )}
                </div>
                {entriesFiltradas.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5">
                      <Printer className="w-4 h-4" />
                      Imprimir Banco
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrintCombinado} className="gap-1.5" title="Imprime o relatório de banco de horas seguido dos espelhos de ponto">
                      <FileStack className="w-4 h-4" />
                      Banco + Pontos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                      {filtroEmpresa !== '__all__' ? 'Limpar Empresa' : 'Limpar Tudo'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : entriesFiltradas.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Nenhum período adicionado ao Banco de Horas{filtroEmpresa !== '__all__' ? ` para "${filtroEmpresa}"` : ''}{filtroEmpregado !== '__all__' ? ` / "${filtroEmpregado}"` : ''}.
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Período</TableHead>
                      <TableHead className="text-center">Empresa</TableHead>
                      <TableHead className="text-center">Empregado</TableHead>
                      <TableHead className="text-center">Crédito</TableHead>
                      <TableHead className="text-center">Débito</TableHead>
                      <TableHead className="text-center">Saldo Mês</TableHead>
                      <TableHead className="text-center">Saldo Acumulado</TableHead>
                      <TableHead className="text-center w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesWithBalance.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-center">{formatMesAno(e.mesAno)}</TableCell>
                        <TableCell className="text-center text-xs">{e.empresaNome || '–'}</TableCell>
                        <TableCell className="text-center">{e.empregadoNome}</TableCell>
                        <TableCell className={`font-mono text-center ${e.saldoFinal > 0 ? saldoClass(e.saldoFinal) : ''}`}>
                          {e.saldoFinal > 0 ? minutesToHHMM(e.saldoFinal) : ''}
                        </TableCell>
                        <TableCell className={`font-mono text-center ${e.saldoFinal < 0 ? saldoClass(e.saldoFinal) : ''}`}>
                          {e.saldoFinal < 0 ? minutesToHHMM(e.saldoFinal) : ''}
                        </TableCell>
                        <TableCell className={`font-mono text-center font-semibold ${saldoClass(e.saldoFinal)}`}>
                          {minutesToHHMM(e.saldoFinal)}
                        </TableCell>
                        <TableCell className={`font-mono text-center font-bold ${saldoClass(e.saldoAcumulado)}`}>
                          {minutesToHHMM(e.saldoAcumulado)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {e.pontoSnapshot && onLoadSnapshot && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Carregar este mês na apuração para editar e recalcular"
                                onClick={() => {
                                  onLoadSnapshot(e.pontoSnapshot!);
                                  toast.success(`Apuração de ${formatMesAno(e.mesAno)} carregada para edição`);
                                  setShowReport(false);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                              </Button>
                            )}
                            {e.pontoSnapshot && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Imprimir espelho de ponto deste mês"
                                onClick={() => handlePrintPonto(e.pontoSnapshot!)}
                              >
                                <FileText className="w-3.5 h-3.5 text-primary" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(e.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold">Totais:</TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(totalCredito)}`}>
                        {minutesToHHMM(totalCredito)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(totalDebito)}`}>
                        {minutesToHHMM(totalDebito)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(saldoAcumulado)}`}>
                        {minutesToHHMM(saldoAcumulado)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(saldoAcumulado)}`}>
                        {minutesToHHMM(saldoAcumulado)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden print content */}
      <div ref={reportRef} className="hidden">
        <h2>RELATÓRIO DE BANCO DE HORAS</h2>
        <div className="info">
          {filtroEmpresa !== '__all__' && <><span className="label">Empresa: </span>{filtroEmpresa}<br/></>}
          {filtroEmpresa === '__all__' && entriesFiltradas[0]?.empresaNome && <><span className="label">Empresa: </span>{entriesFiltradas[0].empresaNome}<br/></>}
          {filtroEmpregado !== '__all__' && <><span className="label">Funcionário: </span>{filtroEmpregado}<br/></>}
          <span className="label">Emissão: </span>{new Date().toLocaleDateString('pt-BR')}
        </div>

        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Empresa</th>
              <th>Empregado</th>
              <th>Crédito</th>
              <th>Débito</th>
              <th>Saldo Mês</th>
              <th>Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {entriesWithBalance.map(e => (
              <tr key={e.id}>
                <td>{formatMesAno(e.mesAno)}</td>
                <td>{e.empresaNome || '–'}</td>
                <td>{e.empregadoNome}</td>
                <td className={e.saldoFinal > 0 ? 'positive' : ''}>{e.saldoFinal > 0 ? minutesToHHMM(e.saldoFinal) : ''}</td>
                <td className={e.saldoFinal < 0 ? 'negative' : ''}>{e.saldoFinal < 0 ? minutesToHHMM(e.saldoFinal) : ''}</td>
                <td className={e.saldoFinal >= 0 ? 'positive' : 'negative'}>{minutesToHHMM(e.saldoFinal)}</td>
                <td className={e.saldoAcumulado >= 0 ? 'positive' : 'negative'}><strong>{minutesToHHMM(e.saldoAcumulado)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={3} className="text-right"><strong>Totais:</strong></td>
              <td className="positive">{minutesToHHMM(totalCredito)}</td>
              <td className="negative">{minutesToHHMM(totalDebito)}</td>
              <td className={saldoAcumulado >= 0 ? 'positive' : 'negative'}>{minutesToHHMM(saldoAcumulado)}</td>
              <td className={saldoAcumulado >= 0 ? 'positive' : 'negative'}><strong>{minutesToHHMM(saldoAcumulado)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <div className="signatures">
          <div className="sig-line"><hr/> Empregado</div>
          <div className="sig-line"><hr/> Empresa / Responsável</div>
        </div>

        <div className="disclaimer">
          ⚠️ Relatório estimativo de banco de horas para conferência. Pode haver regras específicas por CCT, escalas e acordos.
        </div>
      </div>
    </div>
  );
};

export default PontoBancoHoras;
