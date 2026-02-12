import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, FileText, Copy, Download, Calculator } from 'lucide-react';
import { type Step1Data, type Step2Data, type Step3Data, type VerbaRescisoria, calcularTotal, MOTIVO_TERMO_TITULO, MOTIVO_TERMO_CORPO, MOTIVO_LABELS } from '@/utils/calculations';
import { calcularFgtsDetalhado } from '@/utils/fgtsDetail';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { numberToWords } from '@/utils/numberToWords';
import ResultsTable from '@/components/ResultsTable';
import { toast } from 'sonner';
import { generateTermoPDF, generateDemonstrativoPDF, generateMemoriaPDF, generateTermoEMemoriaPDF } from '@/utils/pdfGenerator';

interface Step3Props {
  step1: Step1Data;
  step2: Step2Data;
  verbas: VerbaRescisoria[];
  data: Step3Data;
  onChange: (data: Step3Data) => void;
  onVerbaUpdate: (verbas: VerbaRescisoria[]) => void;
  onBack: () => void;
}

const Step3PartiesAndTerm = ({ step1, step2, verbas, data, onChange, onVerbaUpdate, onBack }: Step3Props) => {
  const update = (partial: Partial<Step3Data>) => {
    onChange({ ...data, ...partial });
  };

  const total = calcularTotal(verbas);
  const motivoTitulo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toUpperCase() || 'OUTROS') : MOTIVO_TERMO_TITULO[step1.motivo];
  const motivoCorpo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toLowerCase() || 'outros') : MOTIVO_TERMO_CORPO[step1.motivo];
  const tipoEmpregador = data.empregadorTipo === 'domestico' ? 'empregador doméstico' : 'empresa';

  const generateTableText = (): string => {
    const verbasNaoZero = verbas.filter(v => v.valor !== 0);
    const hasDebito = verbasNaoZero.some(v => v.tipo === 'debito');

    if (hasDebito) {
      let text = 'VERBA | REF | CRÉDITO | DÉBITO\n';
      text += '-'.repeat(55) + '\n';
      verbasNaoZero.forEach((v) => {
        const credito = v.tipo === 'debito' ? '' : formatCurrency(v.valor);
        const debito = v.tipo === 'debito' ? formatCurrency(v.valor) : '';
        text += `${v.verba} | ${v.referencia} | ${credito} | ${debito}\n`;
      });
      text += '-'.repeat(55) + '\n';
      text += `TOTAL GERAL | | ${formatCurrency(total)} |\n`;
      return text;
    } else {
      let text = 'VERBA | REF | VALOR\n';
      text += '-'.repeat(50) + '\n';
      verbasNaoZero.forEach((v) => {
        text += `${v.verba} | ${v.referencia} | ${formatCurrency(v.valor)}\n`;
      });
      text += '-'.repeat(50) + '\n';
      text += `TOTAL GERAL | | ${formatCurrency(total)}\n`;
      return text;
    }
  };

  const generateTermText = (): string => {
    const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '___/___/______';
    const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '___/___/______';
    const local = data.localAssinatura || '________________';
    const dataAss = data.dataAssinatura ? formatDate(new Date(data.dataAssinatura + 'T12:00:00')) : formatDate(new Date());

    return `TERMO DE RESCISÃO DE CONTRATO DE TRABALHO EM COMUM, NÃO PERSONIFICADO, ${motivoTitulo}.

As partes desta rescisão, ${data.empregadorNome || '[NOME DO EMPREGADOR]'}, ${data.empregadorTipo === 'empresa' ? `CNPJ sob número ${data.empregadorCNPJ || '[CNPJ]'}` : `CPF sob número ${data.empregadorCPF || '[CPF]'}`}, residente e domiciliado ${data.empregadorEndereco || '[ENDEREÇO]'}, de agora em diante denominada simplesmente EMPREGADOR e ${data.empregadoNome || '[NOME DO EMPREGADO]'}, CPF sob número ${data.empregadoCPF || '[CPF]'}, residente e domiciliada ${data.empregadoEndereco || '[ENDEREÇO]'}, de agora em diante denominado simplesmente empregado.

O período trabalhado compreende a vigência de ${dataAdm} a ${dataDesl}.

Salário: ${formatCurrency(step1.salarioMensal)}

Os haveres:
${generateTableText()}
Eu ${data.empregadoNome || '[NOME DO EMPREGADO]'}, já identificada, declaro neste ato ter recebido a quantia de ${formatCurrency(total)} (${numberToWords(total)}), referentes à rescisão de contrato de trabalho não personificada, ${motivoCorpo}, com o ${tipoEmpregador} já identificado acima;
E por assim estarmos justos e contratados, firmo o presente termo em uma única via que servirá como recibo para o empregador.

${local}, ${dataAss}

_________________________________
${data.empregadoNome || '[NOME DO EMPREGADO]'}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateTermText());
    toast.success('Termo copiado para a área de transferência!');
  };

  const handleDownloadTerm = () => {
    generateTermoPDF(step1, step2, data, verbas);
    toast.success('Termo PDF gerado!');
  };

  const handleDownloadTermoEMemoria = () => {
    generateTermoEMemoriaPDF(step1, step2, data, verbas);
    toast.success('Termo + Memória de Cálculo gerados em um único PDF!');
  };

  const handleDownloadDemo = () => {
    generateDemonstrativoPDF(verbas);
    toast.success('Demonstrativo PDF gerado!');
  };

  const generateMemoriaCalculo = (): string => {
    const sal = step1.salarioMensal;
    const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '—';
    const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '—';
    const motivo = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];

    // Helper: verba exists and has non-zero value
    const verbaAtiva = (id: string) => verbas.some(v => v.id === id && v.valor !== 0);

    let lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════');
    lines.push('           MEMÓRIA DE CÁLCULO - RESCISÃO CLT');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Admissão: ${dataAdm}`);
    lines.push(`Desligamento: ${dataDesl}`);
    lines.push(`Salário mensal: ${formatCurrency(sal)}`);
    lines.push(`Motivo: ${motivo}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────────');

    let itemNum = 1;

    // Saldo de salário
    if (verbaAtiva('saldo_salario')) {
      const saldoSal = (sal / 30) * step2.diasTrabalhadosMes;
      lines.push('');
      lines.push(`${itemNum}) SALDO DE SALÁRIO`);
      lines.push(`   Fórmula: Salário / 30 × dias trabalhados no mês`);
      lines.push(`   ${formatCurrency(sal)} / 30 × ${step2.diasTrabalhadosMes} = ${formatCurrency(saldoSal)}`);
      itemNum++;
    }

    // 13º proporcional
    if (verbaAtiva('13_proporcional')) {
      const decimo = sal * (step2.meses13Proporcional / 12);
      lines.push('');
      lines.push(`${itemNum}) 13º SALÁRIO PROPORCIONAL`);
      lines.push(`   Fórmula: Salário × (meses / 12)`);
      lines.push(`   ${formatCurrency(sal)} × (${step2.meses13Proporcional}/12) = ${formatCurrency(decimo)}`);
      itemNum++;
    }

    // Férias proporcionais
    const feriasProp = sal * (step2.mesesFeriasProporcional / 12);
    let totalFerias = feriasProp;

    if (verbaAtiva('ferias_proporcionais')) {
      lines.push('');
      lines.push(`${itemNum}) FÉRIAS PROPORCIONAIS`);
      lines.push(`   Fórmula: Salário × (meses / 12)`);
      lines.push(`   ${formatCurrency(sal)} × (${step2.mesesFeriasProporcional}/12) = ${formatCurrency(feriasProp)}`);
      itemNum++;
    }

    // Férias vencidas
    if (step1.temFeriasVencidas && step1.periodosVencidos > 0 && verbaAtiva('ferias_vencidas')) {
      const feriasVenc = sal * step1.periodosVencidos;
      totalFerias += feriasVenc;
      lines.push('');
      lines.push(`${itemNum}) FÉRIAS VENCIDAS`);
      lines.push(`   Fórmula: Salário × períodos vencidos`);
      lines.push(`   ${formatCurrency(sal)} × ${step1.periodosVencidos} = ${formatCurrency(feriasVenc)}`);
      itemNum++;
    }

    // 1/3 férias
    if (step2.consideraTercoFerias && verbaAtiva('terco_ferias')) {
      const terco = totalFerias / 3;
      lines.push('');
      lines.push(`${itemNum}) 1/3 CONSTITUCIONAL SOBRE FÉRIAS`);
      lines.push(`   Fórmula: (Férias proporcionais${step1.temFeriasVencidas ? ' + Férias vencidas' : ''}) / 3`);
      lines.push(`   ${formatCurrency(totalFerias)} / 3 = ${formatCurrency(terco)}`);
      itemNum++;
    }

    // Aviso prévio indenizado
    if (step1.calculaAvisoPrevioIndenizado && verbaAtiva('aviso_previo_indenizado')) {
      const aviso = (sal / 30) * step1.diasAvisoPrevioIndenizado;
      lines.push('');
      lines.push(`${itemNum}) AVISO PRÉVIO INDENIZADO`);
      lines.push(`   Fórmula: Salário / 30 × dias de aviso`);
      lines.push(`   ${formatCurrency(sal)} / 30 × ${step1.diasAvisoPrevioIndenizado} = ${formatCurrency(aviso)}`);
      itemNum++;
    }

    // Reflexos aviso prévio
    if (verbaAtiva('reflexo_aviso_13')) {
      const mesesProj = step1.diasAvisoPrevioIndenizado / 30;
      const reflexo13 = (sal / 12) * mesesProj;
      lines.push('');
      lines.push(`${itemNum}) 13º — PROJEÇÃO AVISO PRÉVIO`);
      lines.push(`   ${formatCurrency(sal)} / 12 × ${Math.round(mesesProj)} = ${formatCurrency(reflexo13)}`);
      itemNum++;
    }
    if (verbaAtiva('reflexo_aviso_ferias')) {
      const mesesProj = step1.diasAvisoPrevioIndenizado / 30;
      const reflexoFerias = (sal / 12) * mesesProj;
      lines.push('');
      lines.push(`${itemNum}) FÉRIAS — PROJEÇÃO AVISO PRÉVIO`);
      lines.push(`   ${formatCurrency(sal)} / 12 × ${Math.round(mesesProj)} = ${formatCurrency(reflexoFerias)}`);
      itemNum++;
    }
    if (verbaAtiva('reflexo_aviso_terco')) {
      const mesesProj = step1.diasAvisoPrevioIndenizado / 30;
      const reflexoFerias = (sal / 12) * mesesProj;
      const tercoRef = reflexoFerias / 3;
      lines.push('');
      lines.push(`${itemNum}) 1/3 FÉRIAS — PROJEÇÃO AVISO PRÉVIO`);
      lines.push(`   ${formatCurrency(reflexoFerias)} / 3 = ${formatCurrency(tercoRef)}`);
      itemNum++;
    }

    // Desconto aviso prévio
    if (step1.motivo === 'pedido_demissao' && step1.descontaAvisoPrevio && verbaAtiva('desconto_aviso')) {
      const desc = (sal / 30) * step1.diasAvisoDesconto;
      lines.push('');
      lines.push(`${itemNum}) DESCONTO AVISO PRÉVIO (DÉBITO)`);
      lines.push(`   Fórmula: Salário / 30 × dias de aviso`);
      lines.push(`   ${formatCurrency(sal)} / 30 × ${step1.diasAvisoDesconto} = -${formatCurrency(desc)}`);
      itemNum++;
    }

    // FGTS
    if (step1.calculaFGTS && verbaAtiva('fgts')) {
      if (step2.fgtsManual !== null && step2.fgtsManual > 0) {
        lines.push('');
        lines.push(`${itemNum}) FGTS DO PERÍODO (informado manualmente)`);
        lines.push(`   Valor informado: ${formatCurrency(step2.fgtsManual)}`);
      } else {
        const decimo = sal * (step2.meses13Proporcional / 12);
        const fgtsDetail = calcularFgtsDetalhado(
          sal, step1.dataAdmissao, step1.dataDesligamento,
          decimo, step2.incluir13AnosAnteriores
        );

        lines.push('');
        lines.push(`${itemNum}) FGTS DO PERÍODO — DETALHAMENTO MÊS A MÊS`);
        lines.push(`   Fórmula mensal: Salário / 30 × dias trabalhados`);
        lines.push('');
        lines.push('   Mês         | Dias | Base (R$)');
        lines.push('   ' + '-'.repeat(42));
        fgtsDetail.meses.forEach(m => {
          lines.push(`   ${m.mes.padEnd(12)} | ${String(m.diasTrabalhados).padStart(4)} | ${formatCurrency(m.valorBase)}`);
        });
        lines.push('   ' + '-'.repeat(42));
        lines.push(`   Subtotal salarial: ${formatCurrency(fgtsDetail.baseSalarial)}`);
        lines.push(`   + 13º proporcional: ${formatCurrency(fgtsDetail.baseDecimo)}`);
        if (fgtsDetail.base13Anterior > 0) {
          lines.push(`   + 13º anos anteriores: ${formatCurrency(fgtsDetail.base13Anterior)}`);
        }
        lines.push(`   Base total FGTS: ${formatCurrency(fgtsDetail.baseTotal)}`);
        lines.push(`   FGTS = 8% × ${formatCurrency(fgtsDetail.baseTotal)} = ${formatCurrency(fgtsDetail.fgtsTotal)}`);

        if (step1.calculaMultaFGTS && step1.percentualMultaFGTS > 0 && verbaAtiva('multa_fgts')) {
          const multa = fgtsDetail.fgtsTotal * (step1.percentualMultaFGTS / 100);
          itemNum++;
          lines.push('');
          lines.push(`${itemNum}) MULTA FGTS`);
          lines.push(`   Fórmula: ${step1.percentualMultaFGTS}% × FGTS total`);
          lines.push(`   ${step1.percentualMultaFGTS}% × ${formatCurrency(fgtsDetail.fgtsTotal)} = ${formatCurrency(multa)}`);
        }
      }
      itemNum++;
    }

    // Outros
    if (step2.outrosCreditos > 0 && verbaAtiva('outros_creditos')) {
      lines.push('');
      lines.push(`${itemNum}) OUTROS CRÉDITOS: ${formatCurrency(step2.outrosCreditos)}`);
      itemNum++;
    }
    if (step2.outrosDescontos > 0 && verbaAtiva('outros_descontos')) {
      lines.push('');
      lines.push(`${itemNum}) OUTROS DESCONTOS (DÉBITO): -${formatCurrency(step2.outrosDescontos)}`);
      itemNum++;
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────────');
    lines.push(`TOTAL GERAL: ${formatCurrency(total)}`);
    lines.push(`Por extenso: ${numberToWords(total)}`);
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    lines.push('⚠️ Cálculo estimativo. Pode variar conforme CCT,');
    lines.push('médias, adicionais, descontos legais e');
    lines.push('particularidades do contrato.');

    return lines.join('\n');
  };

  const handleDownloadMemoria = () => {
    generateMemoriaPDF(step1, step2, verbas);
    toast.success('Memória de cálculo PDF gerada!');
  };

  const handleCopyMemoria = () => {
    navigator.clipboard.writeText(generateMemoriaCalculo());
    toast.success('Memória de cálculo copiada!');
  };

  const downloadTextFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Editable results table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Demonstrativo de Verbas (editável)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable verbas={verbas} editable onUpdate={onVerbaUpdate} />
          <p className="text-sm text-muted-foreground mt-2">
            Total por extenso: <strong>{numberToWords(total)}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Party data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Dados do Empregador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={data.empregadorTipo}
              onValueChange={(v) => update({ empregadorTipo: v as 'domestico' | 'empresa', empregadorCPF: '', empregadorCNPJ: '' })}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="domestico" id="tipo-domestico" />
                <Label htmlFor="tipo-domestico">Empregador doméstico (CPF)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="empresa" id="tipo-empresa" />
                <Label htmlFor="tipo-empresa">Empresa (CNPJ)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={data.empregadorNome} onChange={(e) => update({ empregadorNome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{data.empregadorTipo === 'empresa' ? 'CNPJ' : 'CPF'}</Label>
              {data.empregadorTipo === 'empresa' ? (
                <Input value={data.empregadorCNPJ} onChange={(e) => update({ empregadorCNPJ: e.target.value })} placeholder="00.000.000/0000-00" />
              ) : (
                <Input value={data.empregadorCPF} onChange={(e) => update({ empregadorCPF: e.target.value })} placeholder="000.000.000-00" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço completo</Label>
            <Input value={data.empregadorEndereco} onChange={(e) => update({ empregadorEndereco: e.target.value })} placeholder="Logradouro, nº, Cidade/UF, CEP" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Dados do Empregado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={data.empregadoNome} onChange={(e) => update({ empregadoNome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={data.empregadoCPF} onChange={(e) => update({ empregadoCPF: e.target.value })} placeholder="000.000.000-00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço completo</Label>
            <Input value={data.empregadoEndereco} onChange={(e) => update({ empregadoEndereco: e.target.value })} placeholder="Logradouro, nº, Cidade/UF" />
          </div>
        </CardContent>
      </Card>

      {/* Local e Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Local e Data da Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Local (cidade/UF)</Label>
              <Input value={data.localAssinatura} onChange={(e) => update({ localAssinatura: e.target.value })} placeholder="Ex: São Paulo/SP" />
            </div>
            <div className="space-y-2">
              <Label>Data da assinatura</Label>
              <Input type="date" value={data.dataAssinatura} onChange={(e) => update({ dataAssinatura: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" /> Copiar Termo
          </Button>
          <Button onClick={handleDownloadTerm} className="gap-2">
            <FileText className="w-4 h-4" /> Gerar Termo (PDF)
          </Button>
          <Button onClick={handleDownloadDemo} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Baixar Demonstrativo
          </Button>
          <Button onClick={handleDownloadTermoEMemoria} className="gap-2">
            <FileText className="w-4 h-4" /> Termo + Memória (PDF)
          </Button>
          <Button onClick={handleDownloadMemoria} variant="outline" className="gap-2">
            <Calculator className="w-4 h-4" /> Memória de Cálculo
          </Button>
          <Button onClick={handleCopyMemoria} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" /> Copiar Memória
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Step3PartiesAndTerm;
