import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Calculator, Plus, Trash2 } from 'lucide-react';
import { type Step1Data, type Step2Data, type LinhaExtra, type TipoCalculoLinha } from '@/utils/calculations';
import { diffMonths } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVerbas } from '@/hooks/useVerbas';

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

  const { verbas: verbasDB } = useVerbas();

  const calcLinhaValor = (linha: LinhaExtra): number => {
    const sal = step1.salarioMensal || 0;
    const qtd = linha.quantidade || 0;
    if (sal <= 0 || !linha.tipoCalculo || linha.tipoCalculo === 'manual') return linha.valor || 0;
    switch (linha.tipoCalculo) {
      case 'dias':
        return Math.round((sal / 30) * qtd * 100) / 100;
      case 'horas':
        return Math.round((sal / 220) * qtd * 100) / 100;
      case 'hora_extra': {
        const ad = (linha.adicionalPercent ?? 50) / 100;
        return Math.round((sal / 220) * qtd * (1 + ad) * 100) / 100;
      }
      case 'adicional_noturno': {
        const ad = (linha.adicionalPercent ?? 20) / 100;
        return Math.round((sal / 220) * qtd * ad * 100) / 100;
      }
      default:
        return linha.valor || 0;
    }
  };

  const handleAddVerbaFromDB = (verbaId: string) => {
    const v = verbasDB.find((vb) => vb.id === verbaId);
    if (!v) return;
    const ref = Number(v.referenciaPadrao) || 0;
    const adPct = v.tipoCalculo === 'hora_extra' ? 50 : v.tipoCalculo === 'adicional_noturno' ? 20 : 0;
    const parentId = crypto.randomUUID();
    const base: LinhaExtra = {
      id: parentId,
      descricao: v.nome,
      valor: 0,
      tipoCalculo: v.tipoCalculo,
      quantidade: ref,
      adicionalPercent: adPct,
      calculaDSR: v.calculaDSR,
      diasUteis: 22,
      diasNaoUteis: 8,
      incideFGTS: v.padraoPD === 'P' ? v.incideFGTS : false,
    };
    const linha: LinhaExtra = { ...base, valor: calcLinhaValor(base) };
    const novas: LinhaExtra[] = [linha];
    if (v.calculaDSR) {
      const du = 22, dnu = 8;
      const dsrVal = du > 0 ? Math.round((linha.valor / du) * dnu * 100) / 100 : 0;
      novas.push({
        id: crypto.randomUUID(),
        descricao: `DSR ${v.nome}`,
        valor: dsrVal,
        tipoCalculo: 'manual',
        isDSR: true,
        dsrParentId: parentId,
        incideFGTS: v.padraoPD === 'P' ? v.incideFGTS : false,
      });
    }
    if (v.padraoPD === 'P') {
      update({ outrosCreditos: [...data.outrosCreditos, ...novas] });
    } else {
      update({ outrosDescontos: [...data.outrosDescontos, ...novas] });
    }
  };

  const renderLinha = (
    arrKey: 'outrosCreditos' | 'outrosDescontos',
    l: LinhaExtra,
    idx: number,
    placeholder: string,
  ) => {
    const arr = data[arrKey];
    const setArr = (next: LinhaExtra[]) => update({ [arrKey]: next } as Partial<Step2Data>);
    // Garante id estável
    if (!l.id) {
      const next = [...arr];
      next[idx] = { ...l, id: crypto.randomUUID() };
      setArr(next);
      return null;
    }
    const patchLinha = (patch: Partial<LinhaExtra>) => {
      const merged: LinhaExtra = { ...arr[idx], ...patch };
      // Recalcula valor automaticamente quando muda tipo/qtd/adicional
      if ('tipoCalculo' in patch || 'quantidade' in patch || 'adicionalPercent' in patch) {
        merged.valor = calcLinhaValor(merged);
      }
      let next = [...arr];
      next[idx] = merged;
      // Sincroniza DSR filho desta linha (se houver)
      const du = merged.diasUteis || 0;
      const dnu = merged.diasNaoUteis || 0;
      next = next.map((row) => {
        if (row.isDSR && row.dsrParentId === merged.id) {
          const v = du > 0 ? Math.round((merged.valor / du) * dnu * 100) / 100 : 0;
          return { ...row, valor: v, descricao: row.descricao || `DSR ${merged.descricao}` };
        }
        return row;
      });
      // Toggle DSR: cria ou remove linha filha
      if ('calculaDSR' in patch) {
        const hasChild = next.some((r) => r.isDSR && r.dsrParentId === merged.id);
        if (patch.calculaDSR && !hasChild) {
          const v = du > 0 ? Math.round((merged.valor / du) * dnu * 100) / 100 : 0;
          next.splice(idx + 1, 0, {
            id: crypto.randomUUID(),
            descricao: `DSR ${merged.descricao}`,
            valor: v,
            tipoCalculo: 'manual',
            isDSR: true,
            dsrParentId: merged.id,
          });
        } else if (!patch.calculaDSR && hasChild) {
          next = next.filter((r) => !(r.isDSR && r.dsrParentId === merged.id));
        }
      }
      setArr(next);
    };
    const removeLinha = () => {
      // Remove a linha e também seu DSR filho
      const next = arr.filter((r, i) => i !== idx && !(r.isDSR && r.dsrParentId === l.id));
      setArr(next);
    };
    const tipo: TipoCalculoLinha = l.tipoCalculo ?? 'manual';
    const isAuto = tipo !== 'manual';
    const showAdicional = tipo === 'hora_extra' || tipo === 'adicional_noturno';
    const isHora = tipo === 'horas' || tipo === 'hora_extra' || tipo === 'adicional_noturno';
    if (l.isDSR) {
      return (
        <div key={l.id} className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-2 ml-6">
          <span className="text-xs text-muted-foreground">↳</span>
          <Input value={l.descricao} readOnly className="flex-1 h-8 text-sm" />
          <Input value={l.valor ? l.valor.toFixed(2) : '0,00'} readOnly className="w-32 h-8 text-sm" />
          <span className="text-xs text-muted-foreground">DSR (auto)</span>
        </div>
      );
    }
    return (
      <div key={l.id} className="space-y-2 rounded-md border p-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder={placeholder}
            value={l.descricao}
            onChange={(e) => patchLinha({ descricao: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0,00"
            value={l.valor || ''}
            onChange={(e) => patchLinha({ valor: parseFloat(e.target.value) || 0 })}
            className="w-32"
            readOnly={isAuto}
            title={isAuto ? 'Valor calculado automaticamente' : ''}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={removeLinha}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={tipo}
            onValueChange={(v) => patchLinha({ tipoCalculo: v as TipoCalculoLinha })}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="dias">Por dias (sal/30 × qtd)</SelectItem>
              <SelectItem value="horas">Por horas (sal/220 × qtd)</SelectItem>
              <SelectItem value="hora_extra">Hora extra</SelectItem>
              <SelectItem value="adicional_noturno">Adicional noturno</SelectItem>
            </SelectContent>
          </Select>
          {isAuto && (
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">{isHora ? 'Horas (HH:MM):' : 'Qtd:'}</Label>
              {isHora ? (
                <Input
                  type="text"
                  value={l._horaInput ?? (l.quantidade ? String(l.quantidade).replace('.', ',') : '')}
                  placeholder="1:30"
                  title="Ex: 1:30 = 1,50 (centesimal)"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^\d{0,4}(:\d{0,2})?$|^\d*[,.]?\d*$/.test(raw)) return;
                    let qtd = l.quantidade || 0;
                    if (raw.includes(':')) {
                      const [h, m] = raw.split(':');
                      qtd = Math.round(((Number(h) || 0) + (Number(m) || 0) / 60) * 100) / 100;
                    } else if (raw) {
                      qtd = Number(raw.replace(',', '.')) || 0;
                    } else {
                      qtd = 0;
                    }
                    patchLinha({ _horaInput: raw, quantidade: qtd });
                  }}
                  onBlur={() => patchLinha({ _horaInput: undefined })}
                  className="h-8 w-24"
                />
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={l.quantidade || ''}
                  onChange={(e) => patchLinha({ quantidade: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-24"
                />
              )}
            </div>
          )}
          {showAdicional && (
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">%:</Label>
              <Input
                type="number"
                step="1"
                min={0}
                value={l.adicionalPercent ?? ''}
                onChange={(e) => patchLinha({ adicionalPercent: parseFloat(e.target.value) || 0 })}
                className="h-8 w-20"
              />
            </div>
          )}
          {isAuto && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <Label className="text-xs text-muted-foreground">DSR</Label>
              <Switch
                checked={!!l.calculaDSR}
                onCheckedChange={(v) => patchLinha({ calculaDSR: v })}
              />
              {l.calculaDSR && (
                <>
                  <Label className="text-xs text-muted-foreground">Úteis:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={l.diasUteis ?? 22}
                    onChange={(e) => patchLinha({ diasUteis: parseInt(e.target.value) || 0 })}
                    className="h-8 w-16"
                  />
                  <Label className="text-xs text-muted-foreground">N/Úteis:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={l.diasNaoUteis ?? 8}
                    onChange={(e) => patchLinha({ diasNaoUteis: parseInt(e.target.value) || 0 })}
                    className="h-8 w-16"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
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
        {/* Adicionar verba cadastrada */}
        <div className="space-y-2 p-4 rounded-lg border border-dashed">
          <Label>Adicionar verba cadastrada</Label>
          <Select value="" onValueChange={handleAddVerbaFromDB}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma verba do cadastro" />
            </SelectTrigger>
            <SelectContent>
              {verbasDB.length === 0 ? (
                <SelectItem value="__none" disabled>Nenhuma verba cadastrada</SelectItem>
              ) : (
                verbasDB.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome} ({v.padraoPD === 'P' ? 'Provento' : 'Desconto'})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A verba será adicionada à lista de créditos ou descontos conforme o padrão cadastrado. O valor pode ser editado abaixo.
          </p>
        </div>

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
            renderLinha('outrosDescontos', d, idx, 'Natureza do desconto')
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
            renderLinha('outrosCreditos', c, idx, 'Natureza do crédito')
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
