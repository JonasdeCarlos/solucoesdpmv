import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, FileText, Copy, Download } from 'lucide-react';
import { type Step1Data, type Step3Data, type VerbaRescisoria, calcularTotal, MOTIVO_TERMO_TITULO, MOTIVO_TERMO_CORPO } from '@/utils/calculations';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { numberToWords } from '@/utils/numberToWords';
import ResultsTable from '@/components/ResultsTable';
import { toast } from 'sonner';

interface Step3Props {
  step1: Step1Data;
  verbas: VerbaRescisoria[];
  data: Step3Data;
  onChange: (data: Step3Data) => void;
  onVerbaUpdate: (verbas: VerbaRescisoria[]) => void;
  onBack: () => void;
}

const Step3PartiesAndTerm = ({ step1, verbas, data, onChange, onVerbaUpdate, onBack }: Step3Props) => {
  const update = (partial: Partial<Step3Data>) => {
    onChange({ ...data, ...partial });
  };

  const total = calcularTotal(verbas);
  const motivoTitulo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toUpperCase() || 'OUTROS') : MOTIVO_TERMO_TITULO[step1.motivo];
  const motivoCorpo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toLowerCase() || 'outros') : MOTIVO_TERMO_CORPO[step1.motivo];
  const tipoEmpregador = data.empregadorTipo === 'domestico' ? 'empregador doméstico' : 'empresa';

  const generateTableText = (): string => {
    let text = 'VERBA | REF | VALOR\n';
    text += '-'.repeat(50) + '\n';
    verbas.forEach((v) => {
      const sign = v.tipo === 'debito' ? '- ' : '';
      text += `${v.verba} | ${v.referencia} | ${sign}${formatCurrency(v.valor)}\n`;
    });
    text += '-'.repeat(50) + '\n';
    text += `TOTAL GERAL | | ${formatCurrency(total)}\n`;
    return text;
  };

  const generateTermText = (): string => {
    const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '___/___/______';
    const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '___/___/______';
    const hoje = formatDate(new Date());

    return `TERMO DE RESCISÃO DE CONTRATO DE TRABALHO EM COMUM, NÃO PERSONIFICADO, ${motivoTitulo}.

As partes desta rescisão, ${data.empregadorNome || '[NOME DO EMPREGADOR]'}, CPF sob número ${data.empregadorCPF || '[CPF]'}, residente e domiciliado ${data.empregadorEndereco || '[ENDEREÇO]'}${data.empregadorTipo === 'empresa' && data.empregadorCNPJ ? `, CNPJ ${data.empregadorCNPJ}` : ''}, de agora em diante denominada simplesmente EMPREGADOR e ${data.empregadoNome || '[NOME DO EMPREGADO]'}, CPF sob número ${data.empregadoCPF || '[CPF]'}, residente e domiciliada ${data.empregadoEndereco || '[ENDEREÇO]'}, de agora em diante denominado simplesmente empregado.

O período trabalhado compreende a vigência de ${dataAdm} a ${dataDesl}.

Salário: ${formatCurrency(step1.salarioMensal)}

Os haveres:
${generateTableText()}
Eu ${data.empregadoNome || '[NOME DO EMPREGADO]'}, já identificada, declaro neste ato ter recebido a quantia de ${formatCurrency(total)} (${numberToWords(total)}), referentes à rescisão de contrato de trabalho não personificada, ${motivoCorpo}, com o ${tipoEmpregador} já identificado acima;
E por assim estarmos justos e contratados, firmo o presente termo em uma única via que servirá como recibo para o empregador.

________________, ${hoje}

_________________________________
${data.empregadoNome || '[NOME DO EMPREGADO]'}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateTermText());
    toast.success('Termo copiado para a área de transferência!');
  };

  const handleDownloadTerm = () => {
    downloadTextFile(generateTermText(), 'termo-rescisao.txt');
    toast.success('Termo baixado!');
  };

  const handleDownloadDemo = () => {
    downloadTextFile(generateTableText(), 'demonstrativo-verbas.txt');
    toast.success('Demonstrativo baixado!');
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
              onValueChange={(v) => update({ empregadorTipo: v as 'domestico' | 'empresa' })}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="domestico" id="tipo-domestico" />
                <Label htmlFor="tipo-domestico">Empregador doméstico</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="empresa" id="tipo-empresa" />
                <Label htmlFor="tipo-empresa">Empresa</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={data.empregadorNome} onChange={(e) => update({ empregadorNome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={data.empregadorCPF} onChange={(e) => update({ empregadorCPF: e.target.value })} placeholder="000.000.000-00" />
            </div>
          </div>
          {data.empregadorTipo === 'empresa' && (
            <div className="space-y-2">
              <Label>CNPJ (opcional)</Label>
              <Input value={data.empregadorCNPJ} onChange={(e) => update({ empregadorCNPJ: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
          )}
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
            <FileText className="w-4 h-4" /> Gerar Termo (TXT)
          </Button>
          <Button onClick={handleDownloadDemo} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Baixar Demonstrativo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Step3PartiesAndTerm;
