import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  listarDias, diaSemana, fmtBRAno, rodapeFundamentos, validarEscala,
  type EscalaFuncionario, type EscalaParams,
} from './motor';

const SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const cel = (t?: string) => (t === 'F' ? 'F' : t === 'FC' ? 'FC' : t === 'A' ? 'A' : 'T');

export interface ExportInfo {
  cliente: { nome?: string; cnpj?: string };
  params: EscalaParams;
  funcionarios: EscalaFuncionario[];
  aprovadoEm?: string | null;
}

/** Agrupa funcionários por setor (ordem de aparição; sem setor vai por último). Sem nenhum setor = um grupo só. */
export function gruposPorSetor(fs: EscalaFuncionario[]): { setor: string; funcs: EscalaFuncionario[] }[] {
  const m = new Map<string, EscalaFuncionario[]>();
  fs.forEach((f) => { const k = (f.setor || '').trim(); (m.get(k) || m.set(k, []).get(k)!).push(f); });
  const g = [...m.entries()].filter(([k]) => k).map(([setor, funcs]) => ({ setor, funcs }));
  if (m.has('')) g.push({ setor: g.length ? 'Sem setor' : '', funcs: m.get('')! });
  return g;
}
const trab = (fs: EscalaFuncionario[], d: string) => fs.filter((f) => (f.dias[d] || 'T') === 'T').length;

function meses(p: EscalaParams) {
  const m = new Map<string, string[]>();
  listarDias(p.data_inicio, p.data_fim).forEach((d) => { const k = d.slice(0, 7); (m.get(k) || m.set(k, []).get(k)!).push(d); });
  return [...m.entries()];
}

