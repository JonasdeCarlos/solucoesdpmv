import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Play, Plus, Trash2, ClipboardCheck, History, UserMinus } from 'lucide-react';
import { usePrizeAssessments, useAssessmentEmployees, fetchEmployeeHistory } from '@/hooks/usePrizeAssessments';
import { type PrizePolicy } from '@/hooks/usePrizePolicies';
import PremioAvaliacaoDialog from './PremioAvaliacaoDialog';
import { toast } from 'sonner';

function competenciaAtual() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

export default function PremioAplicacaoSection({ policy, cliente }: { policy: PrizePolicy; cliente: any }) {
  const { items: assessments, create, remove, enroll, reload } = usePrizeAssessments(policy.id);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [historyEmp, setHistoryEmp] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [faturamentoPrevisto, setFaturamentoPrevisto] = useState<number>(0);

  useEffect(() => {
    if (!selectedAssessment && assessments[0]) setSelectedAssessment(assessments[0].id);
  }, [assessments, selectedAssessment]);

  const current = assessments.find(a => a.id === selectedAssessment) || null;

  const handleCreate = async () => {
    if (!/^\d{2}\/\d{4}$/.test(competencia)) { toast.error('Use MM/AAAA na competência.'); return; }
    const exists = assessments.find(a => a.competencia === competencia);
    if (exists) { setSelectedAssessment(exists.id); return; }
    const { data, error } = await create(competencia);
    if (error || !data) { toast.error('Erro ao criar apuração.'); return; }
    const r = await enroll(data.id);
    toast.success(`Apuração ${competencia} criada${r.count ? ` (${r.count} colaboradores)` : ''}.`);
    setSelectedAssessment(data.id);
    await reload();
    setRefreshTick(t => t + 1);
  };

  const handleReenroll = async () => {
    if (!current) return;
    const r = await enroll(current.id);
    if (r.error) { toast.error('Erro.'); return; }
    toast.success(`Lista de colaboradores sincronizada${r.count ? ` (${r.count})` : ''}.`);
    setRefreshTick(t => t + 1);
  };

  // Simulação de bolo com faturamento previsto (quando RV ativa)
  const rv = policy.remuneracao_variavel ? {
    ativo: true,
    tiers: (policy as any).rv_tiers || [],
    pct_individual: Number((policy as any).rv_pct_individual ?? 0),
    pct_igualitario: Number((policy as any).rv_pct_igualitario ?? 0),
    base: (policy as any).rv_base || 'faturamento',
    base_label: (policy as any).rv_base_label,
  } : null;

  const poolPrevisto = useMemo(() => {
    if (!rv || !faturamentoPrevisto) return 0;
    const ordered = [...(rv.tiers || [])].sort((a: any, b: any) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
    const match = ordered.find((t: any) => t.ate == null || faturamentoPrevisto <= t.ate);
    return match ? faturamentoPrevisto * (Number(match.percentual) / 100) : 0;
  }, [rv, faturamentoPrevisto]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-1"><ClipboardCheck className="w-4 h-4"/>Aplicação da política</h4>
      </div>

      <div className="border rounded-md p-3 bg-muted/30 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-3">
          <Label className="text-xs">Apuração existente</Label>
          <Select value={selectedAssessment || ''} onValueChange={setSelectedAssessment}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…"/></SelectTrigger>
            <SelectContent>
              {assessments.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma apuração</div>}
              {assessments.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.competencia} • {a.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Nova competência (MM/AAAA)</Label>
          <Input value={competencia} onChange={(e)=>setCompetencia(e.target.value)} placeholder="06/2026"/>
        </div>
        <div className="md:col-span-3">
          <Button size="sm" className="w-full" onClick={handleCreate}><Plus className="w-3 h-3 mr-1"/>Iniciar/abrir apuração</Button>
        </div>
        <div className="md:col-span-3 flex gap-2">
          {current && <Button size="sm" variant="outline" className="flex-1" onClick={handleReenroll}>Sincronizar colaboradores</Button>}
          {current && <Button size="sm" variant="ghost" onClick={async ()=>{ if (confirm('Excluir esta apuração?')) { await remove(current.id); setSelectedAssessment(null); } }}><Trash2 className="w-3 h-3"/></Button>}
        </div>
      </div>

      {current && rv && (
        <div className="border rounded-md p-3 bg-primary/5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <Label className="text-xs">Faturamento previsto ({rv.base_label || rv.base}) — competência {current.competencia}</Label>
            <Input type="number" step="0.01" value={faturamentoPrevisto}
              onChange={(e)=>setFaturamentoPrevisto(Number(e.target.value)||0)}
              placeholder="Ex.: 250000,00"/>
          </div>
          <div className="md:col-span-8 text-xs space-y-1">
            <div>Bolo previsto do <strong>{policy.verba_label}</strong>: <strong>R$ {poolPrevisto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
            <div>→ Parcela por critérios individuais ({rv.pct_individual}%): <strong>R$ {(poolPrevisto*rv.pct_individual/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
            <div>→ Parcela igualitária ({rv.pct_igualitario}%): <strong>R$ {(poolPrevisto*rv.pct_igualitario/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
            <div className="text-[10px] text-muted-foreground">Simulação para orientar a apuração — os valores finais dependem do faturamento efetivo e do desempenho individual apurado abaixo.</div>
          </div>
        </div>
      )}

      {current && (
        <AssessmentEmployeeList key={`${current.id}-${refreshTick}`} assessment={current} policy={policy} cliente={cliente} onOpenHistory={setHistoryEmp}/>
      )}

      {historyEmp && (
        <EmployeeHistoryDialog employee_id={historyEmp} onClose={()=>setHistoryEmp(null)}/>
      )}
    </div>
  );
}

function AssessmentEmployeeList({ assessment, policy, cliente, onOpenHistory }: {
  assessment: any; policy: PrizePolicy; cliente: any; onOpenHistory: (id: string) => void;
}) {
  const { items, reload, removeOne } = useAssessmentEmployees(assessment.id);
  const [openAe, setOpenAe] = useState<any | null>(null);

  const totalCalc = items.reduce((s, i) => s + Number(i.valor_final || 0), 0);
  const concluidos = items.filter(i => i.status === 'concluida' || i.status === 'alinhamento_gerado').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span><Calendar className="w-3 h-3 inline mr-1"/>{assessment.competencia} • {items.length} colaborador(es) • {concluidos} concluído(s)</span>
        <span><strong>Total apurado:</strong> R$ {totalCalc.toFixed(2)}</span>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum colaborador vinculado. Cadastre na seção acima e clique em "Sincronizar colaboradores".</p>}
      <div className="space-y-1">
        {items.map(ae => (
          <div key={ae.id} className="flex items-center justify-between flex-wrap gap-2 border rounded-md p-2 text-sm">
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{ae.employee?.nome}</span>
                {ae.employee?.cargo && <Badge variant="outline" className="text-[10px]">{ae.employee.cargo}</Badge>}
                <StatusBadge status={ae.status}/>
                {ae.elegibilidade && ae.elegibilidade !== 'pendente' && (
                  <Badge variant={ae.elegibilidade === 'elegivel' ? 'default' : ae.elegibilidade === 'nao_elegivel' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {ae.elegibilidade === 'elegivel' ? 'elegível' : ae.elegibilidade === 'nao_elegivel' ? 'não elegível' : 'parcial'}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {ae.employee?.codigo_folha && <>cód {ae.employee.codigo_folha} • </>}
                {ae.employee?.data_admissao && <>adm. {new Date(ae.employee.data_admissao).toLocaleDateString('pt-BR')} • </>}
                {ae.percentual_final != null && <>{Number(ae.percentual_final).toFixed(0)}% • </>}
                {ae.valor_final != null && <>R$ {Number(ae.valor_final).toFixed(2)}</>}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={()=>onOpenHistory(ae.employee_id)}><History className="w-3 h-3"/></Button>
              <Button size="sm" onClick={()=>setOpenAe(ae)}><Play className="w-3 h-3 mr-1"/>Avaliar</Button>
              <Button size="sm" variant="ghost"
                title="Remover colaborador desta apuração"
                onClick={async ()=>{
                  if (!confirm(`Remover ${ae.employee?.nome} desta apuração? Os lançamentos de critérios deste colaborador serão apagados.`)) return;
                  const { error } = await removeOne(ae.id);
                  if (error) { toast.error('Erro ao remover.'); return; }
                  toast.success('Colaborador removido da apuração.');
                }}>
                <UserMinus className="w-3 h-3"/>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <PremioAvaliacaoDialog
        open={!!openAe} onOpenChange={(b)=>{ if (!b) setOpenAe(null); }}
        ae={openAe} policy={policy} cliente={cliente} competencia={assessment.competencia}
        onSaved={reload}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; v: any }> = {
    pendente: { label: 'não iniciada', v: 'outline' },
    em_preenchimento: { label: 'em preenchimento', v: 'secondary' },
    revisao: { label: 'pendente revisão', v: 'secondary' },
    concluida: { label: 'concluída', v: 'default' },
    alinhamento_gerado: { label: 'alinhamento gerado', v: 'default' },
  };
  const m = map[status] || { label: status, v: 'outline' };
  return <Badge variant={m.v} className="text-[10px]">{m.label}</Badge>;
}

function EmployeeHistoryDialog({ employee_id, onClose }: { employee_id: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { setRows(await fetchEmployeeHistory(employee_id)); setLoading(false); })(); }, [employee_id]);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-md p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Histórico de prêmios do colaborador</h4>
          <Button size="sm" variant="ghost" onClick={onClose}>×</Button>
        </div>
        {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!loading && rows.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico anterior.</p>}
        <div className="space-y-2">
          {rows.sort((a,b)=> (b.assessment?.competencia || '').localeCompare(a.assessment?.competencia || '')).map(r => (
            <div key={r.id} className="border rounded-md p-2 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{r.assessment?.competencia}</Badge>
                  <span className="font-medium">{r.assessment?.policy?.nome}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.assessment?.policy?.verba_label}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {r.percentual_final != null && <>% final: <strong>{Number(r.percentual_final).toFixed(0)}%</strong> • </>}
                {r.valor_final != null && <>valor: <strong>R$ {Number(r.valor_final).toFixed(2)}</strong> • </>}
                {r.elegibilidade}
              </p>
              {r.parecer_geral && <p className="text-xs mt-1 whitespace-pre-wrap">{r.parecer_geral}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}