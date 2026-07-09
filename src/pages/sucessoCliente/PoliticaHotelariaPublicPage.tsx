import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2 } from 'lucide-react';
import { PrizePublicApiProvider, type PrizePublicApi } from '@/hooks/prizePublicContext';
import PremioHotelariaSection from '@/components/sucessoCliente/tabs/PremioHotelariaSection';
import type { PrizePolicy } from '@/hooks/usePrizePolicies';

async function invokePub(policyId: string, action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('premio-hotelaria-public', {
    body: { policy_id: policyId, action, ...extra },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function PoliticaHotelariaPublicPage() {
  const { policyId } = useParams();
  const [policy, setPolicy] = useState<PrizePolicy | null>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadBundle = useCallback(async () => {
    if (!policyId) return;
    const d = await invokePub(policyId, 'get_bundle');
    setPolicy(d.policy);
    setCliente(d.cliente);
  }, [policyId]);

  useEffect(() => {
    (async () => {
      try { await reloadBundle(); }
      catch (e: any) { setError(e.message || 'Erro ao carregar'); }
      finally { setLoading(false); }
    })();
  }, [reloadBundle]);

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
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;
  if (!policy || !api) return null;

  const empresa = cliente?.razao_social || cliente?.nome_fantasia || cliente?.nome || 'Empresa';

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
                Acesso público (sem login) para o gestor de RH. Todas as alterações são salvas em tempo real.
              </p>
            </div>
          </div>

          <PremioHotelariaSection
            policy={policy}
            cliente={cliente}
            onUpdate={onUpdate}
          />

          <p className="text-[11px] text-muted-foreground text-center">
            Monte Verde Contabilidade • Módulo Prêmio para Hotelaria
          </p>
        </div>
      </div>
    </PrizePublicApiProvider>
  );
}