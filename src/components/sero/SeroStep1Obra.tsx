import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { SeroObra, CategoriaObra, TipoObra, TecnicaConstrutiva } from '@/types/sero';
import { TIPO_OBRA_LABELS, CATEGORIA_LABELS, TECNICA_LABELS, UF_LIST } from '@/types/sero';

interface Props {
  obra: SeroObra;
  onChange: (o: SeroObra) => void;
  onNext: () => void;
}

const SeroStep1Obra: React.FC<Props> = ({ obra, onChange, onNext }) => {
  const set = <K extends keyof SeroObra>(k: K, v: SeroObra[K]) =>
    onChange({ ...obra, [k]: v });

  const canNext = obra.cno && obra.data_inicio && obra.area_principal > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação da Obra (CNO)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>CNO *</Label>
            <Input value={obra.cno} onChange={e => set('cno', e.target.value)} placeholder="00.000.00000/00" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={obra.responsavel_tipo} onValueChange={v => set('responsavel_tipo', v as 'PF' | 'PJ')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do Responsável</Label>
            <Input value={obra.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} />
          </div>
          <div>
            <Label>{obra.responsavel_tipo === 'PF' ? 'CPF' : 'CNPJ'}</Label>
            <Input value={obra.responsavel_doc} onChange={e => set('responsavel_doc', e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Select value={obra.uf} onValueChange={v => set('uf', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Município</Label>
            <Input value={obra.municipio} onChange={e => set('municipio', e.target.value)} />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label>Endereço</Label>
            <Input value={obra.endereco} onChange={e => set('endereco', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datas e Classificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Data de Início *</Label>
            <Input type="date" value={obra.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
          </div>
          <div>
            <Label>Término / Previsão</Label>
            <Input type="date" value={obra.data_termino || obra.data_termino_previsto} onChange={e => set('data_termino_previsto', e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={obra.categoria} onValueChange={v => set('categoria', v as CategoriaObra)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIA_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo / Destinação</Label>
            <Select value={obra.tipo_obra} onValueChange={v => set('tipo_obra', v as TipoObra)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_OBRA_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Técnica Construtiva</Label>
            <Select value={obra.tecnica_construtiva} onValueChange={v => set('tecnica_construtiva', v as TecnicaConstrutiva)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TECNICA_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch checked={obra.contabilidade_regular} onCheckedChange={v => set('contabilidade_regular', v)} />
            <Label>Contabilidade Regular?</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Áreas (m²)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Área Principal (m²) *</Label>
            <Input type="number" min={0} value={obra.area_principal || ''} onChange={e => set('area_principal', Number(e.target.value))} />
          </div>
          <div>
            <Label>Áreas Complementares (m²)</Label>
            <Input type="number" min={0} value={obra.area_complementar || ''} onChange={e => set('area_complementar', Number(e.target.value))} placeholder="Garagem, varanda, edícula..." />
          </div>
          <div className="flex items-end">
            <div className="bg-muted rounded-md px-4 py-2 text-sm font-mono">
              Total: {(Number(obra.area_principal) + Number(obra.area_complementar)).toFixed(2)} m²
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canNext} className="gap-2">
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SeroStep1Obra;