export function gerarPdf(info: ExportInfo, final = false) {
  const { params: p, funcionarios: fs, cliente } = info;
  const res = validarEscala(p, fs, { pdfFinal: final, cliente });
  if (final && res.bloqueios.length) throw new Error('Há bloqueios pendentes:\n' + res.bloqueios.map((b) => b.mensagem).join('\n'));
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const fer = new Set(p.feriados.map((f) => f.data));
  meses(p).forEach(([mes, dias], idx) => {
    if (idx) doc.addPage();
    doc.setFillColor(98, 142, 63); doc.roundedRect(8, 8, W - 16, 18, 3, 3, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('QUADRO DE ESCALA DE REVEZAMENTO (art. 67, p.u., CLT)', 12, 15);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`${cliente.nome || ''}  ·  CNPJ ${cliente.cnpj || '—'}  ·  Setor: ${p.setor || '—'}  ·  ${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`, 12, 22);
    doc.setTextColor(57, 52, 33);
    autoTable(doc, {
      startY: 30,
      head: [['Funcionário', ...dias.map((d) => `${d.slice(8)}\n${SEM[diaSemana(d)]}`)]],
      body: gruposPorSetor(fs).flatMap((g) => {
        const linhas: any[] = g.funcs.map((f) => [`${f.codigo ? f.codigo + ' ' : ''}${f.nome}${f.cargo ? '\n' + f.cargo : ''}`, ...dias.map((d) => cel(f.dias[d]))]);
        if (!g.setor) return linhas;
        return [
          [{ content: `SETOR: ${g.setor.toUpperCase()} (${g.funcs.length})`, colSpan: dias.length + 1, styles: { halign: 'left', fontStyle: 'bold', fillColor: [98, 142, 63], textColor: 255 } }],
          ...linhas,
          [{ content: 'Trabalhando no setor', styles: { halign: 'left', fontStyle: 'italic' } }, ...dias.map((d) => ({ content: String(trab(g.funcs, d)), styles: { fontStyle: 'bold', fillColor: [245, 245, 240] } }))],
        ];
      }),
      styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center', lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [57, 52, 33], textColor: 255, fontSize: 6 },
      columnStyles: { 0: { halign: 'left', cellWidth: 46 } },
      margin: { left: 8, right: 8 },
      didParseCell: (h) => {
        if (h.column.index === 0 || typeof h.cell.raw === 'object') return;
        const d = dias[h.column.index - 1];
        if (h.section === 'head' && (diaSemana(d) === 0 || fer.has(d))) h.cell.styles.fillColor = [98, 142, 63];
        if (h.section !== 'body') return;
        const v = h.cell.raw;
        if (v === 'F') h.cell.styles.fillColor = [225, 232, 242];
        if (v === 'FC') h.cell.styles.fillColor = [253, 230, 160];
        if (v === 'A') h.cell.styles.fillColor = [230, 230, 230];
      },
    });
    let y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(7);
    doc.text('Legenda: T = trabalho · F = folga (DSR) · FC = folga compensatória de feriado · A = afastado/férias · colunas verdes = domingos e feriados', 8, y); y += 4;
    const ferMes = p.feriados.filter((f) => f.data.startsWith(mes));
    if (ferMes.length) { doc.text('Feriados: ' + ferMes.map((f) => `${fmtBRAno(f.data)} ${f.nome}`).join('; '), 8, y); y += 4; }
    const al = res.alertas.filter((a) => a.id !== 'R07');
    if (al.length) {
      const linhas = doc.splitTextToSize('Pendências registradas (ALERTA): ' + al.slice(0, 25).map((a) => a.mensagem).join(' | '), W - 16);
      doc.setTextColor(150, 80, 0); doc.text(linhas.slice(0, 5), 8, y); y += 3.2 * Math.min(5, linhas.length) + 1; doc.setTextColor(57, 52, 33);
    }
    doc.text(doc.splitTextToSize(rodapeFundamentos(p, fs), W - 16).slice(0, 3), 8, y);
    doc.line(W - 110, H - 16, W - 10, H - 16);
    doc.text(`${p.responsavel_nome || 'Responsável'} — assinatura`, W - 110, H - 12);
    doc.text('Data de afixação: ____/____/______', 8, H - 12);
    if (info.aprovadoEm) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Revisada por Monte Verde Contabilidade em ${fmtBRAno(info.aprovadoEm.slice(0, 10))}`, W / 2, H - 6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }
    doc.text(`Página ${idx + 1}`, W - 10, H - 6, { align: 'right' });
  });
  doc.save(`escala-${(cliente.nome || 'empresa').replace(/\W+/g, '-')}-${p.data_inicio}.pdf`);
}

export function gerarXlsx(info: ExportInfo) {
  const { params: p, funcionarios: fs, cliente } = info;
  const wb = XLSX.utils.book_new();
  meses(p).forEach(([mes, dias]) => {
    const rows: any[][] = [
      [`Quadro de escala de revezamento — ${cliente.nome || ''} — CNPJ ${cliente.cnpj || ''}`],
      [`Setor: ${p.setor || ''} — ${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`],
      [],
      ['Código', 'Funcionário', 'Cargo', ...dias.map((d) => `${d.slice(8)} ${SEM[diaSemana(d)]}`)],
      ...gruposPorSetor(fs).flatMap((g) => {
        const linhas = g.funcs.map((f) => [f.codigo, f.nome, f.cargo || '', ...dias.map((d) => cel(f.dias[d]))]);
        return g.setor ? [[`SETOR: ${g.setor}`], ...linhas, ['', 'Trabalhando no setor', '', ...dias.map((d) => trab(g.funcs, d))], []] : linhas;
      }),
      [],
      ['Legenda: T trabalho, F folga, FC folga compensatória de feriado, A afastado'],
      [rodapeFundamentos(p, fs)],
    ];
    if (info.aprovadoEm) rows.push([`Revisada por Monte Verde Contabilidade em ${fmtBRAno(info.aprovadoEm.slice(0, 10))}`]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 32 }, ...dias.map(() => ({ wch: 5 }))];
    XLSX.utils.book_append_sheet(wb, ws, mes);
  });
  XLSX.writeFile(wb, `escala-${(cliente.nome || 'empresa').replace(/\W+/g, '-')}-${p.data_inicio}.xlsx`);
}
