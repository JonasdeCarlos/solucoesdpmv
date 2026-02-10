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
import logoMonteVerde from '@/assets/logo-monte-verde.png';

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
    outrosDescontos: 0,
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
    // Auto-fill step2 suggestions
    if (step1.dataAdmissao && step1.dataDesligamento) {
      const meses13 = Math.min(12, diffMonths(new Date(step1.dataDesligamento.getFullYear(), 0, 1), step1.dataDesligamento));
      const totalMesesVinculo = diffMonths(step1.dataAdmissao, step1.dataDesligamento);
      const mesesFerias = totalMesesVinculo % 12;
      const diaDesl = step1.dataDesligamento.getDate();
      const ultimoDiaMes = new Date(step1.dataDesligamento.getFullYear(), step1.dataDesligamento.getMonth() + 1, 0).getDate();
      // Se trabalhou até o último dia do mês, considerar mês completo (30/30)
      const diasMes = diaDesl >= ultimoDiaMes ? 30 : diaDesl;
      setStep2((prev) => ({
        ...prev,
        meses13Proporcional: prev.meses13Proporcional || meses13,
        mesesFeriasProporcional: prev.mesesFeriasProporcional || mesesFerias,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4 md:py-6 flex items-center gap-3">
          <img src={logoMonteVerde} alt="Monte Verde Contabilidade" className="h-10 md:h-14 w-auto" />
          <div>
            <h1 className="text-lg md:text-2xl font-bold leading-tight">Monte Verde Contabilidade</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Calculadora de Rescisão CLT — Cálculo estimativo</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container max-w-4xl mx-auto px-4 py-6 md:py-10">
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
      </main>

      {/* Footer disclaimer */}
      <footer className="border-t mt-auto">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ Cálculo estimativo. Pode variar conforme CCT, médias, adicionais, descontos legais e particularidades do contrato. Consulte um profissional.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
