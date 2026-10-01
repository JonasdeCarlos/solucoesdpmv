import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresas } from '@/modules/taxa-servico/hooks/useTaxaServico';
import { useBrutoAlvo, fbDb, type FbCompetencia } from '../hooks/useBrutoAlvo';
import { sugerirDias } from '../utils/motor';
import FuncionariosTab from '../components/FuncionariosTab';
import ConfigTab from '../components/ConfigTab';
import CompetenciaView from '../components/CompetenciaView';

const STATUS: Record<string, string> = { rascunho: 'Rascunho', calculado: 'Calculado', exportado: 'Exportado', conciliado: 'Conciliado' };

export default function BrutoAlvoPage() {
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [compId, setCompId] = useState<string | null>(null);
  const d = useBrutoAlvo(empresaId);
  const comp = d.competencias.find((c) => c.id === compId) || null;
  const empresaNome = empresas.find((e) => e.id === empresaId)?.nome || '';

  const criar = async () => {
    if (!empresaId) return;
    const ex = d.competencias.find((c) => c.competencia === mes);
    if (ex) return setCompId(ex.id);
    const s = sugerirDias(mes, d.feriados.map((f) => f.data));
    const { data: u } = await fbDb.auth.getUser();
    const { data, error } = await fbDb.from('fb_competencias').insert({ empresa_id: empresaId, competencia: mes, dias_uteis: s.diasUteis, dias_dsr: s.diasDsr, created_by: u?.user?.id ?? null }).select().single();
    if (error) return toast.error(error.message);
    await d.reload(); setCompId((data as FbCompetencia).id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Fechamento por Bruto Alvo</h2>
        <p className="text-sm text-muted-foreground">Informe o bruto desejado e o sistema calcula as horas de adicional noturno e extras, com prévia igual à do Domínio.</p>
      </div>
      <div className="flex gap-2 items-center max-w-2xl">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar empresa…" className="pl-8" /></div>
        <Select value={empresaId || ''} onValueChange={(v) => { setEmpresaId(v); setCompId(null); }}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
          <SelectContent>{empresas.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase().trim())).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {empresaId && d.config && (comp ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setCompId(null)}><ArrowLeft className="w-4 h-4 mr-1" />Competências</Button>
            <h3 className="font-semibold">Competência {comp.competencia.slice(5, 7)}/{comp.competencia.slice(0, 4)}</h3>
            <Badge variant="secondary">{STATUS[comp.status]}</Badge>
          </div>
          <CompetenciaView key={comp.id} empresaNome={empresaNome} comp={comp} config={d.config} rubricas={d.rubricas} funcionarios={d.funcionarios} feriados={d.feriados} modelos={d.modelos} onChanged={d.reload} />
        </div>
      ) : (
        <Tabs defaultValue="competencias">
          <TabsList><TabsTrigger value="competencias">Competências</TabsTrigger><TabsTrigger value="funcionarios">Funcionários</TabsTrigger><TabsTrigger value="config">Configuração</TabsTrigger></TabsList>
          <TabsContent value="competencias">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Competências</CardTitle>
                <div className="flex gap-2"><Input type="month" className="w-40" value={mes} onChange={(e) => setMes(e.target.value)} /><Button onClick={criar}><Plus className="w-4 h-4 mr-1" />Abrir competência</Button></div>
              </CardHeader>
              <CardContent>
                {!d.competencias.length ? <p className="text-sm text-muted-foreground">Nenhuma competência.</p> : (
                  <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-2">Mês</th><th className="p-2">Dias úteis / DSR</th><th className="p-2">Status</th><th /></tr></thead>
                    <tbody>{d.competencias.map((c) => (
                      <tr key={c.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => setCompId(c.id)}>
                        <td className="p-2">{c.competencia.slice(5, 7)}/{c.competencia.slice(0, 4)}</td><td className="p-2">{c.dias_uteis} / {c.dias_dsr}</td>
                        <td className="p-2"><Badge variant="secondary">{STATUS[c.status]}</Badge></td><td className="p-2 text-right text-primary">Abrir</td>
                      </tr>
                    ))}</tbody></table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="funcionarios"><FuncionariosTab empresaId={empresaId} funcionarios={d.funcionarios} reload={d.reload} /></TabsContent>
          <TabsContent value="config"><ConfigTab empresaId={empresaId} config={d.config} rubricas={d.rubricas} feriados={d.feriados} modelos={d.modelos} reload={d.reload} /></TabsContent>
        </Tabs>
      ))}
    </div>
  );
}
