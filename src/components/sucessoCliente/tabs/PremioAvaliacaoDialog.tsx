import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Loader2, Wand2, Upload, FileText, Save, FileDown } from 'lucide-react';
import { usePrizeCriteria, type PrizePolicy } from '@/hooks/usePrizePolicies';
import { useCriterionResults, uploadEvidencia, signedEvidenciaUrl, generateFeedback, useAssessmentEmployees } from '@/hooks/usePrizeAssessments';
import { generatePremioAlinhamentoPdf } from '@/utils/sucessoCliente/premioAlinhamentoPdf';
import { toast } from 'sonner';

export default function PremioAvaliacaoDialog({
  open, onOpenChange, ae, policy, cliente, competencia, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ae: any | null; // assessment_employee + employee
  policy: PrizePolicy;
  cliente: any;
  competencia: string;
  onSaved?: () => void;
}) {
  const { items: criteria } = usePrizeCriteria(policy.id);
  const { items: results, upsert } = useCriterionResults(ae?.id);
  const { updateOne } = useAssessmentEmployees(ae?.assessment_id);

  // estado local por critério para edição fluida
  const [local, setLocal] = useState<Record<string, { percentual: number; observacao: string; status: string; feedback_ia: string | null; evidencia_url: string | null }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [genCritId, setGenCritId] = useState<string | null>(null);
  const [genGeral, setGenGeral] = useState(false);
  const [parecer, setParecer] = useState<string>('');
  const [exportPdf, setExportPdf] = useState(false);

  useEffect(() => {
    if (!open) return;
    const m: Record<string, any> = {};
    for (const c of criteria) {
      const r = results.find(rr => rr.criterion_id === c.id);
      m[c.id] = {
        percentual: r?.percentual ?? 0,
        observacao: r?.observacao ?? '',
        status: r?.status ?? 'pendente',
        feedback_ia: r?.feedback_ia ?? null,
        evidencia_url: r?.evidencia_url ?? null,
      };
    }
    setLocal(m);
    setParecer(ae?.parecer_geral || '');
  }, [open, criteria, results, ae?.parecer_geral]);

  const totalPeso = criteria.reduce((s, c) => s + (Number(c.peso) || 1), 0) || 1;
  const { percentualFinal, valorFinal, elegibilidade, essencialFalhou } = useMemo(() => {
    const soma = criteria.reduce((acc, c) => {
      const v = Number(local[c.id]?.percentual ?? 0);
      return acc + v * (Number(c.peso) || 1);
    }, 0);
    const pct = soma / totalPeso;
    const minEss = Number((policy as any).minimo_essencial ?? 0);
    const essFalhou = criteria.some(c => c.essencial && Number(local[c.id]?.percentual ?? 0) < minEss);
    const valor = Number(policy.valor_base || 0) * (pct / 100);
    let eleg = 'pendente';
    if (essFalhou) eleg = 'nao_elegivel';
    else if (pct >= 70) eleg = 'elegivel';
    else if (pct > 0) eleg = 'parcial';
    return { percentualFinal: pct, valorFinal: valor, elegibilidade: eleg, essencialFalhou: essFalhou };
  }, [criteria, local, totalPeso, policy]);

  if (!ae) return null;

  const setField = (cid: string, patch: any) => setLocal(prev => ({ ...prev, [cid]: { ...prev[cid], ...patch } }));

  const statusFromPct = (p: number) => p >= 100 ? 'integral' : p >= 70 ? 'parcial' : p > 0 ? 'parcial' : 'pendente';

  const saveCriterion = async (cid: string) => {
    setSavingId(cid);
    const l = local[cid];
    const status = l.percentual > 0 ? statusFromPct(l.percentual) : 'pendente';
    if (l.percentual > 0 && l.percentual < 100 && !l.observacao.trim()) {
      toast.error('Observação obrigatória para atingimento abaixo de 100%.');
      setSavingId(null); return;
    }
    const { error } = await upsert(cid, {
      percentual: l.percentual,
      observacao: l.observacao || null,
      status,
      feedback_ia: l.feedback_ia,
      evidencia_url: l.evidencia_url,
    });
    setSavingId(null);
    if (error) { toast.error('Erro ao salvar.'); return; }
    setField(cid, { status });
    toast.success('Critério salvo.');
  };

  const handleUpload = async (cid: string, file: File) => {
    const { path, error } = await uploadEvidencia(file, ae.id, cid);
    if (error || !path) { toast.error('Falha no upload.'); return; }
    setField(cid, { evidencia_url: path });
    await upsert(cid, { evidencia_url: path } as any);
    toast.success('Evidência anexada.');
  };

  const openEvidence = async (path: string) => {
    const url = await signedEvidenciaUrl(path);
    if (url) window.open(url, '_blank');
  };

  const handleFeedbackCriterio = async (c: any) => {
    setGenCritId(c.id);
    const { texto, error } = await generateFeedback({
      modo: 'criterio',
      verba_label: policy.verba_label,
      colaborador: ae.employee?.nome,
      empresa: cliente?.nome,
      competencia,
      criterio: c.nome,
      descricao: c.descricao,
      percentual: local[c.id]?.percentual ?? 0,
      observacao: local[c.id]?.observacao,
      meta: '100%',
    });
    setGenCritId(null);
    if (error || !texto) { toast.error('Falha ao gerar feedback.'); return; }
    setField(c.id, { feedback_ia: texto });
    await upsert(c.id, { feedback_ia: texto } as any);
  };

  const handleFeedbackGeral = async () => {
    setGenGeral(true);
    const lista = criteria.map(c => ({ nome: c.nome, percentual: local[c.id]?.percentual ?? 0, observacao: local[c.id]?.observacao }));
    const { texto, error } = await generateFeedback({
      modo: 'geral',
      verba_label: policy.verba_label,
      colaborador: ae.employee?.nome,
      empresa: cliente?.nome,
      competencia,
      criterios: lista,
      percentual_final: percentualFinal,
      valor_premio: valorFinal,
      valor_base: policy.valor_base,
    });
    setGenGeral(false);
    if (error || !texto) { toast.error('Falha ao gerar feedback.'); return; }
    setParecer(texto);
  };

  const handleSaveAll = async (newStatus?: string) => {
    // salva resultados pendentes
    for (const c of criteria) {
      const l = local[c.id];
      if (l.percentual === 0 && !l.observacao && !l.feedback_ia && !l.evidencia_url) continue;
      await upsert(c.id, {
        percentual: l.percentual,
        observacao: l.observacao || null,
        status: l.percentual > 0 ? statusFromPct(l.percentual) : 'pendente',
        feedback_ia: l.feedback_ia,
        evidencia_url: l.evidencia_url,
      });
    }
    await updateOne(ae.id, {
      percentual_final: Number(percentualFinal.toFixed(2)),
      valor_final: Number(valorFinal.toFixed(2)),
      parecer_geral: parecer || null,
      elegibilidade,
      status: newStatus || (percentualFinal > 0 ? 'em_preenchimento' : ae.status),
    } as any);
    toast.success('Avaliação salva.');
    onSaved?.();
  };

  const handleConcluir = async () => {
    await handleSaveAll('concluida');
  };

  const handleGerarPdf = async () => {
    setExportPdf(true);
    await handleSaveAll('concluida');
    try {
      await generatePremioAlinhamentoPdf({
        empresa: cliente?.nome || '',
        cnpj: cliente?.cnpj || cliente?.documento || '',
        verba_label: policy.verba_label,
        politica_nome: policy.nome,
        competencia,
        objetivo: policy.objetivo,
        valor_base: Number(policy.valor_base || 0),
        colaborador: {
          nome: ae.employee?.nome,
          cpf: ae.employee?.cpf,
          codigo_folha: ae.employee?.codigo_folha,
          data_admissao: ae.employee?.data_admissao,
          cargo: ae.employee?.cargo,
        },
        criterios: criteria.map(c => ({
          nome: c.nome, descricao: c.descricao, peso: Number(c.peso) || 1, essencial: c.essencial,
          percentual: Number(local[c.id]?.percentual ?? 0),
          observacao: local[c.id]?.observacao,
          feedback: local[c.id]?.feedback_ia,
          status: local[c.id]?.status,
        })),
        percentual_final: percentualFinal,
        valor_final: valorFinal,
        parecer_geral: parecer,
        elegibilidade,
      });
      await updateOne(ae.id, { status: 'alinhamento_gerado' } as any);
      toast.success('PDF gerado.');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    }
    setExportPdf(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliação de {policy.verba_label} — {ae.employee?.nome}</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><strong>Empresa:</strong> {cliente?.nome}</div>
          <div><strong>Política:</strong> {policy.nome}</div>
          <div><strong>Competência:</strong> {competencia}</div>
          <div><strong>Valor base:</strong> R$ {Number(policy.valor_base||0).toFixed(2)}</div>
          {ae.employee?.codigo_folha && <div><strong>Cód. folha:</strong> {ae.employee.codigo_folha}</div>}
          {ae.employee?.data_admissao && <div><strong>Admissão:</strong> {new Date(ae.employee.data_admissao).toLocaleDateString('pt-BR')}</div>}
          {ae.employee?.cargo && <div><strong>Cargo:</strong> {ae.employee.cargo}</div>}
          {ae.employee?.cpf && <div><strong>CPF:</strong> {ae.employee.cpf}</div>}
        </div>

        <div className="space-y-3 mt-2">
          {criteria.length === 0 && <p className="text-xs text-muted-foreground">Esta política ainda não possui critérios. Cadastre-os primeiro.</p>}
          {criteria.map(c => {
            const l = local[c.id] || { percentual: 0, observacao: '', status: 'pendente', feedback_ia: null, evidencia_url: null };
            return (
              <div key={c.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.nome}</span>
                      <Badge variant="outline" className="text-[10px]">peso {c.peso}</Badge>
                      {c.essencial && <Badge variant="destructive" className="text-[10px]">essencial</Badge>}
                      <Badge variant="secondary" className="text-[10px]">{l.status}</Badge>
                    </div>
                    {c.descricao && <p className="text-[11px] text-muted-foreground mt-0.5">{c.descricao}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">{Number(l.percentual).toFixed(0)}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Slider value={[Number(l.percentual)]} max={100} step={5} className="flex-1"
                    onValueChange={(v)=>setField(c.id, { percentual: v[0] })}/>
                  <Input type="number" min={0} max={100} value={l.percentual}
                    onChange={(e)=>setField(c.id, { percentual: Math.min(100, Math.max(0, Number(e.target.value)||0)) })}
                    className="w-20 h-8"/>
                </div>

                <div>
                  <Label className="text-xs">Observação {l.percentual > 0 && l.percentual < 100 && <span className="text-destructive">*</span>}</Label>
                  <Textarea rows={2} value={l.observacao} onChange={(e)=>setField(c.id, { observacao: e.target.value })}
                    placeholder={l.percentual < 100 ? 'Justifique o atingimento abaixo de 100%…' : 'Opcional'}/>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <label className="cursor-pointer">
                    <input type="file" hidden onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleUpload(c.id, f); }}/>
                    <Button size="sm" variant="outline" asChild><span><Upload className="w-3 h-3 mr-1"/>Evidência</span></Button>
                  </label>
                  {l.evidencia_url && (
                    <Button size="sm" variant="ghost" onClick={()=>openEvidence(l.evidencia_url!)}>
                      <FileText className="w-3 h-3 mr-1"/>Ver evidência
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={()=>handleFeedbackCriterio(c)} disabled={genCritId === c.id}>
                    {genCritId === c.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Wand2 className="w-3 h-3 mr-1"/>}Feedback IA
                  </Button>
                  <Button size="sm" onClick={()=>saveCriterion(c.id)} disabled={savingId === c.id}>
                    {savingId === c.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Save className="w-3 h-3 mr-1"/>}Salvar
                  </Button>
                </div>

                {l.feedback_ia && (
                  <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{l.feedback_ia}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border rounded-md p-3 space-y-2 bg-muted/30 mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-sm">Parecer / Feedback Geral</h4>
            <Button size="sm" variant="outline" onClick={handleFeedbackGeral} disabled={genGeral}>
              {genGeral ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Wand2 className="w-3 h-3 mr-1"/>}Gerar feedback geral
            </Button>
          </div>
          <Textarea rows={5} value={parecer} onChange={(e)=>setParecer(e.target.value)} placeholder="Parecer consolidado…"/>
        </div>

        <div className="sticky bottom-0 bg-background border-t pt-3 mt-3 -mb-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex gap-4 items-center flex-wrap">
              <div><span className="text-xs text-muted-foreground">% Final</span><div className="text-2xl font-bold">{percentualFinal.toFixed(0)}%</div></div>
              <div><span className="text-xs text-muted-foreground">{policy.verba_label}</span><div className="text-2xl font-bold">R$ {valorFinal.toFixed(2)}</div></div>
              <Badge variant={elegibilidade === 'elegivel' ? 'default' : elegibilidade === 'nao_elegivel' ? 'destructive' : 'secondary'} className="text-xs">
                {elegibilidade === 'elegivel' ? 'Elegível' : elegibilidade === 'parcial' ? 'Parcialmente elegível' : elegibilidade === 'nao_elegivel' ? 'Não elegível' : 'Pendente'}
              </Badge>
              {essencialFalhou && <Badge variant="destructive" className="text-xs">⚠ critério essencial abaixo do mínimo</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>handleSaveAll()}><Save className="w-3 h-3 mr-1"/>Salvar</Button>
              <Button variant="outline" onClick={handleConcluir}>Concluir</Button>
              <Button onClick={handleGerarPdf} disabled={exportPdf}>
                {exportPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <FileDown className="w-3 h-3 mr-1"/>}Gerar PDF de alinhamento
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}