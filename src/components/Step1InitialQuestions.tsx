import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { type Step1Data, type MotivoRescisao, MOTIVO_LABELS } from '@/utils/calculations';

function parseDateBR(text: string): Date | null {
  const clean = text.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const day = parseInt(clean.slice(0, 2));
  const month = parseInt(clean.slice(2, 4));
  const year = parseInt(clean.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
  return d;
}

function maskDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
}

const Step1InitialQuestions = ({ data, onChange, onNext }: Step1Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [admText, setAdmText] = useState(data.dataAdmissao ? format(data.dataAdmissao, 'dd/MM/yyyy') : '');
  const [deslText, setDeslText] = useState(data.dataDesligamento ? format(data.dataDesligamento, 'dd/MM/yyyy') : '');

  const update = (partial: Partial<Step1Data>) => {
    onChange({ ...data, ...partial });
  };

  // Auto-set multa percentage based on motivo
  useEffect(() => {
    if (data.motivo === 'dispensa_sem_justa_causa') {
      update({ percentualMultaFGTS: 40 });
    } else if (data.motivo === 'comum_acordo') {
      update({ percentualMultaFGTS: 20 });
    } else if (data.motivo === 'pedido_demissao' || data.motivo === 'dispensa_justa_causa') {
      update({ percentualMultaFGTS: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.motivo]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!data.dataAdmissao) errs.dataAdmissao = 'Obrigatório';
    if (!data.dataDesligamento) errs.dataDesligamento = 'Obrigatório';
    if (data.dataAdmissao && data.dataDesligamento && data.dataDesligamento < data.dataAdmissao) {
      errs.dataDesligamento = 'Deve ser posterior à admissão';
    }
    if (!data.salarioMensal || data.salarioMensal <= 0) errs.salarioMensal = 'Obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Verifica se o intervalo entre admissão e desligamento é > 1 ano
  const temMaisDeUmAno = useMemo(() => {
    if (!data.dataAdmissao || !data.dataDesligamento) return false;
    const diffMs = data.dataDesligamento.getTime() - data.dataAdmissao.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 365;
  }, [data.dataAdmissao, data.dataDesligamento]);

  // Anos completos entre admissão e desligamento (excluindo o ano do desligamento, que é o proporcional)
  const anosAnteriores = useMemo(() => {
    if (!data.dataAdmissao || !data.dataDesligamento) return [];
    const anoAdm = data.dataAdmissao.getFullYear();
    const anoDesl = data.dataDesligamento.getFullYear();
    const anos: number[] = [];
    for (let y = anoAdm; y < anoDesl; y++) {
      anos.push(y);
    }
    return anos;
  }, [data.dataAdmissao, data.dataDesligamento]);

  // Auto-desabilitar férias vencidas se não tem mais de 1 ano
  useEffect(() => {
    if (!temMaisDeUmAno && data.temFeriasVencidas) {
      update({ temFeriasVencidas: false, periodosVencidos: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temMaisDeUmAno]);

  const handleNext = () => {
    if (validate()) onNext();
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Dados do Contrato</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Datas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data de admissão *</Label>
            <div className="flex gap-2">
              <Input
                placeholder="dd/mm/aaaa"
                value={admText}
                onChange={(e) => {
                  const masked = maskDateBR(e.target.value);
                  setAdmText(masked);
                  const parsed = parseDateBR(masked);
                  if (parsed) update({ dataAdmissao: parsed });
                  if (masked === '') update({ dataAdmissao: null });
                }}
                onBlur={() => {
                  const parsed = parseDateBR(admText);
                  if (parsed) {
                    update({ dataAdmissao: parsed });
                    setAdmText(format(parsed, 'dd/MM/yyyy'));
                  } else if (admText && admText.replace(/\D/g, '').length > 0) {
                    // Invalid date, reset to last valid
                    setAdmText(data.dataAdmissao ? format(data.dataAdmissao, 'dd/MM/yyyy') : '');
                  }
                }}
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={data.dataAdmissao || undefined}
                    onSelect={(d) => {
                      update({ dataAdmissao: d || null });
                      setAdmText(d ? format(d, 'dd/MM/yyyy') : '');
                    }}
                    locale={ptBR}
                    className="pointer-events-auto"
                    captionLayout="dropdown-buttons"
                    fromYear={1960}
                    toYear={2030}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.dataAdmissao && <p className="text-sm text-destructive">{errors.dataAdmissao}</p>}
          </div>

          <div className="space-y-2">
            <Label>Data de desligamento *</Label>
            <div className="flex gap-2">
              <Input
                placeholder="dd/mm/aaaa"
                value={deslText}
                onChange={(e) => {
                  const masked = maskDateBR(e.target.value);
                  setDeslText(masked);
                  const parsed = parseDateBR(masked);
                  if (parsed) update({ dataDesligamento: parsed });
                  if (masked === '') update({ dataDesligamento: null });
                }}
                onBlur={() => {
                  const parsed = parseDateBR(deslText);
                  if (parsed) {
                    update({ dataDesligamento: parsed });
                    setDeslText(format(parsed, 'dd/MM/yyyy'));
                  } else if (deslText && deslText.replace(/\D/g, '').length > 0) {
                    setDeslText(data.dataDesligamento ? format(data.dataDesligamento, 'dd/MM/yyyy') : '');
                  }
                }}
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={data.dataDesligamento || undefined}
                    onSelect={(d) => {
                      update({ dataDesligamento: d || null });
                      setDeslText(d ? format(d, 'dd/MM/yyyy') : '');
                    }}
                    locale={ptBR}
                    className="pointer-events-auto"
                    captionLayout="dropdown-buttons"
                    fromYear={1960}
                    toYear={2030}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.dataDesligamento && <p className="text-sm text-destructive">{errors.dataDesligamento}</p>}
          </div>
        </div>

        {/* Salário */}
        <div className="space-y-2">
          <Label>Salário mensal (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={data.salarioMensal || ''}
            onChange={(e) => update({ salarioMensal: parseFloat(e.target.value) || 0 })}
          />
          {errors.salarioMensal && <p className="text-sm text-destructive">{errors.salarioMensal}</p>}
        </div>

        {/* Motivo */}
        <div className="space-y-2">
          <Label>Motivo da rescisão</Label>
          <Select value={data.motivo} onValueChange={(v) => update({ motivo: v as MotivoRescisao })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {Object.entries(MOTIVO_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data.motivo === 'outros' && (
            <Input
              placeholder="Descreva o motivo..."
              value={data.motivoOutroTexto}
              onChange={(e) => update({ motivoOutroTexto: e.target.value })}
              className="mt-2"
            />
          )}
        </div>

        {/* Condicionais */}
        <div className="space-y-4 border-t pt-4">
          {/* Desconto aviso - só pedido demissão */}
          {data.motivo === 'pedido_demissao' && (
            <div className="space-y-3 p-4 rounded-lg bg-secondary">
              <div className="flex items-center justify-between">
                <Label>Desconta aviso prévio?</Label>
                <Switch checked={data.descontaAvisoPrevio} onCheckedChange={(v) => update({ descontaAvisoPrevio: v })} />
              </div>
              {data.descontaAvisoPrevio && (
                <div className="space-y-2">
                  <Label className="text-sm">Dias de aviso</Label>
                  <Input
                    type="number"
                    min={1}
                    value={data.diasAvisoDesconto}
                    onChange={(e) => update({ diasAvisoDesconto: parseInt(e.target.value) || 30 })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Férias vencidas */}
          <div className={cn("space-y-3 p-4 rounded-lg bg-secondary", !temMaisDeUmAno && "opacity-50")}>
            <div className="flex items-center justify-between">
              <Label className={!temMaisDeUmAno ? "text-muted-foreground" : ""}>
                Há férias vencidas?
                {!temMaisDeUmAno && <span className="block text-xs font-normal mt-1">Disponível apenas para contratos com mais de 1 ano</span>}
              </Label>
              <Switch checked={data.temFeriasVencidas} onCheckedChange={(v) => update({ temFeriasVencidas: v })} disabled={!temMaisDeUmAno} />
            </div>
            {data.temFeriasVencidas && (
              <div className="space-y-2">
                <Label className="text-sm">Períodos vencidos</Label>
                <Input
                  type="number"
                  min={1}
                  value={data.periodosVencidos}
                  onChange={(e) => update({ periodosVencidos: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>

          {/* FGTS */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between">
              <Label>Calcula FGTS do período?</Label>
              <Switch checked={data.calculaFGTS} onCheckedChange={(v) => update({ calculaFGTS: v })} />
            </div>
          </div>

          {/* Multa FGTS */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between">
              <Label>Calcula Multa do FGTS?</Label>
              <Switch checked={data.calculaMultaFGTS} onCheckedChange={(v) => update({ calculaMultaFGTS: v })} />
            </div>
            {data.calculaMultaFGTS && (
              <div className="space-y-2">
                <Label className="text-sm">Percentual (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={data.percentualMultaFGTS}
                  onChange={(e) => update({ percentualMultaFGTS: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>

          {/* Aviso prévio indenizado */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between">
              <Label>Calcula Aviso Prévio Indenizado?</Label>
              <Switch checked={data.calculaAvisoPrevioIndenizado} onCheckedChange={(v) => update({ calculaAvisoPrevioIndenizado: v })} />
            </div>
            {data.calculaAvisoPrevioIndenizado && (
              <div className="space-y-2">
                <Label className="text-sm">Dias</Label>
                <Input
                  type="number"
                  min={1}
                  value={data.diasAvisoPrevioIndenizado}
                  onChange={(e) => update({ diasAvisoPrevioIndenizado: parseInt(e.target.value) || 30 })}
                />
          {/* 13º anos anteriores */}
          {anosAnteriores.length > 0 && (
            <div className="space-y-3 p-4 rounded-lg bg-secondary">
              <div className="flex items-center justify-between">
                <Label>Calcular 13º de anos anteriores?</Label>
                <Switch
                  checked={data.calcula13AnosAnteriores}
                  onCheckedChange={(v) => {
                    update({ calcula13AnosAnteriores: v, anos13Selecionados: v ? [...anosAnteriores] : [] });
                  }}
                />
              </div>
              {data.calcula13AnosAnteriores && (
                <div className="space-y-2">
                  <Label className="text-sm">Selecione os anos</Label>
                  <div className="flex flex-wrap gap-3">
                    {anosAnteriores.map((ano) => (
                      <label key={ano} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={data.anos13Selecionados.includes(ano)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...data.anos13Selecionados, ano].sort()
                              : data.anos13Selecionados.filter((a) => a !== ano);
                            update({ anos13Selecionados: next });
                          }}
                        />
                        <span className="text-sm">{ano}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleNext} size="lg" className="gap-2">
            Próximo <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step1InitialQuestions;
