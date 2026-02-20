import { useState } from 'react';
import StepIndicator from '@/components/StepIndicator';
import Step1InitialQuestions from '@/components/Step1InitialQuestions';
import Step2ComplementaryData from '@/components/Step2ComplementaryData';
import Step3PartiesAndTerm from '@/components/Step3PartiesAndTerm';
import ResultsTable from '@/components/ResultsTable';
import { type Step1Data, type Step2Data, type Step3Data, type VerbaRescisoria, calcularVerbas, calcularTotal } from '@/utils/calculations';
import { diffMonths } from '@/utils/formatters';
import { formatCurrency } from '@/utils/formatters';
import { numberToWords } from '@/utils/numberToWords';

const STEP_LABELS = ['Contrato', 'Complementar', 'Termo'];

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [verbas, setVerbas] = useState<VerbaRescisoria[]>([]);

  const [step1, setStep1] = useState<Step1Data>({
    dataAdmissao: null,
    dataDesligamento: null,
    salarioMensal: 0,
    motivo: 'pedido_demissao',
    motivoOutroTexto: '',
    descontaAvisoPrevio: false,
    diasAvisoDesconto: 30,
    temFeriasVencidas: false,
    periodosVencidos: 1,
    calculaFGTS: false,
    calculaMultaFGTS: false,
    percentualMultaFGTS: 0,
    calculaAvisoPrevioIndenizado: false,
    diasAvisoPrevioIndenizado: 30,
    calcula13AnosAnteriores: false,
    anos13Selecionados: [],
  });

  const [step2, setStep2] = useState<Step2Data>({
    diasTrabalhadosMes: 15,
    meses13Proporcional: 0,
    mesesFeriasProporcional: 0,
    consideraTercoFerias: true,
    outrosDescontos: [],
    outrosCreditos: 0,
    incluir13AnosAnteriores: false,
    fgtsManual: null,
  });

  const [step3, setStep3] = useState<Step3Data>({
    empregadorNome: '',
    empregadorCPF: '',
    empregadorEndereco: '',
    empregadorTipo: 'domestico',
    empregadorCNPJ: '',
    empregadoNome: '',
    empregadoCPF: '',
    empregadoEndereco: '',
    localAssinatura: '',
    dataAssinatura: new Date().toISOString().split('T')[0],
  });

  const handleGoToStep2 = () => {
    if (step1.dataAdmissao && step1.dataDesligamento) {
      // 13º proporcional: meses trabalhados no ano do desligamento (desde admissão ou janeiro)
      const anoDesl = step1.dataDesligamento.getFullYear();
      const inicioAno = step1.dataAdmissao.getFullYear() < anoDesl
        ? new Date(anoDesl, 0, 1)
        : step1.dataAdmissao;
      const meses13 = Math.min(12, diffMonths(inicioAno, step1.dataDesligamento));
      const totalMesesVinculo = diffMonths(step1.dataAdmissao, step1.dataDesligamento);
      const mesesFerias = totalMesesVinculo % 12;
      const diaDesl = step1.dataDesligamento.getDate();
      const ultimoDiaMes = new Date(step1.dataDesligamento.getFullYear(), step1.dataDesligamento.getMonth() + 1, 0).getDate();
      const diasMes = diaDesl >= ultimoDiaMes ? 30 : diaDesl;
      setStep2((prev) => ({
        ...prev,
        meses13Proporcional: meses13,
        mesesFeriasProporcional: mesesFerias,
        diasTrabalhadosMes: diasMes,
      }));
    }
    setCurrentStep(2);
  };

  const handleCalculate = () => {
    const result = calcularVerbas(step1, step2);
    setVerbas(result);
    setCurrentStep(3);
  };

  return (
    <div>
      <StepIndicator currentStep={currentStep} totalSteps={3} labels={STEP_LABELS} />

      {currentStep === 1 && (
        <Step1InitialQuestions data={step1} onChange={setStep1} onNext={handleGoToStep2} />
      )}

      {currentStep === 2 && (
        <Step2ComplementaryData
          step1={step1}
          data={step2}
          onChange={setStep2}
          onBack={() => setCurrentStep(1)}
          onCalculate={handleCalculate}
        />
      )}

      {currentStep === 3 && (
        <Step3PartiesAndTerm
          step1={step1}
          step2={step2}
          verbas={verbas}
          data={step3}
          onChange={setStep3}
          onVerbaUpdate={setVerbas}
          onBack={() => setCurrentStep(2)}
        />
      )}
    </div>
  );
};

export default Index;
