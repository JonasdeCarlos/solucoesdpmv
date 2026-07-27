import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PrizePublicApiProvider, type PrizePublicApi } from '@/hooks/prizePublicContext';
import PremioHotelariaSection from '@/components/sucessoCliente/tabs/PremioHotelariaSection';
import PremioAplicacaoSection from '@/components/sucessoCliente/tabs/PremioAplicacaoSection';
import { CriteriaSection, EmployeesSection } from '@/components/sucessoCliente/tabs/PremioTab';
import type { PrizePolicy } from '@/hooks/usePrizePolicies';

let PUB_PASSWORD = '';
export function setPubPassword(p: string) { PUB_PASSWORD = p; }

async function invokePub(policyId: string, action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('premio-hotelaria-public', {
    body: { policy_id: policyId, action, password: PUB_PASSWORD || undefined, ...extra },
  });
  if (error) throw error;
  if ((data as any)?.requires_password) {
    const err: any = new Error((data as any).wrong ? 'Senha incorreta.' : 'Senha necessária.');
    err.requiresPassword = true;
    throw err;
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function PremioPublicPage() {
  const { policyId } = useParams();
  const [policy, setPolicy] = useState<PrizePolicy | null>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [pwd, setPwd] = useState('');
  const [checking, setChecking] = useState(false);

  const reloadBundle = useCallback(async () => {
    if (!policyId) return;
    const d = await invokePub(policyId, 'get_bundle');
    setPolicy(d.policy);
    setCliente(d.cliente);
  }, [policyId]);

  useEffect(() => {
    (async () => {
      const saved = policyId ? sessionStorage.getItem(`premio_pwd_${policyId}`) : null;
      if (saved) setPubPassword(saved);
      try { await reloadBundle(); }
      catch (e: any) {
        if (e?.requiresPassword) setNeedPassword(true);
        else setError(e.message || 'Erro ao carregar');
      }
      finally { setLoading(false); }
    })();
  }, [reloadBundle]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setPubPassword(pwd);
    try {
      await reloadBundle();
      if (policyId) sessionStorage.setItem(`premio_pwd_${policyId}`, pwd);
      setNeedPassword(false);
    } catch (err: any) {
      setPubPassword('');
      setError(err?.requiresPassword ? 'Senha incorreta.' : (err.message || 'Erro ao carregar'));
    } finally {
      setChecking(false);
    }
  };

  const api = useMemo<PrizePublicApi | null>(() => {
    if (!policyId) return null;
    const call = (action: string, extra?: any) => invokePub(policyId, action, extra);
    return {
      policyId,
      listCriteria: async () => (await call('list_criteria')).items,
      listEmployees: async () => (await call('list_employees')).items,
      listAssessments: async () => (await call('list_assessments')).items,
      listAssessmentEmployees: async (assessment_id) => (await call('list_assessment_employees', { assessment_id })).items,
      listCriterionResults: async (ae_id) => (await call('list_criterion_results', { assessment_employee_id: ae_id })).items,
      updatePolicy: async (patch) => { await call('update_policy', { patch }); },
      createCriterion: async (payload) => { await call('create_criterion', { payload }); },
      createCriteriaMany: async (rows) => { await call('create_criteria_many', { rows }); },
      updateCriterion: async (id, patch) => { await call('update_criterion', { id, patch }); },
      deleteCriterion: async (id) => { await call('delete_criterion', { id }); },
      createEmployee: async (payload) => { await call('create_employee', { payload }); },
      createEmployeesMany: async (rows) => { await call('create_employees_many', { rows }); },
      updateEmployee: async (id, patch) => { await call('update_employee', { id, patch }); },
      deleteEmployee: async (id) => { await call('delete_employee', { id }); },
      createAssessment: async (competencia, observacao) => (await call('create_assessment', { competencia, observacao })).item,
      updateAssessment: async (id, patch) => { await call('update_assessment', { id, patch }); },
      deleteAssessment: async (id) => { await call('delete_assessment', { id }); },
      enrollAssessment: async (assessment_id) => (await call('enroll_assessment', { assessment_id })).count,
      updateAssessmentEmployee: async (id, patch) => { await call('update_assessment_employee', { id, patch }); },
      deleteAssessmentEmployee: async (id) => { await call('delete_assessment_employee', { id }); },
      upsertCriterionResult: async (ae_id, criterion_id, patch) => {
        await call('upsert_criterion_result', { assessment_employee_id: ae_id, criterion_id, patch });
      },
    };
  }, [policyId]);

  const onUpdate = async (patch: Partial<PrizePolicy>) => {
    if (!api) return;
    await api.updatePolicy(patch);
    setPolicy(p => (p ? { ...p, ...patch } : p));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div>;
  if (needPassword) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <form onSubmit={submitPassword} className="bg-background border rounded-lg p-6 w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary"/><h1 className="font-semibold">Acesso restrito</h1></div>
        <p className="text-xs text-muted-foreground">Informe a senha enviada pela contabilidade para acessar a política.</p>
        <Input type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} placeholder="Senha de acesso" autoFocus/>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={checking || !pwd}>
          {checking && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}Entrar
        </Button>
      </form>
    </div>
  );
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;
  if (!policy || !api) return null;

  const empresa = cliente?.razao_social || cliente?.nome_fantasia || cliente?.nome || 'Empresa';
  const isHotelaria = (policy as any).modelo_template === 'hotelaria';

  return (
    <PrizePublicApiProvider api={api}>
      <div className="min-h-screen bg-muted/30 py-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="bg-background border rounded-lg p-4 flex items-start gap-3">
            <Building2 className="w-6 h-6 text-primary mt-1"/>
            <div>
              <h1 className="text-xl font-bold">{policy.nome}</h1>
              <p className="text-sm text-muted-foreground">
                {empresa}{cliente?.cnpj ? ` • CNPJ ${cliente.cnpj}` : ''}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Acesso público (sem login): emita a política em PDF, avalie os colaboradores por competência e gere os relatórios de avaliação. Tudo é salvo em tempo real.
              </p>
            </div>
          </div>

          {isHotelaria ? (
            <PremioHotelariaSection policy={policy} cliente={cliente} onUpdate={onUpdate}/>
          ) : (
            <div className="bg-background border rounded-lg p-4 space-y-6">
              <CriteriaSection policy={policy} cliente={cliente}/>
              <EmployeesSection policy={policy} cliente={cliente}/>
              <PremioAplicacaoSection policy={policy} cliente={cliente}/>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Monte Verde Contabilidade • Política de {policy.verba_label}
          </p>
        </div>
      </div>
    </PrizePublicApiProvider>
  );
}
