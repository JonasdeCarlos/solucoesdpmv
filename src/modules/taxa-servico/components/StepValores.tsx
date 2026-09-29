import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { calcularValores, validarValores, fmt, parseNum, tetoEfetivo } from '../utils/validacoes';
import { saldoDisponivel, saveCompetencia, type TsCompetencia, type TsConfig } from '../hooks/useTaxaServico';

interface Props { empresaId: string; config: TsConfig; comp: TsCompetencia | null; onSaved: (c: TsCompetencia) => void; onBack: () => void }

export default function StepValores({ empresaId, config, comp, onSaved, onBack }: Props) {
  const [mes, setMes] = useState(comp?.competencia?.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [arrec, setArrec] = useState(String(comp?.valor_arrecadado ?? ''));
  const [perc, setPerc] = useState(String(comp?.percentual_retencao ?? ''));
  const [saldoUso, setSaldoUso] = useState(String(comp?.saldo_utilizado ?? '0'));
  const [disp, setDisp] = useState(0);
  const bloqueado = comp && (comp.status === 'exportado' || comp.status === 'ajustado');

  useEffect(() => { saldoDisponivel(empresaId, comp?.id ?? null).then(setDisp); }, [empresaId, comp?.id]);

  const a = parseNum(arrec), p = parseNum(perc), s = parseNum(saldoUso);
  const { retido, liquido } = calcularValores(a, p, s);
  const erros = useMemo(() => validarValores({ regime: config.regime_tributario, percentual: p, saldoUtilizado: s, saldoDisponivel: disp, arrecadado: a, tetoCct: config.teto_retencao_cct }), [config, p, s, disp, a]);

  const salvar = async () => {
    if (erros.length) return toast.error(erros[0]);
    const { data, error } = await saveCompetencia({
      ...(comp?.id ? { id: comp.id } : {}),
      empresa_id: empresaId, competencia: `${mes}-01`, valor_arrecadado: a, percentual_retencao: p,
      valor_retido: retido, saldo_utilizado: s, valor_liquido: liquido,
      codigo_verba: comp?.codigo_verba ?? config.codigo_verba_padrao ?? null,
      status: comp?.status && comp.status !== 'rascunho' ? comp.status : 'rascunho',
    });
    if (error) return toast.error(error.message.includes('duplicate') ? 'Já existe essa competência para a empresa.' : error.message);
    toast.success('Valores salvos');
    onSaved(data!);
  };

  return (
    <div className="space-y-4">
      {bloqueado && <p className="text-sm text-muted-foreground">Competência já exportada — valores somente leitura.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Competência</Label><Input type="month" disabled={!!bloqueado} value={mes} onChange={(e) => setMes(e.target.value)} /></div>
        <div><Label>Valor total arrecadado (R$)</Label><Input disabled={!!bloqueado} inputMode="decimal" value={arrec} onChange={(e) => setArrec(e.target.value)} /></div>
        <div>
          <Label>% de retenção da empresa (teto {tetoEfetivo(config.regime_tributario, config.teto_retencao_cct)}%{config.teto_retencao_cct ? ' pela CCT' : ''})</Label>
          <Input disabled={!!bloqueado} inputMode="decimal" value={perc} onChange={(e) => setPerc(e.target.value)} />
        </div>
        <div>
          <Label>Saldo anterior a utilizar (R$)</Label>
          <div className="flex gap-2">
            <Input disabled={!!bloqueado} inputMode="decimal" value={saldoUso} onChange={(e) => setSaldoUso(e.target.value)} />
            <Button type="button" variant="outline" disabled={!!bloqueado} onClick={() => setSaldoUso(String(Math.max(0, disp)))}>Usar saldo total</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Disponível: {fmt(disp)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm">
        <div>Valor retido: <b>{fmt(retido)}</b></div>
        <div>Líquido a distribuir: <b className="text-primary">{fmt(liquido)}</b></div>
      </div>
      {erros.length > 0 && <ul className="text-sm text-destructive list-disc pl-5">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button disabled={erros.length > 0 && !bloqueado} onClick={bloqueado ? () => onSaved(comp!) : salvar}>{bloqueado ? 'Avançar' : 'Salvar e avançar'}</Button>
      </div>
    </div>
  );
}
