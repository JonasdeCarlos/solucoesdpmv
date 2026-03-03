import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Link2 } from 'lucide-react';
import type { SeroObra } from '@/types/sero';
import { formatBRL } from '@/utils/seroCalculations';

interface Props {
  obra: SeroObra;
  onChange: (o: SeroObra) => void;
  onNext: () => void;
  onBack: () => void;
}

const SeroStep2Folha: React.FC<Props> = ({ obra, onChange, onNext, onBack }) => {
  const set = <K extends keyof SeroObra>(k: K, v: SeroObra[K]) =>
    onChange({ ...obra, [k]: v });

  const custoTotal = Number(obra.folha_total_projetada) + Number(obra.encargos_projetados);
  const rateado = custoTotal * (Number(obra.rateio_valor) / 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Vincular Projeção de Folha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe os valores projetados da folha de pagamento vinculada a esta obra para o período completo
            (início até término). Você pode preencher manualmente ou usar a projeção do módulo CPRB.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Folha Total Projetada (R$)</Label>
              <Input
                type="number"
                min={0}
                value={obra.folha_total_projetada || ''}
                onChange={e => set('folha_total_projetada', Number(e.target.value))}
                placeholder="Soma de todas as competências"
              />
            </div>
            <div>
              <Label>Encargos Projetados (R$)</Label>
              <Input
                type="number"
                min={0}
                value={obra.encargos_projetados || ''}
                onChange={e => set('encargos_projetados', Number(e.target.value))}
                placeholder="INSS patronal + RAT + terceiros"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rateio (quando folha não é 100% da obra)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Critério de Rateio</Label>
            <Select value={obra.rateio_tipo} onValueChange={v => set('rateio_tipo', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual Manual</SelectItem>
                <SelectItem value="m2">Por m²</SelectItem>
                <SelectItem value="receita">Por Receita/Medições</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>% da Folha Vinculada à Obra</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={obra.rateio_valor || ''}
              onChange={e => set('rateio_valor', Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-muted-foreground">Folha + Encargos</p>
              <p className="text-lg font-semibold">{formatBRL(custoTotal)}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-muted-foreground">Rateio ({obra.rateio_valor}%)</p>
              <p className="text-lg font-semibold">{formatBRL(rateado)}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-muted-foreground">Custo MO (Cobertura)</p>
              <p className="text-lg font-semibold text-green-600">{formatBRL(rateado)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={onNext} className="gap-2">
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SeroStep2Folha;
