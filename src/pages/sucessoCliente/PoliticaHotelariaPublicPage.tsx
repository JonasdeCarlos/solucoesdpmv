import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileDown, Building2 } from 'lucide-react';
import { generatePremioPoliticaPdf } from '@/utils/sucessoCliente/premioPoliticaPdf';
import { HOTELARIA_CRITERIOS_INDIVIDUAIS } from '@/utils/sucessoCliente/premioTemplates';

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const labelMes = (m: string) => { const [a, mm] = m.split('-'); return `${MESES[Number(mm)-1] || mm}/${a}`; };

export default function PoliticaHotelariaPublicPage() {
  const { policyId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mes, setMes] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: d, error } = await supabase.functions.invoke('premio-hotelaria-public', { body: { policy_id: policyId } });
        if (error) throw error;
        if ((d as any)?.error) throw new Error((d as any).error);
        setData(d);
        const metas = ((d as any).policy?.hotelaria_config?.metas_mensais) || {};
        const keys = Object.keys(metas).sort().reverse();
        setMes(keys[0] || new Date().toISOString().slice(0, 7));
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar');
      } finally { setLoading(false); }
    })();
  }, [policyId]);

  const mesesDisponiveis = useMemo(() => {
    if (!data) return [] as string[];
    const metas = data.policy?.hotelaria_config?.metas_mensais || {};
    return Object.keys(metas).sort().reverse();
  }, [data]);

  const empresa = data?.cliente?.razao_social || data?.cliente?.nome_fantasia || data?.cliente?.nome || 'Empresa';

  const handlePdf = async () => {
    if (!data || !mes) return;
    const policy = data.policy;
    const config = policy.hotelaria_config || {};
    const metasMap = config.metas_mensais || {};
    if (!metasMap[mes]) return;
    setExporting(true);
    try {
      const criteriosBase = (data.criteria || []).length > 0
        ? data.criteria.map((c: any) => ({ nome: c.nome, descricao: c.descricao, peso: c.peso, essencial: c.essencial }))
        : HOTELARIA_CRITERIOS_INDIVIDUAIS.map(c => ({ nome: c.nome, descricao: c.descricao, peso: c.peso, essencial: false }));
      const legacyPontos: Record<string, number> = policy.hotelaria_pontos || {};
      await generatePremioPoliticaPdf({
        empresa,
        cnpj: data.cliente?.cnpj || undefined,
        verba_label: policy.verba_label,
        politica_nome: policy.nome,
        objetivo: policy.objetivo,
        periodo_tipo: policy.periodo_tipo,
        valor_base: policy.valor_base,
        criterios: criteriosBase,
        participantes: (data.employees || []).map((p: any) => ({ nome: p.nome, cpf: p.cpf, cargo: p.cargo, matricula: p.matricula })),
        remuneracao_variavel: null,
        hotelaria: {
          split_coletivo: config.split_coletivo,
          split_individual: config.split_individual,
          criterios: config.criterios,
          escala: config.escala,
          pontos: (data.employees || []).map((p: any) => ({
            nome: p.nome, cargo: p.cargo,
            pontos: Number(p.pontos ?? legacyPontos[p.id] ?? 0),
          })),
        },
        metas_mes: { competencia: mes, ...metasMap[mes] },
      });
    } finally { setExporting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;
  if (!data) return null;

  const policy = data.policy;
  const config = policy.hotelaria_config || {};
  const metasMap = config.metas_mensais || {};
  const metaMes = mes ? metasMap[mes] : null;
  const participantes = data.employees || [];
  const somaPontos = participantes.reduce((s: number, e: any) => s + Number(e.pontos || 0), 0);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card><CardContent className="p-6 space-y-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <Building2 className="w-6 h-6 text-primary mt-1"/>
              <div>
                <h1 className="text-2xl font-bold">{policy.nome}</h1>
                <p className="text-sm text-muted-foreground">{empresa}{data.cliente?.cnpj ? ` • CNPJ ${data.cliente.cnpj}` : ''}</p>
                {policy.objetivo && <p className="text-sm mt-2">{policy.objetivo}</p>}
              </div>
            </div>
            <Badge variant="secondary">Coletivo {config.split_coletivo || 0}% • Individual {config.split_individual || 0}%</Badge>
          </div>

          <div className="border-t pt-3 flex items-end gap-2 flex-wrap">
            <div className="min-w-[180px]">
              <Label className="text-xs">Competência</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  {mesesDisponiveis.length === 0 && <SelectItem value={new Date().toISOString().slice(0,7)}>Sem metas cadastradas</SelectItem>}
                  {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePdf} disabled={exporting || !metaMes}>
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <FileDown className="w-4 h-4 mr-1"/>}
              Baixar PDF da política {mes && `de ${labelMes(mes)}`}
            </Button>
          </div>
          {!metaMes && mes && <p className="text-[11px] text-amber-600">Não há metas cadastradas para {labelMes(mes)}.</p>}
        </CardContent></Card>

        {metaMes && (
          <Card><CardContent className="p-6 space-y-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Metas — {labelMes(mes)}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="border rounded p-2"><div className="text-xs text-muted-foreground">Meta 0 (R$/dia)</div><div className="font-semibold">{BRL(metaMes.meta_0)}</div></div>
              <div className="border rounded p-2"><div className="text-xs text-muted-foreground">Meta 1 (R$/dia)</div><div className="font-semibold">{BRL(metaMes.meta_1)}</div></div>
              <div className="border rounded p-2"><div className="text-xs text-muted-foreground">Meta 2 (R$/dia)</div><div className="font-semibold">{BRL(metaMes.meta_2)}</div></div>
            </div>
            {metaMes.observacoes && <p className="text-xs text-muted-foreground border-t pt-2">{metaMes.observacoes}</p>}
          </CardContent></Card>
        )}

        <Card><CardContent className="p-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Critérios coletivos</h2>
          <div className="space-y-1 text-sm">
            {(config.criterios || []).map((c: any) => (
              <div key={c.id} className="border rounded p-2">
                <div className="flex justify-between"><span className="font-medium">{c.nome}</span><Badge variant="outline">{c.peso_pct}%</Badge></div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(c.faixas || []).map((f: any) => `${f.nivel.replace('_',' ')}: ${f.pct}%${f.alvo != null ? ` (alvo ${f.alvo})` : ''}`).join(' • ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Participantes ({participantes.length}) — Total: {somaPontos} pts</h2>
          <div className="space-y-1 text-sm">
            {participantes.map((p: any) => (
              <div key={p.id} className="flex justify-between border rounded px-2 py-1">
                <span>{p.nome}{p.cargo && <span className="text-muted-foreground"> • {p.cargo}</span>}</span>
                <span className="text-muted-foreground">{Number(p.pontos || 0)} pts</span>
              </div>
            ))}
            {participantes.length === 0 && <p className="text-xs text-muted-foreground">Nenhum participante ativo cadastrado.</p>}
          </div>
        </CardContent></Card>

        <p className="text-[11px] text-muted-foreground text-center">Documento gerado por Monte Verde Contabilidade • Visualização pública sem necessidade de login.</p>
      </div>
    </div>
  );
}