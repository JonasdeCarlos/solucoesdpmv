import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { type Step1Data, type MotivoRescisao, MOTIVO_LABELS } from '@/utils/calculations';

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
}

const Step1InitialQuestions = ({ data, onChange, onNext }: Step1Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !data.dataAdmissao && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.dataAdmissao ? format(data.dataAdmissao, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={data.dataAdmissao || undefined}
                  onSelect={(d) => update({ dataAdmissao: d || null })}
                  locale={ptBR}
                  className="pointer-events-auto"
                  captionLayout="dropdown-buttons"
                  fromYear={1960}
                  toYear={2030}
                />
              </PopoverContent>
            </Popover>
            {errors.dataAdmissao && <p className="text-sm text-destructive">{errors.dataAdmissao}</p>}
          </div>

          <div className="space-y-2">
            <Label>Data de desligamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !data.dataDesligamento && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.dataDesligamento ? format(data.dataDesligamento, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={data.dataDesligamento || undefined}
                  onSelect={(d) => update({ dataDesligamento: d || null })}
                  locale={ptBR}
                  className="pointer-events-auto"
                  captionLayout="dropdown-buttons"
                  fromYear={1960}
                  toYear={2030}
                />
              </PopoverContent>
            </Popover>
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
          <div className="space-y-3 p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between">
              <Label>Há férias vencidas?</Label>
              <Switch checked={data.temFeriasVencidas} onCheckedChange={(v) => update({ temFeriasVencidas: v })} />
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
