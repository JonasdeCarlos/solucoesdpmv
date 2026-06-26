import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, FileDown, AlertTriangle } from 'lucide-react';
import { useCliente, useDPProfile, useCCTs, useRubrics, useDiary, useUploads, useRiskFlags, useChecklistRun } from '@/hooks/useSucessoCliente';
import PerfilTab from '@/components/sucessoCliente/tabs/PerfilTab';
import UploadsTab from '@/components/sucessoCliente/tabs/UploadsTab';
import DiarioTab from '@/components/sucessoCliente/tabs/DiarioTab';
import CCTTab from '@/components/sucessoCliente/tabs/CCTTab';
import RubricasTab from '@/components/sucessoCliente/tabs/RubricasTab';
import RiscosTab from '@/components/sucessoCliente/tabs/RiscosTab';
import AdmissoesTab from '@/components/sucessoCliente/tabs/AdmissoesTab';
import AuditoriaTab from '@/components/sucessoCliente/tabs/AuditoriaTab';
import CargosTab from '@/components/sucessoCliente/tabs/CargosTab';
import FeedbackTab from '@/components/sucessoCliente/tabs/FeedbackTab';
import PremioTab from '@/components/sucessoCliente/tabs/PremioTab';
import { generatePerfilPdf, loadBranding } from '@/utils/sucessoCliente/perfilPdf';
import { toast } from 'sonner';

const PROFILE_KEYS = ['digisac_contact_name','channel_default','sla_hours','has_timeclock','workload_type'];

export default function SucessoClienteProfilePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const tabStorageKey = `sucesso-cliente:${id || 'global'}:active-tab`;
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem(tabStorageKey) || 'perfil'; }
    catch { return 'perfil'; }
  });
  const { cliente, reload } = useCliente(id);
  const { profile } = useDPProfile(id);
  const { items: ccts } = useCCTs(id);
  const { items: rubrics } = useRubrics(id);
  const { entries: diary } = useDiary(id);
  const { items: uploads } = useUploads(id);
  const { items: risks } = useRiskFlags(id);
  const today = new Date(); const comp = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const { run: currentRun } = useChecklistRun(id, comp);

  const completude = useMemo(() => {
    if (!cliente) return 0;
    const baseFields = ['codigo_cliente','nome','cnpj','municipio','uf','segmento','contato_nome','contato_email'];
    const filled = baseFields.filter(k => (cliente as any)[k]).length;
    const profFilled = profile ? PROFILE_KEYS.filter(k => (profile as any)[k] !== '' && (profile as any)[k] !== null).length : 0;
    return Math.round(((filled + profFilled) / (baseFields.length + PROFILE_KEYS.length)) * 100);
  }, [cliente, profile]);

  const ccVencendo = ccts.find((c: any) => {
    if (c.deleted_at || c.is_active === false) return false;
    if (!c.validity_end) return false;
    const dias = (new Date(c.validity_end).getTime() - Date.now()) / 86400000;
    return dias >= 0 && dias <= 90;
  });
  const altoRisco = risks.some(r => r.severity === 'alta');

  useEffect(() => {
    try { setActiveTab(localStorage.getItem(tabStorageKey) || 'perfil'); }
    catch { setActiveTab('perfil'); }
  }, [tabStorageKey]);

  useEffect(() => {
    try { localStorage.setItem(tabStorageKey, activeTab); }
    catch { /* noop */ }
  }, [activeTab, tabStorageKey]);

  const exportPdf = async () => {
    if (!cliente) return;
    const branding = await loadBranding();
    await generatePerfilPdf({ cliente, profile, ccts, rubrics, diary, uploads, checklist: currentRun, risks, branding });
    toast.success('PDF gerado.');
  };

  if (!cliente) return <div className="text-center py-12 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={()=>nav('/sucesso-cliente')} className="mb-1"><ChevronLeft className="w-4 h-4"/>Voltar</Button>
          <h2 className="text-2xl font-bold">{cliente.nome}</h2>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
            {cliente.codigo_cliente && <span>#{cliente.codigo_cliente}</span>}
            <span>{cliente.tipo === 'PJ' ? cliente.cnpj : cliente.cpf}</span>
            <span>{cliente.municipio}{cliente.uf && '/'+cliente.uf}</span>
            <Badge variant={cliente.status === 'ativo' ? 'default' : 'secondary'}>{cliente.status}</Badge>
          </div>
        </div>
        <Button onClick={exportPdf}><FileDown className="w-4 h-4 mr-1"/>Emitir relatório PDF</Button>
      </div>

      <Card><CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Completude do perfil</div>
          <Progress value={completude}/>
        </div>
        <div className="text-2xl font-bold">{completude}%</div>
      </CardContent></Card>

      {(ccVencendo || altoRisco) && (
        <Card className="border-amber-500"><CardContent className="p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500"/>
          {ccVencendo && <span>CCT vencendo: <strong>{ccVencendo.sindicato}</strong> ({new Date(ccVencendo.validity_end!).toLocaleDateString('pt-BR')})</span>}
          {altoRisco && <span className="ml-2">⚠ Cliente com risco alto sinalizado.</span>}
        </CardContent></Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="cct">CCT</TabsTrigger>
          <TabsTrigger value="rubricas">Rubricas</TabsTrigger>
          <TabsTrigger value="admissoes">Admissões</TabsTrigger>
          <TabsTrigger value="riscos">Riscos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="cargos">Cargos & Salários</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="premio">Prêmio / Gratificação</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil"><PerfilTab cliente={cliente} onClienteSaved={reload}/></TabsContent>
        <TabsContent value="uploads"><UploadsTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="diario"><DiarioTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="cct"><CCTTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="rubricas"><RubricasTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="admissoes"><AdmissoesTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="riscos"><RiscosTab client_id={cliente.id}/></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab client_id={cliente.id} cliente={cliente}/></TabsContent>
        <TabsContent value="cargos"><CargosTab client_id={cliente.id} cliente={cliente}/></TabsContent>
        <TabsContent value="feedback"><FeedbackTab client_id={cliente.id} cliente={cliente}/></TabsContent>
        <TabsContent value="premio"><PremioTab client_id={cliente.id} cliente={cliente}/></TabsContent>
      </Tabs>
    </div>
  );
}