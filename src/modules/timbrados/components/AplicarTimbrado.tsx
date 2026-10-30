import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, FileArchive, ChevronLeft, ChevronRight, AlertTriangle, Send, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import FileDropZone from '@/components/pdftools/FileDropZone';
import { carregarFundos, type Timbrado, type EmpresaOpt } from '../api';
import { aplicarTimbrado, renderizarPagina, toBlob, type ResultadoArquivo } from '../aplicar';
import { nomeTimbrado, type Margens } from '../geometria';

interface Props {
  timbrados: Timbrado[];
  empresas: EmpresaOpt[];
  onEnviarMontador?: (files: File[]) => void;
}

const TODAS = '__todas__';

export default function AplicarTimbrado({ timbrados, empresas, onEnviarMontador }: Props) {
  const [empresa, setEmpresa] = useState<string>(TODAS);
  const [timbradoId, setTimbradoId] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [ajuste, setAjuste] = useState<Margens | null>(null);
  const [recSup, setRecSup] = useState(0);
  const [recInf, setRecInf] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [resultados, setResultados] = useState<ResultadoArquivo[]>([]);
  const [sel, setSel] = useState(0);
  const [pag, setPag] = useState(1);
  const [imgs, setImgs] = useState<{ orig: string | null; novo: string | null }>({ orig: null, novo: null });
  const [renderizando, setRenderizando] = useState(false);

  const nomeEmpresa = useMemo(() => new Map(empresas.map(e => [e.id, e.nome])), [empresas]);
  const disponiveis = useMemo(() => timbrados.filter(t => t.ativo && (empresa === TODAS || t.empresa_id === empresa || t.empresa_id === null)), [timbrados, empresa]);
  const timbrado = timbrados.find(t => t.id === timbradoId) || null;

  useEffect(() => {
    if (timbradoId && !disponiveis.some(t => t.id === timbradoId)) setTimbradoId('');
    if (!timbradoId && disponiveis.length === 1) setTimbradoId(disponiveis[0].id);
  }, [disponiveis, timbradoId]);

  useEffect(() => {
    if (!timbrado) { setAjuste(null); return; }
    setAjuste({
      superior: timbrado.margem_superior_mm, inferior: timbrado.margem_inferior_mm,
      esquerda: timbrado.margem_esquerda_mm, direita: timbrado.margem_direita_mm,
    });
  }, [timbrado?.id]);

  const atual = resultados[sel];
  const totalPags = atual?.paginas.length || 0;
  const infoPag = atual?.paginas[pag - 1];
  // número da página no PDF gerado (páginas vazias são puladas)
  const pagSaida = atual ? atual.paginas.slice(0, pag).filter(p => p.escala !== null).length : 0;

  useEffect(() => {
    let vivo = true;
    if (!atual) { setImgs({ orig: null, novo: null }); return; }
    setRenderizando(true);
    (async () => {
      try {
        const orig = await renderizarPagina(await atual.original.arrayBuffer(), pag, 360);
        const novo = atual.bytes && infoPag?.escala != null ? await renderizarPagina(atual.bytes, pagSaida, 360) : null;
        if (vivo) setImgs({ orig, novo });
      } catch {
        if (vivo) setImgs({ orig: null, novo: null });
      } finally { if (vivo) setRenderizando(false); }
    })();
    return () => { vivo = false; };
  }, [atual, pag]);

  const processar = async () => {
    if (!timbrado || !ajuste) { toast.error('Escolha um timbrado.'); return; }
    if (!files.length) { toast.error('Envie pelo menos um PDF.'); return; }
    setProcessando(true);
    setResultados([]);
    try {
      const { fundo, fundoPrimeira } = await carregarFundos(timbrado);
      const out: ResultadoArquivo[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgresso(`Processando ${i + 1} de ${files.length}: ${files[i].name}`);
        out.push(await aplicarTimbrado(files[i], {
          fundo, fundoPrimeira, margens: ajuste,
          escalaMinima: timbrado.escala_minima, alinhamento: timbrado.alinhamento_vertical,
          recorteSuperiorMm: recSup, recorteInferiorMm: recInf,
        }));
      }
      setResultados(out);
      setSel(Math.max(0, out.findIndex(r => !r.erro)));
      setPag(1);
      const erros = out.filter(r => r.erro).length;
      if (erros) toast.warning(`${out.length - erros} arquivo(s) prontos, ${erros} com erro.`);
      else toast.success(`${out.length} arquivo(s) com timbrado aplicado.`);
    } catch (e: any) {
      toast.error('Não foi possível carregar o timbrado: ' + (e?.message || e));
    }
    setProcessando(false);
    setProgresso('');
  };

  const okResultados = resultados.filter(r => r.bytes);

  const baixar = (r: ResultadoArquivo) => r.bytes && saveAs(toBlob(r.bytes), nomeTimbrado(r.nome));

  const baixarZip = async () => {
    const zip = new JSZip();
    okResultados.forEach(r => zip.file(nomeTimbrado(r.nome), r.bytes!));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `timbrados_${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const enviarMontador = () => {
    const arquivos = okResultados.map(r => new File([toBlob(r.bytes!)], nomeTimbrado(r.nome), { type: 'application/pdf' }));
    onEnviarMontador?.(arquivos);
  };

  const setM = (k: keyof Margens) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAjuste(a => a ? { ...a, [k]: Number(e.target.value.replace(',', '.')) || 0 } : a);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aplicar timbrado</CardTitle>
          <CardDescription>Envie PDFs do Domínio (holerites, recibos, contratos…). O texto original não é refeito: o documento é encaixado na área útil do timbrado. Os arquivos ficam só neste computador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas</SelectItem>
                  {empresas.filter(e => timbrados.some(t => t.empresa_id === e.id)).map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Timbrado</Label>
              <Select value={timbradoId} onValueChange={setTimbradoId}>
                <SelectTrigger><SelectValue placeholder={disponiveis.length ? 'Selecione' : 'Nenhum timbrado ativo — cadastre um'} /></SelectTrigger>
                <SelectContent>
                  {disponiveis.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} — {t.empresa_id ? nomeEmpresa.get(t.empresa_id) : 'Escritório'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <FileDropZone files={files} setFiles={f => { setFiles(f); setResultados([]); }} label="Arraste os PDFs do Domínio aqui ou clique para selecionar" />

          {ajuste && (
            <details className="rounded-md border p-3">
              <summary className="text-sm font-medium cursor-pointer">Ajuste fino (só para este processamento)</summary>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
                {([['superior', 'Margem sup.'], ['inferior', 'Margem inf.'], ['esquerda', 'Margem esq.'], ['direita', 'Margem dir.']] as const).map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{l} (mm)</span>
                    <Input type="number" step="0.5" min={0} value={ajuste[k]} onChange={setM(k)} />
                  </div>
                ))}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Recorte superior (mm)</span>
                  <Input type="number" step="1" min={0} value={recSup} onChange={e => setRecSup(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Recorte inferior (mm)</span>
                  <Input type="number" step="1" min={0} value={recInf} onChange={e => setRecInf(Number(e.target.value) || 0)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">O recorte ignora a faixa do topo/rodapé do documento original — útil para tirar o cabeçalho que o próprio Domínio imprime.</p>
            </details>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={processar} disabled={processando || !timbrado || !files.length}>
              {processando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Stamp className="h-4 w-4 mr-1" />} Aplicar timbrado
            </Button>
            {progresso && <span className="text-xs text-muted-foreground">{progresso}</span>}
          </div>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg">Resultado</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={baixarZip} disabled={!okResultados.length}><FileArchive className="h-4 w-4 mr-1" /> Baixar todos (ZIP)</Button>
              {onEnviarMontador && (
                <Button variant="outline" onClick={enviarMontador} disabled={!okResultados.length}><Send className="h-4 w-4 mr-1" /> Enviar para o Montador</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              {resultados.map((r, i) => {
                const alertas = r.paginas.filter(p => p.abaixoMinimo).length;
                const paisagem = r.paginas.some(p => p.paisagem);
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer ${i === sel ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/50'}`}
                    onClick={() => { if (!r.erro) { setSel(i); setPag(1); } }}>
                    <span className="flex-1 truncate">{r.nome}</span>
                    {r.erro ? (
                      <span className="text-xs text-destructive">{r.erro}</span>
                    ) : (
                      <>
                        <Badge variant="secondary">{r.paginas.length} pág.</Badge>
                        {alertas > 0 && <Badge className="bg-warning text-warning-foreground hover:bg-warning">{alertas} abaixo do mínimo</Badge>}
                        {paisagem && <Badge variant="outline">paisagem</Badge>}
                        <Button size="sm" variant="ghost" className="h-7" onClick={e => { e.stopPropagation(); baixar(r); }}>
                          <Download className="h-4 w-4 mr-1" /> Baixar PDF
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {atual && !atual.erro && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={pag <= 1} onClick={() => setPag(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm">Página {pag} de {totalPags}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={pag >= totalPags} onClick={() => setPag(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  {infoPag && (
                    <span className="text-sm">
                      {infoPag.escala === null ? 'Página em branco — não incluída' : <>Escala aplicada: <strong>{Math.round(infoPag.escala * 100)}%</strong></>}
                    </span>
                  )}
                </div>
                {infoPag?.abaixoMinimo && (
                  <Alert className="border-warning bg-warning/10">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription>
                      O conteúdo desta página precisou ser reduzido para {Math.round((infoPag.escala || 0) * 100)}%, abaixo do mínimo de {Math.round((timbrado?.escala_minima || 0) * 100)}%. Confira a leitura; se precisar, diminua as margens ou use o recorte superior/inferior.
                    </AlertDescription>
                  </Alert>
                )}
                {infoPag?.paisagem && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Página original em paisagem: foi encaixada na folha A4 em pé com a mesma regra.</AlertDescription>
                  </Alert>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {(['orig', 'novo'] as const).map(k => (
                    <div key={k} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{k === 'orig' ? 'Original' : 'Com timbrado'}</p>
                      <div className="border rounded-sm bg-card min-h-[200px] flex items-center justify-center">
                        {renderizando ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          : imgs[k] ? <img src={imgs[k]!} alt={k} className="w-full h-auto" />
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
