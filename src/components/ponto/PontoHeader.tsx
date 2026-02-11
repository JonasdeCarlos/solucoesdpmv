import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type PontoIdentificacao, type PontoConfig, type DiaSemanaKey, type JornadaSemanal } from '@/types/ponto';

interface Props {
  identificacao: PontoIdentificacao;
  config: PontoConfig;
  onIdentificacaoChange: (id: PontoIdentificacao) => void;
  onConfigChange: (cfg: PontoConfig) => void;
}

const PontoHeader: React.FC<Props> = ({ identificacao, config, onIdentificacaoChange, onConfigChange }) => {
  const setId = (field: keyof PontoIdentificacao, val: string) =>
    onIdentificacaoChange({ ...identificacao, [field]: val });
  const setCfg = (field: keyof PontoConfig, val: any) =>
    onConfigChange({ ...config, [field]: val });

  return (
    <div className="space-y-4">
      {/* Identification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Empresa / Empregador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Razão Social / Nome</Label>
              <Input value={identificacao.empresaNome} onChange={e => setId('empresaNome', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CNPJ / CPF</Label>
              <Input value={identificacao.empresaDoc} onChange={e => setId('empresaDoc', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Endereço (opcional)</Label>
              <Input value={identificacao.empresaEndereco} onChange={e => setId('empresaEndereco', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Empregado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={identificacao.empregadoNome} onChange={e => setId('empregadoNome', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={identificacao.empregadoCpf} onChange={e => setId('empregadoCpf', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Função (opcional)</Label>
                <Input value={identificacao.empregadoFuncao} onChange={e => setId('empregadoFuncao', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Período (mês/ano)</Label>
                <Input type="month" value={identificacao.mesAno} onChange={e => setId('mesAno', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
            <div>
              <Label className="text-xs">Intervalo mínimo</Label>
              <Input value={config.intervaloMinimo} onChange={e => setCfg('intervaloMinimo', e.target.value)} placeholder="01:00" className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Marcações</Label>
              <Select value={String(config.colunasMarcacoes)} onValueChange={v => setCfg('colunasMarcacoes', Number(v) as 4 | 6)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 marcações</SelectItem>
                  <SelectItem value="6">6 marcações</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.tolerancia10min} onCheckedChange={v => setCfg('tolerancia10min', v)} />
              <Label className="text-xs">Tolerância 10 min</Label>
            </div>
            <div>
              <Label className="text-xs">Noturno início</Label>
              <Input value={config.noturnoInicio} onChange={e => setCfg('noturnoInicio', e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Noturno fim</Label>
              <Input value={config.noturnoFim} onChange={e => setCfg('noturnoFim', e.target.value)} className="font-mono" />
            </div>
          </div>

          {/* Weekly schedule grid */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Jornada por dia da semana (hh:mm)</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as DiaSemanaKey[]).map(ds => (
                <div key={ds} className="text-center">
                  <Label className="text-[10px] text-muted-foreground">{ds}</Label>
                  <Input
                    value={config.jornadaSemanal?.[ds] ?? '00:00'}
                    onChange={e => {
                      const newSemanal: JornadaSemanal = {
                        ...(config.jornadaSemanal || { Dom: '00:00', Seg: '08:00', Ter: '08:00', Qua: '08:00', Qui: '08:00', Sex: '08:00', Sáb: '00:00' }),
                        [ds]: e.target.value,
                      };
                      onConfigChange({ ...config, jornadaSemanal: newSemanal });
                    }}
                    className="font-mono text-xs text-center h-8 px-1"
                    placeholder="08:00"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PontoHeader;
