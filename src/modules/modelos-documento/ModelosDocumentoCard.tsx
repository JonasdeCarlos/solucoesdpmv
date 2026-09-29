import { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileUp, Loader2, Sparkles, Trash2, Eye, FileDown, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useModelosDocumento, type ModeloDoc } from './useModelosDocumento';
import {
  CAMPOS_DISPONIVEIS, TIPO_LABEL, baixarPdf, base64ToBytes, detectarEspacos, fileToBase64, labelCampo, preencherModelo, renderPaginas,
  type Campo, type TipoModelo,
} from './lib';

export type PessoaModelo = { id: string; nome: string; cpf?: string | null; matricula?: string | null; codigo?: string | null; cargo?: string | null; setor?: string | null; data_admissao?: string | null };

type Props = {
  empresaId: string;
  escopo: 'premio' | 'excelencia';
  refId: string;
  tipos: TipoModelo[];
  pessoas: PessoaModelo[];
  /** Monta os dados de preenchimento para uma pessoa. */
  montarDados: (p: PessoaModelo, extra: { competencia: string; valor: string; pontos: string; observacao: string }) => Record<string, string>;
};

const MAX = 4 * 1024 * 1024;

export default function ModelosDocumentoCard({ empresaId, escopo, refId, tipos, pessoas, montarDados }: Props) {
  const m = useModelosDocumento(refId);
  const [enviando, setEnviando] = useState<TipoModelo | null>(null);
  const [editor, setEditor] = useState<ModeloDoc | null>(null);
  const [gerar, setGerar] = useState<ModeloDoc | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const enviar = async (tipo: TipoModelo, f: File | undefined) => {
    if (!f) return;
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return toast.error('Envie o modelo em PDF.');
    if (f.size > MAX) return toast.error('O PDF deve ter no máximo 4 MB.');
    setEnviando(tipo);
    try {
      const b64 = await fileToBase64(f);
      const espacos = await detectarEspacos(base64ToBytes(b64));
      let campos: Campo[] = espacos.map(({ antes: _a, ...c }) => c);
      if (espacos.length) {
        const { data, error } = await supabase.functions.invoke('modelo-documento-ia', {
          body: { tipo: TIPO_LABEL[tipo], campos_disponiveis: CAMPOS_DISPONIVEIS, espacos: espacos.map((e, i) => ({ i, contexto: e.contexto, antes: e.antes })) },
        });
        if (error || (data as any)?.error) toast.error('A IA não conseguiu identificar os campos. Ajuste manualmente.');
        const mapa: { i: number; campo: string }[] = (data as any)?.mapa || [];
        campos = campos.map((c, i) => ({ ...c, campo: mapa.find(x => x.i === i)?.campo || '' }));
      } else {
        toast.info('Não achei espaços em branco (____) no PDF. Clique na página para marcar onde cada dado entra.');
      }
      const antigo = m.doTipo(tipo);
      const row: Partial<ModeloDoc> = { empresa_id: empresaId, escopo, ref_id: refId, tipo, nome: f.name.replace(/\.pdf$/i, ''), arquivo_nome: f.name, pdf_base64: b64, campos, usar_personalizado: true };
      const { error } = await m.salvar(antigo ? { ...row, id: antigo.id } : row);
      if (error) throw error;
      toast.success(`Modelo enviado: ${campos.filter(c => c.campo).length} espaço(s) identificados. Confira a revisão.`);
      const { data: salvo } = await (supabase.from('premio_modelos_documento' as any) as any).select('*').eq('ref_id', refId).eq('tipo', tipo).order('updated_at', { ascending: false }).limit(1).single();
      if (salvo) setEditor(salvo as ModeloDoc);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao ler o PDF.');
    } finally { setEnviando(null); }
  };

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-sm">Modelos de documento</h4>
        <p className="text-xs text-muted-foreground">Escolha entre o modelo do sistema ou um modelo da empresa em PDF. A IA encontra os espaços em branco e o sistema preenche com os dados de cada funcionário.</p>
      </div>
      <div className="space-y-2">
        {tipos.map(tipo => {
          const mod = m.doTipo(tipo);
          const usar = mod?.usar_personalizado ? 'empresa' : 'sistema';
          return (
            <div key={tipo} className="border rounded-md p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="text-sm font-medium">{TIPO_LABEL[tipo]}</div>
                <div className="text-xs text-muted-foreground">{mod ? `Modelo da empresa: ${mod.arquivo_nome || mod.nome} · ${mod.campos.filter(c => c.campo).length} campo(s)` : 'Nenhum modelo da empresa enviado'}</div>
              </div>
              <RadioGroup className="flex gap-4" value={usar} onValueChange={async v => {
                if (v === 'empresa' && !mod) { inputs.current[tipo]?.click(); return; }
                if (mod) { const { error } = await m.salvar({ id: mod.id, usar_personalizado: v === 'empresa' }); if (error) toast.error(error.message); }
              }}>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="sistema" id={`${refId}-${tipo}-s`} /><Label htmlFor={`${refId}-${tipo}-s`} className="text-xs">Modelo do sistema</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="empresa" id={`${refId}-${tipo}-e`} /><Label htmlFor={`${refId}-${tipo}-e`} className="text-xs">Modelo da empresa</Label></div>
              </RadioGroup>
              <input ref={el => (inputs.current[tipo] = el)} type="file" accept="application/pdf" className="hidden" onChange={e => { enviar(tipo, e.target.files?.[0]); e.target.value = ''; }} />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={enviando !== null} onClick={() => inputs.current[tipo]?.click()}>
                  {enviando === tipo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileUp className="w-3 h-3 mr-1" />}{mod ? 'Trocar PDF' : 'Enviar modelo'}
                </Button>
                {mod && <Button size="sm" variant="outline" onClick={() => setEditor(mod)}><Pencil className="w-3 h-3 mr-1" />Revisar espaços</Button>}
                {mod && <Button size="sm" onClick={() => setGerar(mod)}><FileDown className="w-3 h-3 mr-1" />Gerar preenchido</Button>}
                {mod && <Button size="sm" variant="ghost" onClick={async () => { if (confirm('Apagar o modelo da empresa? Volta a usar o do sistema.')) await m.remover(mod.id); }}><Trash2 className="w-3 h-3" /></Button>}
              </div>
            </div>
          );
        })}
      </div>
      {editor && <EditorEspacos modelo={editor} onClose={() => setEditor(null)} onSave={async campos => {
        const { error } = await m.salvar({ id: editor.id, campos });
        if (error) toast.error(error.message); else { toast.success('Espaços salvos.'); setEditor(null); }
      }} amostra={pessoas[0] ? montarDados(pessoas[0], { competencia: '', valor: '', pontos: '', observacao: '' }) : {}} />}
      {gerar && <GerarDialog modelo={gerar} pessoas={pessoas} montarDados={montarDados} onClose={() => setGerar(null)} />}
    </CardContent></Card>
  );
}

