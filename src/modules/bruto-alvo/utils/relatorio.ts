import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Resultado } from './motor';

export interface BlocoPrevia { codigo: string; nome: string; salario: number; alvo: number; res: Resultado; diferenca: number }
export interface Cabecalho { empresa: string; competencia: string; diasUteis: number; diasDsr: number; divisor: number; tolerancia: number }

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec = (h: number) => h.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const TAG = 'calculado pelo Domínio – não exportado';

export function linhasBloco(b: BlocoPrevia): [string, string, string, string][] {
  const L: [string, string, string, string][] = [['Salário', '', '', brl(b.salario)]];
  if (b.res.percQuinq > 0) L.push([`Quinquênio (${b.res.percQuinq}% – ${b.res.anos} anos completos)`, '', '', brl(b.res.valorQuinq)]);
  b.res.fixas.filter((f) => f.valor).forEach((f) => L.push([f.descricao, '', '', brl(f.valor)]));
  const not = b.res.variaveis.filter((v) => v.verba === 'AD_NOT');
  const ext = b.res.variaveis.filter((v) => v.verba !== 'AD_NOT');
  not.filter((v) => v.unidades).forEach((v) => L.push([v.descricao, dec(v.horas), v.hhmm, brl(v.valor)]));
  if (b.res.dsrNoturno) L.push([`DSR s/ AD. NOT (${TAG})`, '', '', brl(b.res.dsrNoturno)]);
  ext.filter((v) => v.unidades).forEach((v) => L.push([v.descricao, dec(v.horas), v.hhmm, brl(v.valor)]));
  if (b.res.dsrExtras) L.push([`DSR s/ H. EXTRAS (${TAG})`, '', '', brl(b.res.dsrExtras)]);
  return L;
}

export function pdfPrevia(cab: Cabecalho, blocos: BlocoPrevia[]) {
  const doc = new jsPDF();
  doc.setFontSize(13); doc.text('Prévia de remuneração — Fechamento por Bruto Alvo', 14, 15);
  doc.setFontSize(9);
  doc.text(`${cab.empresa} · Competência ${cab.competencia} · Dias úteis ${cab.diasUteis} · Dias DSR ${cab.diasDsr} · Divisor ${cab.divisor}`, 14, 21);
  let y = 26;
  for (const b of blocos) {
    autoTable(doc, {
      startY: y,
      head: [[`${b.codigo} – ${b.nome}`, 'Ref. decimal', 'Ref. HH:MM', `Alvo ${brl(b.alvo)}`]],
      body: [...linhasBloco(b), ['TOTAL PREVISTO', '', '', brl(b.res.bruto)], ['Diferença p/ alvo', '', '', brl(b.diferenca)]],
      theme: 'grid', styles: { fontSize: 8, cellPadding: 1.2 }, headStyles: { fillColor: [98, 142, 63] },
      columnStyles: { 1: { halign: 'right', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 22 }, 3: { halign: 'right', cellWidth: 30 } },
      didParseCell: (d) => {
        const lbl = String((d.row.raw as any)?.[0] || '');
        if (d.section === 'body' && lbl.startsWith('TOTAL')) d.cell.styles.fontStyle = 'bold';
        if (d.section === 'body' && lbl.includes('não exportado')) d.cell.styles.textColor = [110, 110, 110];
        if (d.section === 'body' && lbl.startsWith('Diferença') && d.column.index === 3) d.cell.styles.textColor = Math.abs(b.diferenca) <= cab.tolerancia ? [40, 130, 40] : [200, 40, 40];
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.text(`Página ${i} de ${n}`, 196, 290, { align: 'right' }); }
  doc.save(`previa-bruto-alvo-${cab.competencia.replace('/', '-')}.pdf`);
}

export function excelPrevia(cab: Cabecalho, blocos: BlocoPrevia[]) {
  const rows: any[][] = [[`Competência ${cab.competencia}`, `Dias úteis ${cab.diasUteis}`, `Dias DSR ${cab.diasDsr}`, `Divisor ${cab.divisor}`], []];
  for (const b of blocos) {
    rows.push([`${b.codigo} – ${b.nome}`, 'Ref. decimal', 'Ref. HH:MM', 'Valor', `Alvo ${brl(b.alvo)}`]);
    linhasBloco(b).forEach((l) => rows.push([l[0], l[1], l[2], Number(l[3].replace(/\./g, '').replace(',', '.'))]));
    rows.push(['TOTAL PREVISTO', '', '', b.res.bruto], ['Diferença p/ alvo', '', '', b.diferenca], []);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 55 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Prévia');
  XLSX.writeFile(wb, `previa-bruto-alvo-${cab.competencia.replace('/', '-')}.xlsx`);
}
