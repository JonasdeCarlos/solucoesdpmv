import { useState, useEffect } from 'react';
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

const STORAGE_KEY = 'calc_rescisao_state_v1';

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Revive Date objects
    if (parsed.step1) {
      if (parsed.step1.dataAdmissao) parsed.step1.dataAdmissao = new Date(parsed.step1.dataAdmissao);
      if (parsed.step1.dataDesligamento) parsed.step1.dataDesligamento = new Date(parsed.step1.dataDesligamento);
    }
    return parsed;
  } catch {
    return null;
  }
};

const Index = () => {
  const persisted = loadPersisted();

  const [currentStep, setCurrentStep] = useState<number>(persisted?.currentStep ?? 1);
  const [verbas, setVerbas] = useState<VerbaRescisoria[]>(persisted?.verbas ?? []);

  const [step1, setStep1] = useState<Step1Data>(persisted?.step1 ?? {
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

  const [step2, setStep2] = useState<Step2Data>(persisted?.step2 ?? {
    diasTrabalhadosMes: 15,
    meses13Proporcional: 0,
    mesesFeriasProporcional: 0,
    consideraTercoFerias: true,
    outrosDescontos: [],
    outrosCreditos: [],
    incluir13AnosAnteriores: false,
    fgtsManual: null,
  });

  const [step3, setStep3] = useState<Step3Data>(persisted?.step3 ?? {
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

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStep, verbas, step1, step2, step3 })
      );
    } catch {}
  }, [currentStep, verbas, step1, step2, step3]);

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