function EditorEspacos({ modelo, onClose, onSave, amostra }: { modelo: ModeloDoc; onClose: () => void; onSave: (c: Campo[]) => void; amostra: Record<string, string> }) {
  const [campos, setCampos] = useState<Campo[]>(modelo.campos || []);
  const [paginas, setPaginas] = useState<Awaited<ReturnType<typeof renderPaginas>> | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const bytes = useMemo(() => base64ToBytes(modelo.pdf_base64), [modelo.pdf_base64]);
  useMemo(() => { renderPaginas(bytes).then(setPaginas).catch(() => toast.error('Não foi possível mostrar o PDF.')); }, [bytes]);

  const upd = (i: number, patch: Partial<Campo>) => setCampos(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const previa = async () => baixarPdf(await preencherModelo(modelo.pdf_base64, campos, [amostra]), `previa-${modelo.nome}.pdf`);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Revisar espaços — {modelo.nome}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Confira o dado de cada espaço. Clique na página para adicionar um espaço novo; arraste não é necessário — ajuste a posição com os números se precisar.</p>
        <div className="grid md:grid-cols-[1fr_380px] gap-3 overflow-hidden flex-1 min-h-0">
          <div className="overflow-auto bg-muted rounded p-2 space-y-3">
            {!paginas && <Loader2 className="w-5 h-5 animate-spin m-6" />}
            {paginas?.map((pg, pi) => {
              const k = pg.w / pg.pw;
              return (
                <div key={pi} className="relative mx-auto shadow" style={{ width: pg.w, height: pg.h }}
                  onClick={e => {
                    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = (e.clientX - r.left) / k, y = pg.ph - (e.clientY - r.top) / k;
                    setCampos(cs => [...cs, { page: pi + 1, x, y, w: 160, size: 10, campo: 'nome', contexto: 'Adicionado manualmente' }]);
                    setSel(campos.length);
                  }}>
                  <img src={pg.url} alt={`Página ${pi + 1}`} className="absolute inset-0 w-full h-full select-none pointer-events-none" />
                  {campos.map((c, i) => c.page === pi + 1 && (
                    <div key={i} onClick={e => { e.stopPropagation(); setSel(i); }}
                      className={`absolute border-2 rounded-sm text-[10px] leading-none px-0.5 truncate cursor-pointer ${sel === i ? 'border-destructive bg-destructive/20' : c.campo ? 'border-primary bg-primary/20' : 'border-muted-foreground bg-background/60'}`}
                      style={{ left: c.x * k, top: (pg.ph - c.y) * k - c.size * k * 1.2, width: c.w * k, height: c.size * k * 1.4 }}>
                      {c.campo ? labelCampo(c.campo) : '(vazio)'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="overflow-auto space-y-2 pr-1">
            {campos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum espaço. Clique na página para adicionar.</p>}
            {campos.map((c, i) => (
              <div key={i} className={`border rounded p-2 space-y-1 ${sel === i ? 'border-destructive' : ''}`} onClick={() => setSel(i)}>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">pág. {c.page}</Badge>
                  <span className="text-[11px] text-muted-foreground truncate flex-1" title={c.contexto}>{c.contexto}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); setCampos(cs => cs.filter((_, j) => j !== i)); setSel(null); }}><X className="w-3 h-3" /></Button>
                </div>
                <Select value={c.campo || '__none'} onValueChange={v => upd(i, { campo: v === '__none' ? '' : v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Deixar em branco (ex.: assinatura)</SelectItem>
                    {CAMPOS_DISPONIVEIS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {sel === i && (
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'w', 'size'] as const).map(f => (
                      <div key={f}><Label className="text-[10px]">{f === 'w' ? 'largura' : f === 'size' ? 'fonte' : f}</Label>
                        <Input className="h-6 text-xs px-1" type="number" value={Math.round(c[f] * 10) / 10} onChange={e => upd(i, { [f]: Number(e.target.value) } as any)} /></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={previa}><Eye className="w-3 h-3 mr-1" />Prévia com o 1º funcionário</Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(campos)}><Sparkles className="w-3 h-3 mr-1" />Salvar espaços</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerarDialog({ modelo, pessoas, montarDados, onClose }: { modelo: ModeloDoc; pessoas: PessoaModelo[]; montarDados: Props['montarDados']; onClose: () => void }) {
  const [quem, setQuem] = useState<string>('__todos');
  const [extra, setExtra] = useState({ competencia: new Date().toISOString().slice(0, 7), valor: '', pontos: '', observacao: '' });
  const [busy, setBusy] = useState(false);
  const usados = new Set(modelo.campos.map(c => c.campo));
  const go = async () => {
    const lista = quem === '__todos' ? pessoas : pessoas.filter(p => p.id === quem);
    if (!lista.length) return toast.error('Cadastre funcionários nesta política primeiro.');
    setBusy(true);
    try {
      const bytes = await preencherModelo(modelo.pdf_base64, modelo.campos, lista.map(p => montarDados(p, extra)));
      baixarPdf(bytes, `${modelo.nome}${lista.length === 1 ? '-' + lista[0].nome.replace(/\s+/g, '_') : '-todos'}.pdf`);
    } catch (e: any) { toast.error(e?.message || 'Falha ao gerar.'); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar {TIPO_LABEL[modelo.tipo].toLowerCase()} preenchido</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Funcionário</Label>
            <Select value={quem} onValueChange={setQuem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos ({pessoas.length}) — um PDF com uma cópia por pessoa</SelectItem>
                {pessoas.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-2">
            {usados.has('competencia') && <div><Label className="text-xs">Competência</Label><Input type="month" value={extra.competencia} onChange={e => setExtra({ ...extra, competencia: e.target.value })} /></div>}
            {(usados.has('valor') || usados.has('valor_extenso')) && <div><Label className="text-xs">Valor (deixe vazio para usar o apurado)</Label><Input inputMode="decimal" value={extra.valor} onChange={e => setExtra({ ...extra, valor: e.target.value })} placeholder="0,00" /></div>}
            {usados.has('pontos') && <div><Label className="text-xs">Pontos</Label><Input value={extra.pontos} onChange={e => setExtra({ ...extra, pontos: e.target.value })} /></div>}
            {usados.has('observacao') && <div className="col-span-2"><Label className="text-xs">Observação</Label><Input value={extra.observacao} onChange={e => setExtra({ ...extra, observacao: e.target.value })} /></div>}
          </div>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}Gerar PDF</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
