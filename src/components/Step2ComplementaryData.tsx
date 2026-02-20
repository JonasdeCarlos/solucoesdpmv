import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Calculator, Plus, Trash2 } from 'lucide-react';
import { type Step1Data, type Step2Data } from '@/utils/calculations';
import { diffMonths } from '@/utils/formatters';

interface Step2Props {
  step1: Step1Data;
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onBack: () => void;
  onCalculate: () => void;
}

const Step2ComplementaryData = ({ step1, data, onChange, onBack, onCalculate }: Step2Props) => {
  const update = (partial: Partial<Step2Data>) => {
    onChange({ ...data, ...partial });
  };

  // Auto-calculate proportional months
  const mesesProp = step1.dataAdmissao && step1.dataDesligamento
    ? diffMonths(new Date(step1.dataAdmissao.getFullYear(), 0, 1), step1.dataDesligamento)
    : 0;
  const mesesFeriasProp = step1.dataAdmissao && step1.dataDesligamento
    ? diffMonths(step1.dataAdmissao, step1.dataDesligamento) % 12
    : 0;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Dados Complementares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Saldo de salário */}
        <div className="space-y-2">
          <Label>Dias trabalhados no mês da rescisão (1–31)</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={data.diasTrabalhadosMes}
            onChange={(e) => update({ diasTrabalhadosMes: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
          />
        </div>

        {/* 13º proporcional */}
        <div className="space-y-2">
          <Label>13º proporcional — meses no ano do desligamento (X/12)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={12}
              value={data.meses13Proporcional}
              onChange={(e) => update({ meses13Proporcional: Math.min(12, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
            <span className="text-muted-foreground whitespace-nowrap">/ 12</span>
          </div>
          <p className="text-xs text-muted-foreground">Sugestão automática: {Math.min(12, mesesProp)} meses</p>
        </div>

        {/* Férias proporcionais */}
        <div className="space-y-2">
          <Label>Férias proporcionais — meses (X/12)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={12}
              value={data.mesesFeriasProporcional}
              onChange={(e) => update({ mesesFeriasProporcional: Math.min(12, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
            <span className="text-muted-foreground whitespace-nowrap">/ 12</span>
          </div>
          <p className="text-xs text-muted-foreground">Sugestão automática: {Math.min(12, mesesFeriasProp)} meses</p>
        </div>

        {/* 1/3 férias */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
          <Label>Considerar 1/3 constitucional sobre férias?</Label>
          <Switch checked={data.consideraTercoFerias} onCheckedChange={(v) => update({ consideraTercoFerias: v })} />
        </div>

        {/* FGTS options */}
        {step1.calculaFGTS && (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
              <Label>Incluir 13º de anos anteriores no FGTS?</Label>
              <Switch checked={data.incluir13AnosAnteriores} onCheckedChange={(v) => update({ incluir13AnosAnteriores: v })} />
            </div>
            <div className="space-y-2">
              <Label>FGTS já apurado (manual, opcional — sobrescreve cálculo)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="Deixe vazio para calcular automaticamente"
                value={data.fgtsManual ?? ''}
                onChange={(e) => update({ fgtsManual: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
          </>
        )}

        {/* Outros */}
        {/* Outros descontos - múltiplas linhas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Descontos / Adiantamentos</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => update({ outrosDescontos: [...data.outrosDescontos, { descricao: '', valor: 0 }] })}
            >
              <Plus className="w-3 h-3" /> Adicionar desconto
            </Button>
          </div>
          {data.outrosDescontos.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Natureza do desconto"
                value={d.descricao}
                onChange={(e) => {
                  const arr = [...data.outrosDescontos];
                  arr[idx] = { ...arr[idx], descricao: e.target.value };
                  update({ outrosDescontos: arr });
                }}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                value={d.valor || ''}
                onChange={(e) => {
                  const arr = [...data.outrosDescontos];
                  arr[idx] = { ...arr[idx], valor: parseFloat(e.target.value) || 0 };
                  update({ outrosDescontos: arr });
                }}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => {
                  const arr = data.outrosDescontos.filter((_, i) => i !== idx);
                  update({ outrosDescontos: arr });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Outros créditos - múltiplas linhas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Outros Créditos</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => update({ outrosCreditos: [...data.outrosCreditos, { descricao: '', valor: 0 }] })}
            >
              <Plus className="w-3 h-3" /> Adicionar crédito
            </Button>
          </div>
          {data.outrosCreditos.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Natureza do crédito"
                value={c.descricao}
                onChange={(e) => {
                  const arr = [...data.outrosCreditos];
                  arr[idx] = { ...arr[idx], descricao: e.target.value };
                  update({ outrosCreditos: arr });
                }}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                value={c.valor || ''}
                onChange={(e) => {
                  const arr = [...data.outrosCreditos];
                  arr[idx] = { ...arr[idx], valor: parseFloat(e.target.value) || 0 };
                  update({ outrosCreditos: arr });
                }}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => {
                  const arr = data.outrosCreditos.filter((_, i) => i !== idx);
                  update({ outrosCreditos: arr });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button onClick={onCalculate} size="lg" className="gap-2">
            <Calculator className="w-4 h-4" /> Calcular Rescisão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step2ComplementaryData;
