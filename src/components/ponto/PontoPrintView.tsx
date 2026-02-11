import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { type PontoIdentificacao, type PontoConfig, type PontoDiaCalculado } from '@/types/ponto';
import { type PontoResumo, minutesToHHMM } from '@/utils/pontoCalculations';

const MARCACAO_LABELS_4 = ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];
const MARCACAO_LABELS_6 = ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída'];

interface Props {
  identificacao: PontoIdentificacao;
  config: PontoConfig;
  diasCalculados: PontoDiaCalculado[];
  resumo: PontoResumo;
}

const PontoPrintView: React.FC<Props> = ({ identificacao, config, diasCalculados, resumo }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const labels = config.colunasMarcacoes === 6 ? MARCACAO_LABELS_6 : MARCACAO_LABELS_4;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Apuração de Ponto - ${identificacao.empregadoNome || 'Empregado'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 9pt; padding: 15mm; color: #222; }
          h2 { font-size: 13pt; margin-bottom: 4px; }
          .header { margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
          .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 8.5pt; margin-top: 6px; }
          .header-grid div { line-height: 1.5; }
          .label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8pt; }
          th, td { border: 1px solid #999; padding: 2px 3px; text-align: center; }
          th { background: #eee; font-weight: bold; font-size: 7.5pt; }
          .text-left { text-align: left; }
          .positive { color: #166534; }
          .negative { color: #991b1b; }
          .summary { margin-top: 12px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 8.5pt; }
          .summary-item { text-align: center; border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
          .summary-item .label { font-size: 7pt; color: #666; text-transform: uppercase; }
          .summary-item .value { font-size: 11pt; font-weight: bold; font-family: monospace; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
          .sig-line { text-align: center; width: 45%; }
          .sig-line hr { border: none; border-top: 1px solid #333; margin-bottom: 4px; }
          .disclaimer { margin-top: 16px; font-size: 7pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const saldoClass = (v: number) => v > 0 ? 'positive' : v < 0 ? 'negative' : '';

  const mesAnoFormatado = (() => {
    const [y, m] = identificacao.mesAno.split('-');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${meses[parseInt(m) - 1] || m}/${y}`;
  })();

  return (
    <div>
      <Button onClick={handlePrint} className="mb-4">
        <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
      </Button>

      <div ref={printRef} className="hidden">
        <div className="header">
          <h2>APURAÇÃO DE PONTO</h2>
          <div className="header-grid">
            <div>
              <span className="label">Empresa: </span>{identificacao.empresaNome}<br/>
              <span className="label">CNPJ/CPF: </span>{identificacao.empresaDoc}
              {identificacao.empresaEndereco && (<><br/><span className="label">Endereço: </span>{identificacao.empresaEndereco}</>)}
            </div>
            <div>
              <span className="label">Empregado: </span>{identificacao.empregadoNome}<br/>
              <span className="label">CPF: </span>{identificacao.empregadoCpf}<br/>
              {identificacao.empregadoFuncao && (<><span className="label">Função: </span>{identificacao.empregadoFuncao}<br/></>)}
              <span className="label">Período: </span>{mesAnoFormatado}<br/>
              <span className="label">Jornada: </span>{config.jornadaDiaria}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>DS</th>
              <th>Tipo</th>
              {labels.map((l, i) => <th key={i}>{l}</th>)}
              <th>Cumprir</th>
              <th>Trab.</th>
              <th>Saldo</th>
              <th>Int.Dev</th>
              <th>Not.R</th>
              <th>Not.C</th>
            </tr>
          </thead>
          <tbody>
            {diasCalculados.map(d => (
              <tr key={d.dia}>
                <td>{String(d.dia).padStart(2, '0')}</td>
                <td>{d.diaSemana}</td>
                <td className="text-left">{d.tipoDia}</td>
                {d.marcacoes.map((m, i) => <td key={i}>{m || ''}</td>)}
                <td>{d.horasACumprir}</td>
                <td>{minutesToHHMM(d.trabalhoLiquido)}</td>
                <td className={saldoClass(d.saldoMinutos)}>{minutesToHHMM(d.saldoMinutos)}</td>
                <td style={{color: d.intervaloDevido > 0 ? '#c2410c' : ''}}>{d.intervaloDevido > 0 ? minutesToHHMM(d.intervaloDevido) : ''}</td>
                <td>{d.noturnoReal > 0 ? minutesToHHMM(d.noturnoReal) : ''}</td>
                <td>{d.noturnoConvertido > 0 ? minutesToHHMM(d.noturnoConvertido) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="summary">
          <div className="summary-item"><div className="label">Total Trabalhado</div><div className="value">{minutesToHHMM(resumo.totalTrabalhado)}</div></div>
          <div className="summary-item"><div className="label">Total a Cumprir</div><div className="value">{minutesToHHMM(resumo.totalACumprir)}</div></div>
          <div className="summary-item"><div className="label">Saldo Positivo</div><div className="value positive">{minutesToHHMM(resumo.totalSaldoPositivo)}</div></div>
          <div className="summary-item"><div className="label">Saldo Negativo</div><div className="value negative">{minutesToHHMM(resumo.totalSaldoNegativo)}</div></div>
          <div className="summary-item"><div className="label">Saldo Final</div><div className="value ${saldoClass(resumo.saldoFinal)}">{minutesToHHMM(resumo.saldoFinal)}</div></div>
          <div className="summary-item"><div className="label">Feriados</div><div className="value">{minutesToHHMM(resumo.totalFeriados)}</div></div>
          <div className="summary-item"><div className="label">Folgas/DSR</div><div className="value">{minutesToHHMM(resumo.totalFolgasDsr)}</div></div>
          <div className="summary-item"><div className="label">Noturno Real</div><div className="value">{minutesToHHMM(resumo.totalNoturnoReal)}</div></div>
          <div className="summary-item"><div className="label">Noturno Convertido</div><div className="value">{minutesToHHMM(resumo.totalNoturnoConvertido)}</div></div>
        </div>

        <div className="signatures">
          <div className="sig-line"><hr/> Empregado</div>
          <div className="sig-line"><hr/> Empresa / Responsável</div>
        </div>

        <div className="disclaimer">
          ⚠️ Apuração estimativa para conferência. Pode haver regras específicas por CCT, escalas e acordos.
        </div>
      </div>
    </div>
  );
};

export default PontoPrintView;
