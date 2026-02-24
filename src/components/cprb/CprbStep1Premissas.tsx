import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { formatCurrencyInput, parseCurrencyToNumber } from '@/utils/formatters';

export interface CprbPremissas {
  empresaNome: string;
  cnpj: string;
  cnae: string;
  competenciaInicial: string;
  horizonteMeses: number;
  tipoAnalise: string;
  receitaTotal: number;
  folhaTotal: number;
  decimoTerceiro: number;
  proLabore: number;
  percentualCrescimento: number;
  areaM2Total: number;
  incluirFerias: boolean;
  incluirTercoFerias: boolean;
  incluirDecimoTerceiro: boolean;
  incluirFgts: boolean;
  incluirMultaFgts: boolean;
  percentualMultaFgts: number;
  incluirRatFap: boolean;
  aliquotaRatFap: number;
  incluirTerceiros: boolean;
  aliquotaTerceiros: number;
  percentualRotatividade: number;
  percentualAbsenteismo: number;
}

interface Props {
  premissas: CprbPremissas;
  onChange: (p: CprbPremissas) => void;
  onNext: () => void;
}

const InfoTip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-4 h-4 text-muted-foreground inline ml-1 cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
);

const CurrencyField = ({ label, value, onChange, tip }: { label: string; value: number; onChange: (v: number) => void; tip?: string }) => {
  const [display, setDisplay] = useState(value > 0 ? formatCurrencyInput(String(Math.round(value * 100))) : '');
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}{tip && <InfoTip text={tip} />}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          className="pl-10"
          value={display}
          onChange={(e) => {
            const formatted = formatCurrencyInput(e.target.value);
            setDisplay(formatted);
            onChange(parseCurrencyToNumber(formatted));
          }}
          placeholder="0,00"
        />
      </div>
    </div>
  );
};

