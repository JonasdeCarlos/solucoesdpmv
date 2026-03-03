import React, { useState, useMemo } from 'react';
import StepIndicator from '@/components/StepIndicator';
import SeroStep1Obra from './SeroStep1Obra';
import SeroStep2Folha from './SeroStep2Folha';
import SeroStep3Deducoes from './SeroStep3Deducoes';
import SeroStep4Apuracao from './SeroStep4Apuracao';
import SeroStep5Relatorio from './SeroStep5Relatorio';
import { useSeroVauVal, useSeroParametros } from '@/hooks/useSero';
import { calcularSero } from '@/utils/seroCalculations';
import { toast } from 'sonner';
import type { SeroObra, SeroDeducao, SeroRetencao, SeroResultado, SeroVauVal } from '@/types/sero';
import { createDefaultObra } from '@/types/sero';

const STEPS = ['Obra (CNO)', 'Folha', 'Deduções', 'Apuração', 'Relatório'];

const SeroWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [obra, setObra] = useState<SeroObra>(createDefaultObra);
  const [deducoes, setDeducoes] = useState<SeroDeducao[]>([]);
  const [retencoes, setRetencoes] = useState<SeroRetencao[]>([]);
  const [resultado, setResultado] = useState<SeroResultado | null>(null);

  const { data: vauValList } = useSeroVauVal(obra.uf, obra.tipo_obra);
  const { data: params } = useSeroParametros();

  const vauVal: SeroVauVal | null = useMemo(() => {
    if (!vauValList || vauValList.length === 0) return null;
    return vauValList[0] as any;
  }, [vauValList]);

  const handleCalculate = () => {
    if (!vauVal) {
      toast.error(`Tabela VAU/VAL não encontrada para ${obra.uf} / ${obra.tipo_obra}. Cadastre na base.`);
      return;
    }
    if (!params || params.length === 0) {
      toast.error('Parâmetros SERO não carregados.');
      return;
    }
    const r = calcularSero(obra, vauVal as any, params as any, deducoes, retencoes);
    setResultado(r);
    toast.success('Apuração SERO calculada!');
  };

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={step} totalSteps={5} labels={STEPS} />

      {step === 1 && <SeroStep1Obra obra={obra} onChange={setObra} onNext={() => setStep(2)} />}
      {step === 2 && <SeroStep2Folha obra={obra} onChange={setObra} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <SeroStep3Deducoes deducoes={deducoes} retencoes={retencoes} onDeducoesChange={setDeducoes} onRetencoesChange={setRetencoes} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <SeroStep4Apuracao obra={obra} resultado={resultado} vauVal={vauVal as any} onCalculate={handleCalculate} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
      {step === 5 && <SeroStep5Relatorio obra={obra} resultado={resultado} vauVal={vauVal as any} deducoes={deducoes} retencoes={retencoes} onBack={() => setStep(4)} onObraChange={setObra} />}
    </div>
  );
};

export default SeroWizard;
