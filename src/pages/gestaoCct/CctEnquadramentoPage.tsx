import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ExternalLink, Landmark, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

type Candidato = {
  nome: string;
  cnpj?: string;
  site?: string;
  confianca: 'alta' | 'media' | 'baixa' | string;
  fonte_url: string;
  justificativa?: string;
};

type Resultado = {
  categoria_termos?: string[];
  observacoes?: string;
  patronais?: Candidato[];
  laborais?: Candidato[];
  fontes_consultadas?: number;
  modo?: string;
  empresa?: { razao_social?: string; nome_fantasia?: string; cnae?: string; municipio?: string; uf?: string } | null;
  fontes?: { titulo: string; url: string }[];
};

const confiancaVariant = (c: string) =>
  c === 'alta' ? 'default' : c === 'media' ? 'secondary' : 'outline';

type Instrumento = {
  titulo: string;
  tipo?: string;
  numero_registro?: string;
  vigencia?: string;
  vigente?: boolean;
  url: string;
  is_pdf?: boolean;
  fonte?: string;
};

const CandidatoCard = ({ c, municipio, uf }: { c: Candidato; municipio: string; uf: string }) => {
  const [buscando, setBuscando] = useState(false);
  const [instrumentos, setInstrumentos] = useState<Instrumento[] | null>(null);
  const [obs, setObs] = useState('');

  const puxarCct = async () => {
    setBuscando(true);
    setInstrumentos(null);
    try {
      const { data, error } = await supabase.functions.invoke('cct-mediador-instrumento', {
        body: { sindicato: c.nome, cnpj: c.cnpj || '', municipio, uf },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const res = data as { instrumentos?: Instrumento[]; observacoes?: string };
      setInstrumentos(res.instrumentos || []);
      setObs(res.observacoes || '');
      if (!res.instrumentos?.length) toast.info('Nenhum instrumento localizado — confirme direto no Mediador.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao puxar a CCT do Mediador.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">{c.nome}</p>
          <Badge variant={confiancaVariant(c.confianca) as never} className="shrink-0 capitalize">
            {c.confianca}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          CNPJ: {c.cnpj?.trim() ? c.cnpj : 'não encontrado'}
        </p>
        <p className="text-sm text-muted-foreground break-all">
          Site: {c.site?.trim() ? (
            <a href={c.site.startsWith('http') ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {c.site}
            </a>
          ) : 'não encontrado'}
        </p>
        {c.justificativa && <p className="text-sm">{c.justificativa}</p>}
        {c.fonte_url && (
          <a href={c.fonte_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all">
            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Fonte
          </a>
        )}

        <div className="pt-1">
          <Button size="sm" variant="secondary" onClick={puxarCct} disabled={buscando}>
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {buscando ? 'Buscando CCT...' : 'Puxar CCT vigente (Mediador)'}
          </Button>
        </div>

        {instrumentos && (
          <div className="rounded-md border p-3 space-y-2">
            {instrumentos.length ? (
              instrumentos.map((i, idx) => (
                <div key={`${i.url}-${idx}`} className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{i.titulo}</span>
                    {i.vigente && <Badge className="text-[10px]">vigente</Badge>}
                    {i.is_pdf && <Badge variant="outline" className="text-[10px]">PDF</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[i.tipo, i.numero_registro && `Registro ${i.numero_registro}`, i.vigencia].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all">
                    <ExternalLink className="w-3 h-3 shrink-0" /> Baixar / abrir documento
                  </a>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum instrumento localizado.</p>
            )}
            {obs && <p className="text-xs text-muted-foreground">{obs}</p>}
            <a
              href="http://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Conferir no Mediador oficial
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const maskCnpj = (v: string) =>
  v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const CctEnquadramentoPage = () => {
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('MG');
  const [cnae, setCnae] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [atividade, setAtividade] = useState('');
  const [loading, setLoading] = useState<false | 'geral' | 'mte'>(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const buscar = async (modo: 'geral' | 'mte') => {
    if (!municipio.trim()) {
      toast.error('Informe o município.');
      return;
    }
    setLoading(modo);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('cct-enquadramento-buscar', {
        body: {
          municipio: municipio.trim(),
          uf,
          cnae: cnae.trim(),
          atividade: atividade.trim(),
          cnpj: cnpj.replace(/\D/g, ''),
          modo,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResultado(data as Resultado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao buscar sindicatos.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enquadramento sindical</h1>
        <p className="text-sm text-muted-foreground">
          Pesquisa sugestiva de sindicato patronal e laboral por município, CNAE e atividade.
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Resultado apenas sugestivo — confirme sempre no CNES/Mediador antes de usar. Este enquadramento não é
          vinculado automaticamente a nenhum cliente; para associar a uma empresa, cadastre a CCT normalmente em
          Gestão de CCT.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da consulta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="municipio">Município</Label>
              <Input id="municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Ex.: Camanducaia" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cnae">CNAE</Label>
              <Input id="cnae" value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="Ex.: 5611-2/01 — Restaurantes" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ de um dos participantes (opcional)</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
              <p className="text-xs text-muted-foreground">Empresa ou sindicato — usamos a Receita para enriquecer a busca.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atividade">Descrição da atividade</Label>
            <Textarea id="atividade" rows={3} value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Descreva a atividade principal da empresa." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => buscar('geral')} disabled={loading !== false}>
              {loading === 'geral' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading === 'geral' ? 'Buscando sindicatos...' : 'Buscar sindicatos'}
            </Button>
            <Button variant="secondary" onClick={() => buscar('mte')} disabled={loading !== false}>
              {loading === 'mte' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
              {loading === 'mte' ? 'Consultando Mediador...' : 'Buscar no MTE (Mediador)'}
            </Button>
            <Button variant="outline" asChild>
              <a href="http://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo" target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" /> Abrir Mediador
              </a>
            </Button>
          </div>

        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Consultando fontes e classificando a categoria...</p>
          </CardContent>
        </Card>
      )}

      {resultado && !loading && (
        <div className="space-y-6">
          {resultado.empresa && (
            <Card>
              <CardHeader><CardTitle className="text-base">Dados do CNPJ informado</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Razão social:</span> {resultado.empresa.razao_social || '—'}</p>
                {resultado.empresa.nome_fantasia && <p><span className="text-muted-foreground">Nome fantasia:</span> {resultado.empresa.nome_fantasia}</p>}
                <p><span className="text-muted-foreground">CNAE:</span> {resultado.empresa.cnae || '—'}</p>
                <p><span className="text-muted-foreground">Localidade:</span> {resultado.empresa.municipio || '—'}/{resultado.empresa.uf || '—'}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Classificação da IA {resultado.modo === 'mte' && <Badge variant="secondary" className="ml-2">Mediador/MTE</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resultado.categoria_termos?.length ? (
                <div className="flex flex-wrap gap-2">
                  {resultado.categoria_termos.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum termo de categoria identificado.</p>
              )}
              {resultado.observacoes && <p className="text-sm">{resultado.observacoes}</p>}
              <p className="text-xs text-muted-foreground">Fontes consultadas: {resultado.fontes_consultadas ?? 0}</p>
            </CardContent>
          </Card>


          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="font-semibold">Sindicato patronal (candidatos)</h2>
              {resultado.patronais?.length ? (
                resultado.patronais.map((c, i) => <CandidatoCard key={`p-${i}`} c={c} />)
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
              )}
            </section>
            <section className="space-y-3">
              <h2 className="font-semibold">Sindicato laboral (candidatos)</h2>
              {resultado.laborais?.length ? (
                resultado.laborais.map((c, i) => <CandidatoCard key={`l-${i}`} c={c} />)
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
              )}
            </section>
          </div>

          {!!resultado.fontes?.length && (
            <Card>
              <CardHeader><CardTitle className="text-base">Fontes usadas na busca</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {resultado.fontes.map((f) => (
                  <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline break-all">
                    {f.titulo || f.url}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CctEnquadramentoPage;