const CprbStep1Premissas = ({ premissas, onChange, onNext }: Props) => {
  const update = (partial: Partial<CprbPremissas>) => onChange({ ...premissas, ...partial });

  const now = new Date();
  const defaultComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Dados da empresa */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">Dados da Empresa / Obra</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input value={premissas.empresaNome} onChange={(e) => update({ empresaNome: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input value={premissas.cnpj} onChange={(e) => update({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label>CNAE Principal</Label>
              <Input value={premissas.cnae} onChange={(e) => update({ cnae: e.target.value })} placeholder="4120-4/00" />
            </div>
            <div className="space-y-1">
              <Label>Regime Tributário</Label>
              <Input value="Simples Nacional" disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label>Competência Inicial</Label>
              <Input type="month" value={premissas.competenciaInicial || defaultComp} onChange={(e) => update({ competenciaInicial: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Horizonte (meses)</Label>
              <Input type="number" min={1} max={60} value={premissas.horizonteMeses} onChange={(e) => update({ horizonteMeses: parseInt(e.target.value) || 12 })} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de Análise</Label>
              <Select value={premissas.tipoAnalise} onValueChange={(v) => update({ tipoAnalise: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consolidada">Consolidada</SelectItem>
                  <SelectItem value="por_obra">Por obra</SelectItem>
                  <SelectItem value="ambas">Consolidada + Por obra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Área Total (m²)<InfoTip text="Área total para cálculo de custo por m². Se houver múltiplas obras, some as áreas." /></Label>
              <Input type="number" min={0} step={0.01} value={premissas.areaM2Total || ''} onChange={(e) => update({ areaM2Total: parseFloat(e.target.value) || 0 })} placeholder="0,00" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projeções econômicas */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">Projeções Econômicas (12 meses)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyField label="Receita Bruta Total Projetada" value={premissas.receitaTotal} onChange={(v) => update({ receitaTotal: v })} tip="Soma da receita bruta esperada para os próximos meses" />
            <CurrencyField label="Folha de Pagamento Total Projetada" value={premissas.folhaTotal} onChange={(v) => update({ folhaTotal: v })} tip="Soma da folha esperada para os próximos meses" />
            <CurrencyField label="13º Salário Projetado" value={premissas.decimoTerceiro} onChange={(v) => update({ decimoTerceiro: v })} tip="Valor total do 13º. Se deixar zerado, será calculado automaticamente." />
            <CurrencyField label="Pró-labore" value={premissas.proLabore} onChange={(v) => update({ proLabore: v })} />
            <div className="space-y-1">
              <Label>Crescimento mensal (%)<InfoTip text="Percentual de crescimento/redução mensal aplicado sobre receita e folha." /></Label>
              <Input type="number" step={0.1} value={premissas.percentualCrescimento * 100 || ''} onChange={(e) => update({ percentualCrescimento: (parseFloat(e.target.value) || 0) / 100 })} placeholder="0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parâmetros trabalhistas */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">
            Parâmetros Trabalhistas / Previdenciários
            <InfoTip text="Estes parâmetros compõem o custo gerencial de mão de obra. A comparação tributária CPRB x Folha é calculada separadamente." />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'incluirFerias', label: 'Provisão de Férias' },
              { key: 'incluirTercoFerias', label: '1/3 Constitucional de Férias' },
              { key: 'incluirDecimoTerceiro', label: 'Provisão de 13º' },
              { key: 'incluirFgts', label: 'FGTS Mensal (8%)' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-2 rounded border">
                <Label className="text-sm">{label}</Label>
                <Switch checked={(premissas as any)[key]} onCheckedChange={(v) => update({ [key]: v })} />
              </div>
            ))}
            <div className="flex items-center justify-between p-2 rounded border">
              <Label className="text-sm">Multa FGTS Rescisória</Label>
              <Switch checked={premissas.incluirMultaFgts} onCheckedChange={(v) => update({ incluirMultaFgts: v })} />
            </div>
            {premissas.incluirMultaFgts && (
              <div className="space-y-1">
                <Label className="text-sm">% Multa FGTS</Label>
                <Input type="number" step={1} value={premissas.percentualMultaFgts * 100} onChange={(e) => update({ percentualMultaFgts: (parseFloat(e.target.value) || 0) / 100 })} />
              </div>
            )}
            <div className="flex items-center justify-between p-2 rounded border">
              <Label className="text-sm">RAT/FAP</Label>
              <Switch checked={premissas.incluirRatFap} onCheckedChange={(v) => update({ incluirRatFap: v })} />
            </div>
            {premissas.incluirRatFap && (
              <div className="space-y-1">
                <Label className="text-sm">Alíquota RAT/FAP (%)</Label>
                <Input type="number" step={0.1} value={premissas.aliquotaRatFap * 100} onChange={(e) => update({ aliquotaRatFap: (parseFloat(e.target.value) || 0) / 100 })} />
              </div>
            )}
            <div className="flex items-center justify-between p-2 rounded border">
              <Label className="text-sm">Terceiros (Sistema S, etc.)</Label>
              <Switch checked={premissas.incluirTerceiros} onCheckedChange={(v) => update({ incluirTerceiros: v })} />
            </div>
            {premissas.incluirTerceiros && (
              <div className="space-y-1">
                <Label className="text-sm">Alíquota Terceiros (%)</Label>
                <Input type="number" step={0.1} value={premissas.aliquotaTerceiros * 100} onChange={(e) => update({ aliquotaTerceiros: (parseFloat(e.target.value) || 0) / 100 })} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm">% Rotatividade Estimada</Label>
              <Input type="number" step={1} value={premissas.percentualRotatividade * 100 || ''} onChange={(e) => update({ percentualRotatividade: (parseFloat(e.target.value) || 0) / 100 })} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">% Absenteísmo</Label>
              <Input type="number" step={1} value={premissas.percentualAbsenteismo * 100 || ''} onChange={(e) => update({ percentualAbsenteismo: (parseFloat(e.target.value) || 0) / 100 })} placeholder="0" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg">Próximo: Parâmetros Legais →</Button>
      </div>
    </div>
  );
};

export default CprbStep1Premissas;
