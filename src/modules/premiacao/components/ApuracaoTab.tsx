import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Lock, Unlock, FileText, FileSpreadsheet, FileDown, AlertTriangle, Loader2, Receipt, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { tbl, rpc, brl, fmtComp, type Apuracao, type Catalogo, type Colaborador, type Politica } from '../hooks/usePremiacao';
import { pdfApuracao, pdfExtrato, pdfRecibo } from '../utils/pdfs';
import FeedbackDialog from './FeedbackDialog';
import { useModelosDocumento } from '@/modules/modelos-documento/useModelosDocumento';
import { baixarPdf, dadosPadrao, preencherModelo, type TipoModelo } from '@/modules/modelos-documento/lib';
import { FORMULA_RODAPE } from '../utils/textos';
import { gerarArquivo } from '@/modules/taxa-servico/utils/dominioLayout';

export default function ApuracaoTab({ politica, cat, competencia, empresa }: { politica: Politica; cat: Catalogo; competencia: string; empresa: string }) {
  const [rows, setRows] = useState<Apuracao[]>([]);
  const [busy, setBusy] = useState(false);
  const [codEmpresa, setCodEmpresa] = useState('');
  const [processo, setProcesso] = useState('11');
  const [fb, setFb] = useState<{ ap: Apuracao; c: Colaborador } | null>(null);

  const load = async () => {
    const { data } = await tbl('premiacao_apuracoes').select('*').eq('politica_id', politica.id).eq('competencia', competencia);
    setRows((data || []).sort((a: Apuracao, b: Apuracao) => (cat.colaboradores.find(c => c.id === a.colaborador_id)?.nome || '').localeCompare(cat.colaboradores.find(c => c.id === b.colaborador_id)?.nome || '')));
  };
  useEffect(() => { load(); }, [politica.id, competencia, cat.colaboradores]);
  useEffect(() => {
    tbl('ts_empresa_config').select('codigo_empresa_dominio').eq('empresa_id', politica.empresa_id).maybeSingle().then(({ data }: any) => data?.codigo_empresa_dominio && setCodEmpresa(data.codigo_empresa_dominio));
  }, [politica.empresa_id]);

  const acao = async (fn: string, ok: string) => {
    setBusy(true);
    const { error } = await rpc(fn, { p_politica_id: politica.id, p_competencia: competencia });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ok); load();
  };

  const status = rows.length ? (rows.every(r => r.status === 'exportada') ? 'exportada' : rows.every(r => r.status !== 'aberta') ? 'fechada' : 'aberta') : 'sem apuração';
  const vigente = cat.versaoVigente;
  const semCiencia = (id: string) => vigente && !cat.ciencias.some(c => c.colaborador_id === id && c.versao_regulamento_id === vigente.id);
  const colab = (id: string) => cat.colaboradores.find(c => c.id === id);

  const exportarTxt = async () => {
    if (!politica.codigo_rubrica_dominio) return toast.error('Informe a rubrica Domínio na aba Política.');
    const elegiveis = rows.filter(r => r.status !== 'aberta' && Number(r.valor_bonificacao) > 0);
    if (!elegiveis.length) return toast.error('Nenhuma apuração fechada com prêmio maior que zero.');
    const semCod = elegiveis.filter(r => !colab(r.colaborador_id)?.codigo);
    if (semCod.length) return toast.error(`Colaboradores sem código Domínio: ${semCod.map(r => colab(r.colaborador_id)?.nome).join(', ')}`);
    const comp = competencia.replace('-', '');
    const { conteudo, erros } = gerarArquivo(elegiveis.map(r => ({ codigoEmpregado: colab(r.colaborador_id)!.codigo!, competencia: comp, rubrica: politica.codigo_rubrica_dominio!, tipoProcesso: processo, valor: Number(r.valor_bonificacao), codigoEmpresa: codEmpresa || null })));
    if (erros.length) return toast.error(erros.slice(0, 4).join('\n'));
    const blob = new Blob([conteudo], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `FOLHA${comp.slice(4)}${comp.slice(0, 4)}-${codEmpresa || '0'}-PREMIO.txt`; a.click();
    await rpc('premiacao_marcar_exportada', { p_politica_id: politica.id, p_competencia: competencia });
    load();
  };

  const exportarXlsx = () => {
    const data = rows.map(r => {
      const c = colab(r.colaborador_id);
      return { Código: c?.codigo || '', Colaborador: c?.nome, Função: cat.funcaoDe(c), 'Saldo inicial': r.saldo_inicial, Medalhas: r.pontos_medalhas, Troféus: r.pontos_trofeus, Desabonos: r.pontos_desabonos, 'Saldo do mês': r.saldo_apurado, Referência: r.pontuacao_referencia, 'Pontos premiáveis': r.pontos_premiaveis, 'Valor do ponto': Number(r.valor_ponto), Prêmio: Number(r.valor_bonificacao), 'Saldo transportado': r.saldo_transportado, Status: r.status };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fmtComp(competencia).replace('/', '-'));
    XLSX.writeFile(wb, `apuracao-premio-${competencia}.xlsx`);
  };

  const modelos = useModelosDocumento(politica.id);
  const docPersonalizado = async (tipo: TipoModelo, r: Apuracao, c: Colaborador) => {
    const mod = modelos.ativo(tipo);
    if (!mod) return false;
    const dados = dadosPadrao({ colaborador: { nome: c.nome, cpf: c.cpf, codigo: c.codigo, cargo: cat.funcaoDe(c) }, empresa, politica: politica.nome, competencia, valor: Number(r.valor_bonificacao), pontos: r.pontos_premiaveis });
    baixarPdf(await preencherModelo(mod.pdf_base64, mod.campos, [dados]), `${tipo}-${c.nome}-${competencia}.pdf`);
    return true;
  };

  const total = rows.reduce((s, r) => s + Number(r.valor_bonificacao), 0);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap gap-2 items-end">
        <Badge variant={status === 'aberta' ? 'outline' : 'default'} className="h-8">Status: {status}</Badge>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => acao('premiacao_apurar', 'Apuração recalculada.')}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Recalcular</Button>
        <Button size="sm" disabled={busy || !rows.length} onClick={() => confirm(`Fechar a competência ${fmtComp(competencia)}?`) && acao('premiacao_fechar', 'Competência fechada.')}><Lock className="w-3 h-3 mr-1" />Fechar competência</Button>
        <Button size="sm" variant="outline" disabled={busy || status === 'aberta'} onClick={() => confirm('Reabrir? Somente administradores. As competências seguintes abertas serão recalculadas.') && acao('premiacao_reabrir', 'Competência reaberta.')}><Unlock className="w-3 h-3 mr-1" />Reabrir</Button>
        <div className="ml-auto flex gap-2 items-end">
          <div><Label className="text-xs">Cód. empresa Domínio</Label><Input className="h-8 w-28" value={codEmpresa} onChange={e => setCodEmpresa(e.target.value)} /></div>
          <div><Label className="text-xs">Processo</Label><Input className="h-8 w-16" value={processo} onChange={e => setProcesso(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={exportarTxt}><FileText className="w-3 h-3 mr-1" />TXT Domínio</Button>
          <Button size="sm" variant="outline" onClick={exportarXlsx} disabled={!rows.length}><FileSpreadsheet className="w-3 h-3 mr-1" />XLSX</Button>
          <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => pdfApuracao({ politica, cat, apuracoes: rows, competencia, empresa }).save(`apuracao-premio-${competencia}.pdf`)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
        </div>
      </div>
      {!vigente && <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Nenhuma versão do regulamento publicada ainda.</p>}
      <div className="overflow-auto">
        <Table><TableHeader><TableRow>
          <TableHead>Colaborador</TableHead><TableHead>Saldo inicial</TableHead><TableHead>Medalhas</TableHead><TableHead>Troféus</TableHead><TableHead>Desabonos</TableHead>
          <TableHead>Saldo do mês</TableHead><TableHead>Referência</TableHead><TableHead>Premiáveis</TableHead><TableHead>Prêmio</TableHead><TableHead>Transportado</TableHead><TableHead>Status</TableHead><TableHead>Documentos</TableHead>
        </TableRow></TableHeader>
          <TableBody>{rows.map(r => {
            const c = colab(r.colaborador_id);
            return (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{c?.nome}</div><div className="text-xs text-muted-foreground">{cat.funcaoDe(c)}</div>
                  {semCiencia(r.colaborador_id) && <Badge variant="outline" className="text-amber-700 border-amber-400 mt-1"><AlertTriangle className="w-3 h-3 mr-1" />Sem ciência v{vigente!.versao}</Badge>}</TableCell>
                <TableCell>{r.saldo_inicial}</TableCell>
                <TableCell><div>{r.pontos_medalhas}</div><div className="flex gap-1 flex-wrap">{cat.medalhas.map(m => r.medalhas_contagem?.[m.nome] ? <span key={m.id} className="text-[10px] px-1 rounded text-white" style={{ background: m.cor_hex }}>{m.nome} {r.medalhas_contagem[m.nome]}</span> : null)}</div></TableCell>
                <TableCell title={r.trofeus_conquistados.filter(t => t.atingida).map(t => t.nome).join(', ')}>{r.pontos_trofeus} <span className="text-xs text-muted-foreground">({r.trofeus_conquistados.filter(t => t.atingida).length})</span></TableCell>
                <TableCell className="text-destructive">−{r.pontos_desabonos}</TableCell>
                <TableCell className={r.saldo_apurado < 0 ? 'text-destructive font-medium' : 'font-medium'}>{r.saldo_apurado}</TableCell>
                <TableCell>{r.pontuacao_referencia}</TableCell>
                <TableCell>{r.pontos_premiaveis}</TableCell>
                <TableCell className="font-semibold">{brl(r.valor_bonificacao)}</TableCell>
                <TableCell className={r.saldo_transportado < 0 ? 'text-destructive' : ''}>{r.saldo_transportado}</TableCell>
                <TableCell><Badge variant={r.status === 'aberta' ? 'outline' : 'default'}>{r.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={r.status === 'aberta' || !c} title={r.status === 'aberta' ? 'Disponível após fechar a competência' : 'Extrato em PDF'}
                      onClick={async () => c && !(await docPersonalizado('extrato', r, c)) && pdfExtrato({ politica, cat, apuracao: r, colaborador: c, empresa }).save(`extrato-${c.nome}-${competencia}.pdf`)}><FileDown className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={r.status === 'aberta' || !c || Number(r.valor_bonificacao) <= 0} title={r.status === 'aberta' ? 'Disponível após fechar a competência' : 'Recibo do prêmio em PDF'}
                      onClick={async () => c && !(await docPersonalizado('recibo', r, c)) && pdfRecibo({ politica, cat, apuracao: r, colaborador: c, empresa }).save(`recibo-premio-${c.nome}-${competencia}.pdf`)}><Receipt className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={r.status === 'aberta' || !c} title={r.status === 'aberta' ? 'Disponível após fechar a competência' : 'Feedback (IA ou manual)'}
                      onClick={() => c && setFb({ ap: r, c })}><MessageSquareText className="w-3 h-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>);
          })}</TableBody></Table>
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground">Clique em "Recalcular" para apurar a competência {fmtComp(competencia)}.</p>}
      {rows.length > 0 && <p className="text-sm font-semibold text-right">Total de prêmios: {brl(total)}</p>}
      <p className="text-xs rounded bg-muted p-2">{FORMULA_RODAPE}</p>
      {status === 'aberta' && rows.length > 0 && <p className="text-xs text-muted-foreground">Extrato, recibo e feedback ficam disponíveis após fechar a competência.</p>}
      {fb && <FeedbackDialog open onOpenChange={o => !o && setFb(null)} politica={politica} cat={cat} apuracao={fb.ap} colaborador={fb.c} empresa={empresa} />}
    </div>
  );
}
