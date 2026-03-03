import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { SeroDeducao, SeroRetencao, TipoDeducao } from '@/types/sero';
import { DEDUCAO_LABELS } from '@/types/sero';
import { formatBRL } from '@/utils/seroCalculations';

interface Props {
  deducoes: SeroDeducao[];
  retencoes: SeroRetencao[];
  onDeducoesChange: (d: SeroDeducao[]) => void;
  onRetencoesChange: (r: SeroRetencao[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SeroStep3Deducoes: React.FC<Props> = ({ deducoes, retencoes, onDeducoesChange, onRetencoesChange, onNext, onBack }) => {
  const addDeducao = () => {
    onDeducoesChange([...deducoes, { obra_id: '', tipo: 'concreto_usinado', valor: 0, competencia: '', nf_numero: '' }]);
  };

  const removeDeducao = (i: number) => {
    onDeducoesChange(deducoes.filter((_, idx) => idx !== i));
  };

  const updateDeducao = (i: number, field: string, val: any) => {
    const next = [...deducoes];
    (next[i] as any)[field] = val;
    onDeducoesChange(next);
  };

  const addRetencao = () => {
    onRetencoesChange([...retencoes, { obra_id: '', cnpj_fornecedor: '', fornecedor_nome: '', valor_bruto: 0, competencia: '', retencao_valor: 0, aliquota_retencao: 0.11 }]);
  };

  const removeRetencao = (i: number) => {
    onRetencoesChange(retencoes.filter((_, idx) => idx !== i));
  };

  const updateRetencao = (i: number, field: string, val: any) => {
    const next = [...retencoes];
    (next[i] as any)[field] = val;
    if (field === 'valor_bruto' || field === 'aliquota_retencao') {
      next[i].retencao_valor = Number(next[i].valor_bruto) * Number(next[i].aliquota_retencao);
    }
    onRetencoesChange(next);
  };

  const totalDeducoes = deducoes.reduce((s, d) => s + Number(d.valor), 0);
  const totalRetencoes = retencoes.reduce((s, r) => s + Number(r.retencao_valor), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Deduções (Materiais Usinados)
            <Button size="sm" variant="outline" onClick={addDeducao} className="gap-1">
              <Plus className="w-3 h-3" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deducoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma dedução registrada. Clique em "Adicionar" se houver materiais usinados.</p>
          )}
          {deducoes.map((d, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end border-b pb-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={d.tipo} onValueChange={v => updateDeducao(i, 'tipo', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEDUCAO_LABELS).map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" className="h-8 text-xs" value={d.valor || ''} onChange={e => updateDeducao(i, 'valor', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Competência</Label>
                <Input type="month" className="h-8 text-xs" value={d.competencia} onChange={e => updateDeducao(i, 'competencia', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">NF</Label>
                <Input className="h-8 text-xs" value={d.nf_numero} onChange={e => updateDeducao(i, 'nf_numero', e.target.value)} placeholder="Número" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDeducao(i)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {deducoes.length > 0 && (
            <p className="text-sm font-medium text-right">Total: {formatBRL(totalDeducoes)}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Retenções de NFs (Subempreitada)
            <Button size="sm" variant="outline" onClick={addRetencao} className="gap-1">
              <Plus className="w-3 h-3" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {retencoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma retenção registrada.</p>
          )}
          {retencoes.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border-b pb-3">
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input className="h-8 text-xs" value={r.fornecedor_nome} onChange={e => updateRetencao(i, 'fornecedor_nome', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input className="h-8 text-xs" value={r.cnpj_fornecedor} onChange={e => updateRetencao(i, 'cnpj_fornecedor', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor Bruto</Label>
                <Input type="number" className="h-8 text-xs" value={r.valor_bruto || ''} onChange={e => updateRetencao(i, 'valor_bruto', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Alíq. (%)</Label>
                <Input type="number" className="h-8 text-xs" value={(Number(r.aliquota_retencao) * 100) || ''} onChange={e => updateRetencao(i, 'aliquota_retencao', Number(e.target.value) / 100)} />
              </div>
              <div>
                <Label className="text-xs">Retenção</Label>
                <Input type="number" className="h-8 text-xs" value={r.retencao_valor || ''} readOnly />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRetencao(i)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {retencoes.length > 0 && (
            <p className="text-sm font-medium text-right">Total Retido: {formatBRL(totalRetencoes)}</p>
          )}
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

export default SeroStep3Deducoes;
