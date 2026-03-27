import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { format, parse } from 'date-fns';
import { calcularDataPagamentoSugerida, formatCompetencia } from '@/utils/rescisaoDateUtils';

interface CapaData {
  employeeName: string;
  terminationDate: string;
  paymentDateSuggested: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
}

interface Props {
  data: CapaData;
  onChange: (data: CapaData) => void;
  onNext: () => void;
}

const RescisaoStep1Capa: React.FC<Props> = ({ data, onChange, onNext }) => {
  const update = (key: keyof CapaData, value: string) => {
    onChange({ ...data, [key]: value });
  };

  useEffect(() => {
    if (data.terminationDate) {
      const dt = new Date(data.terminationDate + 'T12:00:00');
      if (!isNaN(dt.getTime())) {
        const suggested = calcularDataPagamentoSugerida(dt);
        const sugStr = format(suggested, 'yyyy-MM-dd');
        const comp = formatCompetencia(dt);
        onChange({
          ...data,
          paymentDateSuggested: sugStr,
          paymentDateFinal: data.paymentDateFinal || sugStr,
          competenceMonth: comp,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.terminationDate]);

  const isValid = data.employeeName.trim() && data.terminationDate && data.paymentDateFinal;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Nome do Empregado *</Label>
          <Input
            value={data.employeeName}
            onChange={(e) => update('employeeName', e.target.value)}
            placeholder="Nome completo"
          />
        </div>

        <div className="space-y-2">
          <Label>Data da Rescisão *</Label>
          <Input
            type="date"
            value={data.terminationDate}
            onChange={(e) => update('terminationDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Data de Pagamento *</Label>
          <Input
            type="date"
            value={data.paymentDateFinal}
            onChange={(e) => update('paymentDateFinal', e.target.value)}
          />
          {data.paymentDateSuggested && (
            <p className="text-xs text-muted-foreground">
              Data sugerida: {format(new Date(data.paymentDateSuggested + 'T12:00:00'), 'dd/MM/yyyy')} — art. 477, §6º CLT
            </p>
          )}
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Sugestão baseada no art. 477, §6º da CLT (10 dias corridos). Confirme conforme a situação e regras aplicáveis.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Empresa</Label>
          <Input
            value={data.companyName}
            onChange={(e) => update('companyName', e.target.value)}
            placeholder="Razão social"
          />
        </div>
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input
            value={data.companyCnpj}
            onChange={(e) => update('companyCnpj', e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>Competência</Label>
          <Input value={data.competenceMonth} readOnly className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Conferido por</Label>
          <Input
            value={data.checkedBy}
            onChange={(e) => update('checkedBy', e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isValid}>
          Próximo: Upload de Documentos
        </Button>
      </div>
    </div>
  );
};

export default RescisaoStep1Capa;
