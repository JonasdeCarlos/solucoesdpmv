import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, FileDown } from 'lucide-react';
import { toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmt, competenciaLabel } from '../utils/validacoes';
import { round2 } from '../utils/rateio';
import { loadDistribuicao, type TsCompetencia, type TsDistribuicao, type TsFuncionario, type TsSaldo } from '../hooks/useTaxaServico';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; empresa: string; comp: TsCompetencia; funcionarios: TsFuncionario[]; saldo: TsSaldo; fechada: boolean }

export default function RelatorioFechamentoDialog({ open, onOpenChange, empresa, comp, funcionarios, saldo, fechada }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState<TsDistribuicao[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) loadDistribuicao(comp.id).then((d) => setDist(d.filter((x) => x.pontos > 0))); }, [open, comp.id]);

  const byId = new Map(funcionarios.map((f) => [f.id, f]));
  const linhas = dist.map((d) => {
    const f = byId.get(d.funcionario_id);
    const lancado = d.valor_ajustado ?? d.valor_comissao;
    return { codigo: f?.codigo || '', nome: f?.nome || '', pontos: d.pontos, original: d.valor_comissao, lancado, dif: round2(lancado - d.valor_comissao), folha: f?.gera_lancamento !== false };
  }).sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const tPontos = linhas.reduce((s, l) => s + l.pontos, 0);
  const tOrig = round2(linhas.reduce((s, l) => s + l.original, 0));
  const tLanc = round2(linhas.reduce((s, l) => s + l.lancado, 0));
  const tFolha = round2(linhas.filter((l) => l.folha).reduce((s, l) => s + l.lancado, 0));
  const difAjuste = round2(tOrig - tLanc);
  const titulo = `Relatório final de fechamento — ${competenciaLabel(comp.competencia)}`;
  const resumo: [string, string][] = [
    ['Valor arrecadado', fmt(comp.valor_arrecadado)],
    [`Retenção (${comp.percentual_retencao.toLocaleString('pt-BR')}%)`, fmt(comp.valor_retido)],
    ['Saldo anterior utilizado', fmt(comp.saldo_utilizado)],
    ['Líquido distribuído', fmt(comp.valor_liquido)],
    ['Total de pontos atribuídos', tPontos.toLocaleString('pt-BR')],
    ['Total lançado (comissões finais)', fmt(tLanc)],
    ['Lançado no arquivo da folha', fmt(tFolha)],
    [difAjuste < 0 ? 'Majoração (abateu do saldo)' : 'Diferença de ajuste ao saldo', fmt(Math.abs(difAjuste))],
  ];
  const saldoLinhas: [string, string][] = [
    ['Saldo gerado (acumulado)', fmt(saldo.saldo_gerado)],
    ['Saldo consumido (acumulado)', fmt(saldo.saldo_consumido)],
    ['Saldo disponível atual', fmt(saldo.saldo_acumulado)],
  ];

  const copiar = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error();
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast.success('Imagem copiada — cole no WhatsApp'); }
      catch { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fechamento-${comp.competencia.slice(0, 7)}.png`; a.click(); toast.info('Imagem baixada.'); }
    } catch { toast.error('Não foi possível gerar a imagem.'); } finally { setBusy(false); }
  };

  const pdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(98, 142, 63); doc.rect(0, 0, W, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(57, 52, 33); doc.text(titulo, 40, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${empresa} · ${fechada ? 'Competência fechada' : 'Competência em aberto'}`, 40, 58);
    autoTable(doc, { startY: 72, theme: 'plain', styles: { fontSize: 9, cellPadding: 3 }, head: [['Resumo do lançamento', '']], headStyles: { textColor: [98, 142, 63] }, body: resumo, columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }, tableWidth: 300 });
    autoTable(doc, { startY: 72, margin: { left: 360 }, theme: 'plain', styles: { fontSize: 9, cellPadding: 3 }, head: [['Posição do saldo', '']], headStyles: { textColor: [98, 142, 63] }, body: saldoLinhas, columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } } });
    autoTable(doc, {
      startY: 72 + 18 * (resumo.length + 2), theme: 'grid',
      head: [['Código', 'Nome', 'Pontos', 'Comissão original', 'Valor lançado', 'Diferença', 'Folha']],
      body: linhas.map((l) => [l.codigo, l.nome, l.pontos.toLocaleString('pt-BR'), fmt(l.original), fmt(l.lancado), l.dif ? fmt(l.dif) : '', l.folha ? 'Sim' : 'Não']),
      foot: [['', 'Total', tPontos.toLocaleString('pt-BR'), fmt(tOrig), fmt(tLanc), difAjuste ? fmt(-difAjuste) : '', '']],
      headStyles: { fillColor: [98, 142, 63], textColor: 255 }, footStyles: { fillColor: [225, 232, 242], textColor: [57, 52, 33] },
      alternateRowStyles: { fillColor: [247, 249, 245] }, styles: { fontSize: 8.5 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' } },
    });
    doc.save(`fechamento-taxa-servico-${comp.competencia.slice(0, 7)}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
        <DialogHeader><DialogTitle>Relatório final de fechamento</DialogTitle></DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={busy} onClick={copiar}><Copy className="w-4 h-4 mr-1" />Copiar imagem</Button>
          <Button onClick={pdf}><FileDown className="w-4 h-4 mr-1" />Gerar PDF</Button>
        </div>
        <div ref={ref} className="bg-background text-foreground p-5 rounded-md border">
          <div className="h-1 bg-primary rounded mb-3" />
          <h3 className="font-bold text-lg">{titulo}</h3>
          <p className="text-sm text-muted-foreground mb-3">{empresa} · {fechada ? 'Competência fechada' : 'Competência em aberto'}</p>
          <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
            <div><p className="font-semibold text-primary mb-1">Resumo do lançamento</p>{resumo.map(([k, v]) => <div key={k} className="flex justify-between border-b py-0.5"><span>{k}</span><b>{v}</b></div>)}</div>
            <div><p className="font-semibold text-primary mb-1">Posição do saldo</p>{saldoLinhas.map(([k, v]) => <div key={k} className="flex justify-between border-b py-0.5"><span>{k}</span><b>{v}</b></div>)}</div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-primary text-primary-foreground">
              <th className="p-1.5 text-left">Código</th><th className="p-1.5 text-left">Nome</th><th className="p-1.5 text-right">Pontos</th>
              <th className="p-1.5 text-right">Comissão original</th><th className="p-1.5 text-right">Valor lançado</th><th className="p-1.5 text-right">Diferença</th><th className="p-1.5">Folha</th>
            </tr></thead>
            <tbody>{linhas.map((l, i) => (
              <tr key={l.codigo + i} className={i % 2 ? 'bg-muted/40' : ''}>
                <td className="p-1.5">{l.codigo}</td><td className="p-1.5">{l.nome}</td><td className="p-1.5 text-right">{l.pontos.toLocaleString('pt-BR')}</td>
                <td className="p-1.5 text-right">{fmt(l.original)}</td><td className="p-1.5 text-right font-medium">{fmt(l.lancado)}</td>
                <td className={`p-1.5 text-right ${l.dif < 0 ? 'text-destructive' : ''}`}>{l.dif ? fmt(l.dif) : ''}</td><td className="p-1.5 text-center">{l.folha ? 'Sim' : 'Não'}</td>
              </tr>))}</tbody>
            <tfoot><tr className="bg-secondary font-semibold">
              <td className="p-1.5" colSpan={2}>Total</td><td className="p-1.5 text-right">{tPontos.toLocaleString('pt-BR')}</td>
              <td className="p-1.5 text-right">{fmt(tOrig)}</td><td className="p-1.5 text-right">{fmt(tLanc)}</td><td className="p-1.5 text-right">{difAjuste ? fmt(-difAjuste) : ''}</td><td />
            </tr></tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
