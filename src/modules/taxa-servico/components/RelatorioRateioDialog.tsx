import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, FileDown } from 'lucide-react';
import { toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmt, competenciaLabel } from '../utils/validacoes';

export interface LinhaRel { codigo: string; nome: string; pontos: number; valor: number; lanca: boolean }
interface Props {
  open: boolean; onOpenChange: (v: boolean) => void; empresa: string; competencia: string;
  arrecadado: number; percentual: number; retido: number; saldoUtilizado: number; liquido: number;
  totalPontos: number; valorPonto: number; linhas: LinhaRel[];
}

export default function RelatorioRateioDialog(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const titulo = `Rateio da Taxa de Serviço — ${competenciaLabel(p.competencia)}`;
  const vp = p.valorPonto.toLocaleString('pt-BR', { maximumFractionDigits: 6 });

  const copiar = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('falha');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Imagem copiada — cole no WhatsApp');
      } catch {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rateio-${p.competencia.slice(0, 7)}.png`; a.click();
        toast.info('Não foi possível copiar; a imagem foi baixada.');
      }
    } catch { toast.error('Não foi possível gerar a imagem.'); } finally { setBusy(false); }
  };

  const pdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(98, 142, 63); doc.rect(0, 0, W, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(57, 52, 33);
    doc.text(titulo, 40, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(p.empresa, 40, 58);
    autoTable(doc, {
      startY: 72, theme: 'plain', styles: { fontSize: 9, cellPadding: 3 },
      body: [
        ['Valor arrecadado', fmt(p.arrecadado), 'Retenção', `${p.percentual.toLocaleString('pt-BR')}% (${fmt(p.retido)})`],
        ['Saldo anterior utilizado', fmt(p.saldoUtilizado), 'Líquido distribuído', fmt(p.liquido)],
        ['Total de pontos', p.totalPontos.toLocaleString('pt-BR'), 'Valor do ponto', vp],
      ],
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12, theme: 'grid',
      head: [['Código', 'Nome', 'Pontos', 'Valor']],
      body: p.linhas.map((l) => [l.codigo, l.nome, l.pontos.toLocaleString('pt-BR'), fmt(l.valor)]),
      foot: [['', 'Total', p.totalPontos.toLocaleString('pt-BR'), fmt(p.linhas.reduce((s, l) => s + l.valor, 0))]],
      headStyles: { fillColor: [98, 142, 63], textColor: 255 }, footStyles: { fillColor: [225, 232, 242], textColor: [57, 52, 33] },
      alternateRowStyles: { fillColor: [247, 249, 245] }, styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    doc.save(`rateio-taxa-servico-${p.competencia.slice(0, 7)}.pdf`);
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-auto">
        <DialogHeader><DialogTitle>Relatório de pontuação e valores</DialogTitle></DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={busy} onClick={copiar}><Copy className="w-4 h-4 mr-1" />Copiar imagem</Button>
          <Button onClick={pdf}><FileDown className="w-4 h-4 mr-1" />Gerar PDF</Button>
        </div>
        <div ref={ref} className="bg-background text-foreground p-5 rounded-md border">
          <div className="h-1 bg-primary rounded mb-3" />
          <h3 className="font-bold text-lg">{titulo}</h3>
          <p className="text-sm text-muted-foreground mb-3">{p.empresa}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
            <div>Arrecadado: <b>{fmt(p.arrecadado)}</b></div>
            <div>Retenção: <b>{p.percentual.toLocaleString('pt-BR')}% ({fmt(p.retido)})</b></div>
            <div>Saldo anterior utilizado: <b>{fmt(p.saldoUtilizado)}</b></div>
            <div>Líquido distribuído: <b className="text-primary">{fmt(p.liquido)}</b></div>
            <div>Total de pontos: <b>{p.totalPontos.toLocaleString('pt-BR')}</b></div>
            <div>Valor do ponto: <b>{vp}</b></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-primary text-primary-foreground"><th className="p-1.5 text-left">Código</th><th className="p-1.5 text-left">Nome</th><th className="p-1.5 text-right">Pontos</th><th className="p-1.5 text-right">Valor</th></tr></thead>
            <tbody>{p.linhas.map((l, i) => (
              <tr key={l.codigo + i} className={i % 2 ? 'bg-muted/40' : ''}>
                <td className="p-1.5">{l.codigo}</td><td className="p-1.5">{l.nome}</td>
                <td className="p-1.5 text-right">{l.pontos.toLocaleString('pt-BR')}</td><td className="p-1.5 text-right">{fmt(l.valor)}</td>
              </tr>))}</tbody>
            <tfoot><tr className="bg-secondary font-semibold"><td className="p-1.5" colSpan={2}>Total</td><td className="p-1.5 text-right">{p.totalPontos.toLocaleString('pt-BR')}</td><td className="p-1.5 text-right">{fmt(p.linhas.reduce((s, l) => s + l.valor, 0))}</td></tr></tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
