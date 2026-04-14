import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Printer, ShieldCheck, AlertTriangle, XCircle, FileText, Eraser } from 'lucide-react';
import TimeInput from '@/components/ponto/TimeInput';
import {
  type JornadaParams,
  type JornadaDiaConfig,
  type SlotCount,
  createDefaultParams,
  createDefaultDias,
} from '@/types/jornada';
import { analisarJornada, minutesToHHMM } from '@/utils/jornadaCalculations';
import { gerarParecerPdf } from '@/utils/jornadaPdfGenerator';

const STORAGE_KEY = 'jornada_verificacao';

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

const JornadaPage: React.FC = () => {
  const [params, setParams] = useState<JornadaParams>(() => loadState()?.params ?? createDefaultParams());
  const [dias, setDias] = useState<JornadaDiaConfig[]>(() => loadState()?.dias ?? createDefaultDias(4));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  // Save to localStorage
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ params, dias }));
  }, [params, dias]);

  const updateParam = useCallback(<K extends keyof JornadaParams>(key: K, value: JornadaParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSlotsChange = useCallback((val: string) => {
    const s = Number(val) as SlotCount;
    updateParam('slots', s);
    setDias(prev => prev.map(d => {
      const newMarks = Array(s).fill('');
      d.marcacoes.forEach((m, i) => { if (i < s) newMarks[i] = m; });
      return { ...d, marcacoes: newMarks };
    }));
  }, [updateParam]);

  const handleDiaToggle = useCallback((idx: number) => {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, ativo: !d.ativo } : d));
  }, []);

  const handleMarcacao = useCallback((diaIdx: number, slotIdx: number, value: string) => {
    setDias(prev => {
      const updated = prev.map((d, i) => {
        if (i !== diaIdx) return d;
        const newM = [...d.marcacoes];
        newM[slotIdx] = value;
        return { ...d, marcacoes: newM };
      });

      // Quando TODOS os slots da linha editada estiverem completos (HH:MM),
      // replica para todas as linhas ABAIXO que estejam vazias e ativas
      const editedDay = updated[diaIdx];
      const allFilled = editedDay.marcacoes.every(m => /^\d{2}:\d{2}$/.test(m));
      if (allFilled) {
        return updated.map((d, i) => {
          if (i <= diaIdx || !d.ativo) return d;
          const isEmpty = d.marcacoes.every(m => !m);
          if (!isEmpty) return d;
          return { ...d, marcacoes: [...editedDay.marcacoes] };
        });
      }

      return updated;
    });
  }, []);

  const analise = useMemo(() => analisarJornada(dias, params), [dias, params]);

  const statusIcon = analise.statusGeral === 'ok' ? <ShieldCheck className="w-5 h-5 text-green-600" /> :
    analise.statusGeral === 'atencao' ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> :
    <XCircle className="w-5 h-5 text-red-600" />;

  const statusLabel = analise.statusGeral === 'ok' ? 'OK – Sem inconsistências' :
    analise.statusGeral === 'atencao' ? 'Atenção – Alertas encontrados' :
    'Crítico – Inconsistências identificadas';

  const statusVariant = analise.statusGeral === 'ok' ? 'default' as const :
    analise.statusGeral === 'atencao' ? 'secondary' as const : 'destructive' as const;

  const slotLabels = params.slots === 6 ? ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída'] :
    params.slots === 2 ? ['Entrada', 'Saída'] :
    ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];

  const handleGerarPdf = () => {
    const now = new Date();
    const dataEmissao = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const doc = gerarParecerPdf({
      params,
      dias,
      analise,
      observacoesAnalista: observacoes,
      dataEmissao,
    });
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setPreviewOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* PARAMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Verificação de Jornada (CLT)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Empresa</Label>
              <Input value={params.empresaNome} onChange={e => updateParam('empresaNome', e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={params.empresaCnpj} onChange={e => updateParam('empresaCnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Colaborador</Label>
              <Input value={params.colaboradorNome} onChange={e => updateParam('colaboradorNome', e.target.value)} placeholder="Nome do colaborador" />
            </div>
            <div>
              <Label>Função/Cargo</Label>
              <Input value={params.colaboradorFuncao} onChange={e => updateParam('colaboradorFuncao', e.target.value)} placeholder="Função" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Carga Semanal Contratada</Label>
              <Input value={params.cargaSemanalContratada} onChange={e => updateParam('cargaSemanalContratada', e.target.value)} placeholder="44:00" />
            </div>
            <div>
              <Label>Marcações/Dia</Label>
              <Select value={String(params.slots)} onValueChange={handleSlotsChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                  <SelectItem value="6">6 colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período Início</Label>
              <Input type="date" value={params.periodoInicio} onChange={e => updateParam('periodoInicio', e.target.value)} />
            </div>
            <div>
              <Label>Período Fim</Label>
              <Input type="date" value={params.periodoFim} onChange={e => updateParam('periodoFim', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Int. Mínimo (4–6h)</Label>
              <Input value={params.intervaloMinimo4a6h} onChange={e => updateParam('intervaloMinimo4a6h', e.target.value)} placeholder="00:15" />
            </div>
            <div>
              <Label>Int. Mínimo ({'>'}6h)</Label>
              <Input value={params.intervaloMinimoAcima6h} onChange={e => updateParam('intervaloMinimoAcima6h', e.target.value)} placeholder="01:00" />
            </div>
            <div>
              <Label>Interjornada Mínima</Label>
              <Input value={params.interjornadaMinima} onChange={e => updateParam('interjornadaMinima', e.target.value)} placeholder="11:00" />
            </div>
            <div>
              <Label>Tolerância (min)</Label>
              <Input type="number" value={params.toleranciaMinutos} onChange={e => updateParam('toleranciaMinutos', Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={params.noturnoHabilitado} onCheckedChange={v => updateParam('noturnoHabilitado', v)} />
              <Label>Jornada Noturna</Label>
            </div>
            {params.noturnoHabilitado && (
              <>
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Início</Label>
                  <Input className="w-20" value={params.noturnoInicio} onChange={e => updateParam('noturnoInicio', e.target.value)} />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Fim</Label>
                  <Input className="w-20" value={params.noturnoFim} onChange={e => updateParam('noturnoFim', e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SCHEDULE GRID */}
      <Card>
        <CardHeader>
          <CardTitle>Grade de Horários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-16">Dia</th>
                  <th className="p-2 w-12">Ativo</th>
                  {slotLabels.map((l, i) => <th key={i} className="p-2 text-center">{l}</th>)}
                  <th className="p-2 text-center">Trab.</th>
                  <th className="p-2 text-center">Interv.</th>
                  {params.noturnoHabilitado && <>
                    <th className="p-2 text-center">Not.R</th>
                    <th className="p-2 text-center">Not.C</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {dias.map((d, di) => {
                  const calc = analise.dias[di];
                  return (
                    <tr key={d.dia} className={`border-b ${!d.ativo ? 'opacity-40' : ''} ${calc.alertas.length > 0 ? 'bg-destructive/5' : ''}`}>
                      <td className="p-2 font-medium">{d.dia}</td>
                      <td className="p-2 text-center">
                        <Switch checked={d.ativo} onCheckedChange={() => handleDiaToggle(di)} />
                      </td>
                      {d.marcacoes.map((m, si) => (
                        <td key={si} className="p-1">
                          <TimeInput
                            value={m}
                            onChange={v => handleMarcacao(di, si, v)}
                            disabled={!d.ativo}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center font-mono text-xs">{d.ativo ? minutesToHHMM(calc.totalTrabalhadoMin) : '–'}</td>
                      <td className="p-2 text-center font-mono text-xs">{d.ativo ? minutesToHHMM(calc.totalIntervaloMin) : '–'}</td>
                      {params.noturnoHabilitado && <>
                        <td className="p-2 text-center font-mono text-xs">{calc.noturnoRealMin > 0 ? minutesToHHMM(calc.noturnoRealMin) : '–'}</td>
                        <td className="p-2 text-center font-mono text-xs">{calc.noturnoConvertidoMin > 0 ? minutesToHHMM(calc.noturnoConvertidoMin) : '–'}</td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="p-2" colSpan={2 + params.slots}>Total Semanal</td>
                  <td className="p-2 text-center font-mono">{minutesToHHMM(analise.totalSemanalMin)}</td>
                  <td className="p-2 text-center font-mono">{minutesToHHMM(analise.dias.reduce((s, d) => s + d.totalIntervaloMin, 0))}</td>
                  {params.noturnoHabilitado && <>
                    <td className="p-2 text-center font-mono">{minutesToHHMM(analise.dias.reduce((s, d) => s + d.noturnoRealMin, 0))}</td>
                    <td className="p-2 text-center font-mono">{minutesToHHMM(analise.dias.reduce((s, d) => s + d.noturnoConvertidoMin, 0))}</td>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ANALYSIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {statusIcon}
            Análise Automática da Jornada
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="border rounded p-3 text-center">
              <div className="text-muted-foreground text-xs">Total Apurado</div>
              <div className="font-bold font-mono text-lg">{minutesToHHMM(analise.totalSemanalMin)}</div>
            </div>
            <div className="border rounded p-3 text-center">
              <div className="text-muted-foreground text-xs">Carga Contratada</div>
              <div className="font-bold font-mono text-lg">{minutesToHHMM(analise.cargaContratadaMin)}</div>
            </div>
            <div className="border rounded p-3 text-center">
              <div className="text-muted-foreground text-xs">Saldo</div>
              <div className={`font-bold font-mono text-lg ${analise.saldoMin > 0 ? 'text-green-600' : analise.saldoMin < 0 ? 'text-red-600' : ''}`}>
                {minutesToHHMM(analise.saldoMin)}
              </div>
            </div>
            <div className="border rounded p-3 text-center">
              <div className="text-muted-foreground text-xs">Indicação</div>
              <div className="font-bold text-lg">
                {analise.saldoMin > 0 ? 'Acima' : analise.saldoMin < 0 ? 'Abaixo' : 'Igual'}
              </div>
            </div>
          </div>

          {analise.apontamentos.length > 0 && (
            <div className="bg-destructive/5 rounded p-4 space-y-1">
              <p className="text-sm font-semibold text-destructive">Apontamentos:</p>
              <ul className="text-sm space-y-1">
                {analise.apontamentos.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-2 h-2 rounded-full bg-destructive shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analise.statusGeral === 'ok' && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded p-4">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✅ Após análise automática, NÃO foram identificadas inconsistências legais/paramétricas na jornada apresentada.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PRINT BUTTON */}
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setDias(prev => prev.map(d => ({ ...d, marcacoes: Array(params.slots).fill('') })));
          }}
          className="gap-2"
        >
          <Eraser className="w-5 h-5" />
          Limpar Horários
        </Button>
        <Button size="lg" onClick={() => setPreviewOpen(true)} className="gap-2">
          <Printer className="w-5 h-5" />
          Imprimir Parecer (PDF)
        </Button>
      </div>

      {/* PREVIEW DIALOG */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prévia do Parecer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="font-semibold">{statusLabel}</span>
            </div>

            {analise.apontamentos.length > 0 ? (
              <div className="bg-destructive/5 rounded p-3 text-sm space-y-1">
                {analise.apontamentos.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-2 h-2 rounded-full bg-destructive shrink-0" />
                    {a}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-700">Sem inconsistências encontradas.</p>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Apurado</div>
                <div className="font-mono font-bold">{minutesToHHMM(analise.totalSemanalMin)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Contratado</div>
                <div className="font-mono font-bold">{minutesToHHMM(analise.cargaContratadaMin)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Saldo</div>
                <div className="font-mono font-bold">{minutesToHHMM(analise.saldoMin)}</div>
              </div>
            </div>

            <div>
              <Label>Observações do Analista</Label>
              <Textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Insira observações adicionais que serão incluídas no parecer..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button onClick={handleGerarPdf} className="gap-2">
              <Printer className="w-4 h-4" />
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center pb-4">
        ⚠️ Verificação estimativa para conferência. Pode haver regras específicas por CCT, escalas e acordos.
      </p>
    </div>
  );
};

export default JornadaPage;
