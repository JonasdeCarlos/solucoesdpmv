import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, Loader2, Plus, AlertTriangle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { competenciaAtual, rpc, tbl, usePoliticas, usePremiacaoCatalogo } from '../hooks/usePremiacao';
import { PoliticaTab, ReferenciasTab, MedalhasTab, ServicosTab, DesabonosTab, ColaboradoresTab } from './CadastrosTabs';
import MetasTab from './MetasTab';
import LancamentosTab from './LancamentosTab';
import ApuracaoTab from './ApuracaoTab';
import RegulamentoTab from './RegulamentoTab';
import ExtratoTab from './ExtratoTab';
import LinkGestorDialog from './LinkGestorDialog';

export default function ProgramaExcelenciaSection({ clientId, cliente }: { clientId: string; cliente: any }) {
  const { items, loading, reload } = usePoliticas(clientId);
  const [selId, setSelId] = useState<string>('');
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linkAberto, setLinkAberto] = useState(false);
  const politica = items.find(p => p.id === selId) || null;
  const cat = usePremiacaoCatalogo(politica);
  const empresaNome = [cliente?.nome, cliente?.cnpj ? `CNPJ ${cliente.cnpj}` : cliente?.cpf ? `CPF ${cliente.cpf}` : ''].filter(Boolean).join(' — ');

  useEffect(() => { if (!selId && items.length) setSelId(items[0].id); }, [items, selId]);

  const criar = async () => {
    setCriando(true);
    const { data, error } = await tbl('premiacao_politicas').insert({ empresa_id: clientId, nome: 'Programa Excelência' }).select('*').single();
    if (error) { toast.error(error.message); setCriando(false); return; }
    const s = await rpc('premiacao_seed_politica', { p_politica_id: data.id });
    if (s.error) toast.error(s.error.message); else toast.success('Programa Excelência criado com a carga inicial.');
    await reload(); setSelId(data.id); setAberto(true); setCriando(false);
  };

  return (
    <Card className="border-primary/40"><CardContent className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2">
          <Award className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Programa Excelência — premiação por pontos</h3>
            <p className="text-xs text-muted-foreground">Medalhas por serviço, troféus por metas, desabonos e pontuação de referência por função. Ultrapassou a referência, todos os pontos do mês viram prêmio.</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {items.length > 0 && (
            <Select value={selId} onValueChange={setSelId}>
              <SelectTrigger className="w-56 h-8"><SelectValue placeholder="Política" /></SelectTrigger>
              <SelectContent>{items.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={criar} disabled={criando}>{criando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Nova política de pontos</Button>
          {politica && <Button size="sm" variant="outline" onClick={() => setLinkAberto(true)}><Link2 className="w-3 h-3 mr-1" />Link do gestor</Button>}
          {politica && <Button size="sm" onClick={() => setAberto(v => !v)}>{aberto ? 'Recolher' : 'Abrir'}</Button>}
        </div>
      </div>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {politica && aberto && (
        <>
          {politica.pontuacao_referencia_padrao === 0 && cat.referencias.length === 0 && (
            <Alert><AlertTriangle className="w-4 h-4" /><AlertDescription>A pontuação de referência ainda está zerada. Defina a referência padrão ou por função antes da primeira apuração.</AlertDescription></Alert>
          )}
          <div className="flex items-end gap-2">
            <div><Label className="text-xs">Competência</Label><Input type="month" className="h-8 w-40" value={competencia} onChange={e => e.target.value && setCompetencia(e.target.value)} /></div>
          </div>
          <Tabs defaultValue="politica">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="politica">Política</TabsTrigger>
              <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
              <TabsTrigger value="referencias">Referências por Função</TabsTrigger>
              <TabsTrigger value="medalhas">Medalhas</TabsTrigger>
              <TabsTrigger value="servicos">Serviços</TabsTrigger>
              <TabsTrigger value="metas">Programa de Metas</TabsTrigger>
              <TabsTrigger value="desabonos">Desabonos</TabsTrigger>
              <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
              <TabsTrigger value="apuracao">Apuração Mensal</TabsTrigger>
              <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
              <TabsTrigger value="extrato">Extrato do Colaborador</TabsTrigger>
            </TabsList>
            <TabsContent value="politica"><PoliticaTab politica={politica} onSaved={reload} /></TabsContent>
            <TabsContent value="colaboradores"><ColaboradoresTab politica={politica} cat={cat} /></TabsContent>
            <TabsContent value="referencias"><ReferenciasTab politica={politica} cat={cat} /></TabsContent>
            <TabsContent value="medalhas"><MedalhasTab politica={politica} cat={cat} /></TabsContent>
            <TabsContent value="servicos"><ServicosTab politica={politica} cat={cat} /></TabsContent>
            <TabsContent value="metas"><MetasTab politica={politica} cat={cat} competencia={competencia} /></TabsContent>
            <TabsContent value="desabonos"><DesabonosTab politica={politica} cat={cat} /></TabsContent>
            <TabsContent value="lancamentos"><LancamentosTab politica={politica} cat={cat} competencia={competencia} /></TabsContent>
            <TabsContent value="apuracao"><ApuracaoTab politica={politica} cat={cat} competencia={competencia} empresa={empresaNome} /></TabsContent>
            <TabsContent value="regulamento"><RegulamentoTab politica={politica} cat={cat} empresa={empresaNome} razaoSocial={cliente?.nome || ''} /></TabsContent>
            <TabsContent value="extrato"><ExtratoTab politica={politica} cat={cat} competencia={competencia} empresa={empresaNome} /></TabsContent>
          </Tabs>
        </>
      )}
      {politica && <LinkGestorDialog politicaId={politica.id} open={linkAberto} onOpenChange={setLinkAberto} />}
    </CardContent></Card>
  );
}
