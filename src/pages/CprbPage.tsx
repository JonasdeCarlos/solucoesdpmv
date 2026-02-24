import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StepIndicator from '@/components/StepIndicator';
import CprbStep1Premissas, { CprbPremissas } from '@/components/cprb/CprbStep1Premissas';
import CprbStep2LegalParams from '@/components/cprb/CprbStep2LegalParams';
import CprbStep3Simulation from '@/components/cprb/CprbStep3Simulation';
import CprbStep4Report from '@/components/cprb/CprbStep4Report';
import DasSimulation from '@/components/cprb/DasSimulation';
import { useCprbLegalParameters } from '@/hooks/useCprbLegalParameters';
import { useCprbSimulations } from '@/hooks/useCprbSimulations';
import { useDasAnexosFaixas } from '@/hooks/useDasParameters';
import { calcularComparativoCprb, CprbConsolidatedResult } from '@/utils/cprbCalculations';
import { calcularDas, DasConsolidatedResult, DasFaixa } from '@/utils/dasCalculations';
import { distribuirMensal } from '@/utils/cprbCalculations';
import { toast } from 'sonner';

const STEP_LABELS = ['Premissas', 'Parâmetros Legais', 'Simulação', 'Relatório'];

const defaultPremissas = (): CprbPremissas => {
  const now = new Date();
  return {
    empresaNome: '',
    cnpj: '',
    cnae: '',
    competenciaInicial: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    horizonteMeses: 12,
    tipoAnalise: 'consolidada',
    receitaTotal: 0,
    folhaTotal: 0,
    decimoTerceiro: 0,
    proLabore: 0,
    percentualCrescimento: 0,
    areaM2Total: 0,
    incluirFerias: true,
    incluirTercoFerias: true,
    incluirDecimoTerceiro: true,
    incluirFgts: true,
    incluirMultaFgts: false,
    percentualMultaFgts: 0.40,
    incluirRatFap: false,
    aliquotaRatFap: 0.03,
    incluirTerceiros: false,
    aliquotaTerceiros: 0.058,
    percentualRotatividade: 0,
    percentualAbsenteismo: 0,
    incluirDasNoM2: false,
    dasRbt12Inicial: 0,
    dasAnexo: 'IV',
  };
};

const CprbPage = () => {
  const [step, setStep] = useState(1);
  const [premissas, setPremissas] = useState<CprbPremissas>(defaultPremissas);
  const [result, setResult] = useState<CprbConsolidatedResult | null>(null);
  const [dasResult, setDasResult] = useState<DasConsolidatedResult | null>(null);
  const [isCalculated, setIsCalculated] = useState(false);

  const { data: legalParams } = useCprbLegalParameters();
  const { data: faixasDb } = useDasAnexosFaixas();
  const { save } = useCprbSimulations();

  const handleCalculate = () => {
    if (!legalParams || legalParams.length === 0) {
      toast.error('Cadastre parâmetros legais antes de simular.');
      return;
    }
    if (premissas.receitaTotal <= 0 || premissas.folhaTotal <= 0) {
      toast.error('Informe receita e folha projetadas.');
      return;
    }

    const res = calcularComparativoCprb(
      { ...premissas, legalParams: [] },
      legalParams.map((p) => ({
        competencia_inicio: p.competencia_inicio,
        competencia_fim: p.competencia_fim,
        aliquota_cprb: Number(p.aliquota_cprb),
        percentual_cprb_transicao: Number(p.percentual_cprb_transicao),
        percentual_folha_transicao: Number(p.percentual_folha_transicao),
        aliquota_patronal_folha: Number(p.aliquota_patronal_folha),
      }))
    );

    // Run DAS simulation if enabled
    let dasRes: DasConsolidatedResult | null = null;
    if (premissas.incluirDasNoM2 && faixasDb && faixasDb.length > 0 && premissas.dasRbt12Inicial > 0) {
      const receitasMensais = distribuirMensal(
        premissas.receitaTotal,
        premissas.horizonteMeses,
        premissas.percentualCrescimento
      );

      const faixas: DasFaixa[] = faixasDb.map((f) => ({
        anexo: f.anexo,
        faixa: f.faixa,
        rbt12_min: Number(f.rbt12_min),
        rbt12_max: Number(f.rbt12_max),
        aliquota_nominal: Number(f.aliquota_nominal),
        parcela_deduzir: Number(f.parcela_deduzir),
      }));

      dasRes = calcularDas(
        {
          competenciaInicial: premissas.competenciaInicial,
          horizonteMeses: premissas.horizonteMeses,
          rbt12Inicial: premissas.dasRbt12Inicial,
          receitasMensais,
          atividades: [{ anexo: premissas.dasAnexo, percentualReceita: 1 }],
          exigeFatorR: false,
          folha12mInicial: 0,
          folhasMensais: [],
        },
        faixas
      );
    }

    setResult(res);
    setDasResult(dasRes);
    setIsCalculated(true);
    toast.success('Simulação calculada com sucesso!');
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        nome: `Simulação ${premissas.empresaNome || 'sem nome'} — ${premissas.competenciaInicial}`,
        empresa_nome: premissas.empresaNome,
        cnpj: premissas.cnpj,
        cnae: premissas.cnae,
        competencia_inicial: premissas.competenciaInicial,
        horizonte_meses: premissas.horizonteMeses,
        tipo_analise: premissas.tipoAnalise,
        receita_total: premissas.receitaTotal,
        folha_total: premissas.folhaTotal,
        decimo_terceiro: premissas.decimoTerceiro,
        pro_labore: premissas.proLabore,
        percentual_crescimento: premissas.percentualCrescimento,
        incluir_ferias: premissas.incluirFerias,
        incluir_terco_ferias: premissas.incluirTercoFerias,
        incluir_decimo_terceiro: premissas.incluirDecimoTerceiro,
        incluir_fgts: premissas.incluirFgts,
        incluir_multa_fgts: premissas.incluirMultaFgts,
        percentual_multa_fgts: premissas.percentualMultaFgts,
        incluir_rat_fap: premissas.incluirRatFap,
        aliquota_rat_fap: premissas.aliquotaRatFap,
        incluir_terceiros: premissas.incluirTerceiros,
        aliquota_terceiros: premissas.aliquotaTerceiros,
        percentual_rotatividade: premissas.percentualRotatividade,
        percentual_absenteismo: premissas.percentualAbsenteismo,
      });
      toast.success('Cenário salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar cenário.');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">CPRB x Folha & DAS (Simples Nacional)</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Simuladores tributários para construtoras — Simples Nacional
      </p>

      <Tabs defaultValue="cprb" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="cprb">Comparativo CPRB x Folha</TabsTrigger>
          <TabsTrigger value="das">Simulação DAS (Simples)</TabsTrigger>
        </TabsList>

        <TabsContent value="cprb">
          <StepIndicator currentStep={step} totalSteps={4} labels={STEP_LABELS} />

          {step === 1 && (
            <CprbStep1Premissas
              premissas={premissas}
              onChange={(p) => { setPremissas(p); setIsCalculated(false); }}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <CprbStep2LegalParams
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <CprbStep3Simulation
              result={result}
              dasResult={dasResult}
              premissas={premissas}
              isCalculated={isCalculated}
              onCalculate={handleCalculate}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <CprbStep4Report
              premissas={premissas}
              result={result}
              dasResult={dasResult}
              onBack={() => setStep(3)}
              onSave={handleSave}
              isSaving={save.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="das">
          <DasSimulation />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CprbPage;
