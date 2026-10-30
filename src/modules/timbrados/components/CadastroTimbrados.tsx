import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Copy, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import TimbradoPreview from './TimbradoPreview';
import {
  listarTimbrados, salvarTimbrado, excluirTimbrado, enviarArquivo, baixarArquivo, tipoDoArquivo,
  type Timbrado, type EmpresaOpt,
} from '../api';
import type { TipoArquivo } from '../aplicar';

interface Props {
  empresas: EmpresaOpt[];
  onChange?: () => void;
}

type Form = Omit<Timbrado, 'id' | 'created_at' | 'arquivo_path' | 'tipo_arquivo'> & {
  id?: string;
  arquivo_path?: string;
  tipo_arquivo?: TipoArquivo;
};

const vazio = (): Form => ({
  nome: '', empresa_id: null,
  arquivo_primeira_pagina_path: null, tipo_arquivo_primeira_pagina: null,
  margem_superior_mm: 35, margem_inferior_mm: 25, margem_esquerda_mm: 15, margem_direita_mm: 15,
  escala_minima: 0.8, alinhamento_vertical: 'topo', ativo: true,
});

const ESCRITORIO = '__escritorio__';

export default function CadastroTimbrados({ empresas, onChange }: Props) {
  const [lista, setLista] = useState<Timbrado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(vazio());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivo1, setArquivo1] = useState<File | null>(null);
  const [remover1, setRemover1] = useState(false);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [tipo, setTipo] = useState<TipoArquivo | null>(null);
  const [bytes1, setBytes1] = useState<ArrayBuffer | null>(null);
  const [tipo1, setTipo1] = useState<TipoArquivo | null>(null);
  const [salvando, setSalvando] = useState(false);

  const nomeEmpresa = useMemo(() => new Map(empresas.map(e => [e.id, e.nome])), [empresas]);

  const recarregar = async () => {
    setCarregando(true);
    try { setLista(await listarTimbrados()); } catch (e: any) { toast.error('Erro ao carregar timbrados: ' + e.message); }
    setCarregando(false);
  };
  useEffect(() => { recarregar(); }, []);

  const abrir = async (t?: Timbrado, duplicar = false) => {
    setArquivo(null); setArquivo1(null); setRemover1(false);
    setBytes(null); setTipo(null); setBytes1(null); setTipo1(null);
    if (!t) { setForm(vazio()); setAberto(true); return; }
    const { created_at, ...rest } = t;
    setForm({ ...rest, id: duplicar ? undefined : t.id, nome: duplicar ? `${t.nome} (cópia)` : t.nome });
    setAberto(true);
    try {
      setBytes(await baixarArquivo(t.arquivo_path)); setTipo(t.tipo_arquivo);
      if (t.arquivo_primeira_pagina_path) {
        setBytes1(await baixarArquivo(t.arquivo_primeira_pagina_path)); setTipo1(t.tipo_arquivo_primeira_pagina || 'pdf');
      }
    } catch { toast.error('Não foi possível carregar o arquivo do timbrado.'); }
  };

  const escolher = async (f: File | undefined, primeira: boolean) => {
    if (!f) return;
    const tp = tipoDoArquivo(f);
    if (!tp) { toast.error('Envie PDF, PNG ou JPG.'); return; }
    const buf = await f.arrayBuffer();
    if (tp !== 'pdf') {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        if (img.width < 2000) toast.warning(`Imagem com ${img.width}×${img.height} px. Recomendado: A4 300 dpi (2480×3508 px).`);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
    if (primeira) { setArquivo1(f); setBytes1(buf); setTipo1(tp); setRemover1(false); }
    else { setArquivo(f); setBytes(buf); setTipo(tp); }
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do timbrado.'); return; }
    if (!arquivo && !form.arquivo_path) { toast.error('Envie o arquivo do timbrado.'); return; }
    setSalvando(true);
    try {
      const payload: any = { ...form, nome: form.nome.trim() };
      if (arquivo) { payload.arquivo_path = await enviarArquivo(arquivo); payload.tipo_arquivo = tipoDoArquivo(arquivo); }
      if (arquivo1) { payload.arquivo_primeira_pagina_path = await enviarArquivo(arquivo1); payload.tipo_arquivo_primeira_pagina = tipoDoArquivo(arquivo1); }
      else if (remover1) { payload.arquivo_primeira_pagina_path = null; payload.tipo_arquivo_primeira_pagina = null; }
      await salvarTimbrado(payload);
      toast.success('Timbrado salvo');
      setAberto(false);
      await recarregar();
      onChange?.();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSalvando(false);
  };

  const alternarAtivo = async (t: Timbrado) => {
    try { await salvarTimbrado({ id: t.id, ativo: !t.ativo }); await recarregar(); onChange?.(); }
    catch (e: any) { toast.error(e.message); }
  };

  const excluir = async (t: Timbrado) => {
    if (!confirm(`Excluir o timbrado "${t.nome}"?`)) return;
    try { await excluirTimbrado(t); await recarregar(); onChange?.(); } catch (e: any) { toast.error(e.message); }
  };

  const margens = {
    superior: form.margem_superior_mm, inferior: form.margem_inferior_mm,
    esquerda: form.margem_esquerda_mm, direita: form.margem_direita_mm,
  };
  const num = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value === '' ? 0 : Number(e.target.value.replace(',', '.')) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Cadastro de timbrados</CardTitle>
          <CardDescription>Papel timbrado do escritório ou de cada cliente, com a área útil onde o documento será encaixado.</CardDescription>
        </div>
        <Button onClick={() => abrir()}><Plus className="h-4 w-4 mr-1" /> Novo timbrado</Button>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum timbrado cadastrado. Clique em "Novo timbrado".</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Margens (sup/inf/esq/dir mm)</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map(t => (
                <TableRow key={t.id} className={t.ativo ? '' : 'opacity-60'}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>{t.empresa_id ? nomeEmpresa.get(t.empresa_id) || '—' : <Badge variant="secondary">Escritório</Badge>}</TableCell>
                  <TableCell className="uppercase text-xs">{t.tipo_arquivo}{t.arquivo_primeira_pagina_path ? ' + 1ª pág.' : ''}</TableCell>
                  <TableCell className="text-xs">{t.margem_superior_mm} / {t.margem_inferior_mm} / {t.margem_esquerda_mm} / {t.margem_direita_mm}</TableCell>
                  <TableCell><Switch checked={t.ativo} onCheckedChange={() => alternarAtivo(t)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrir(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => abrir(t, true)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Excluir" onClick={() => excluir(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar timbrado' : 'Novo timbrado'}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-[1fr_auto] gap-6">
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Timbrado Monte Verde" />
                </div>
                <div className="space-y-1">
                  <Label>Empresa</Label>
                  <Select value={form.empresa_id || ESCRITORIO} onValueChange={v => setForm(f => ({ ...f, empresa_id: v === ESCRITORIO ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ESCRITORIO}>Escritório (todas as empresas)</SelectItem>
                      {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Arquivo do timbrado</Label>
                <Input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => escolher(e.target.files?.[0], false)} />
                <p className="text-xs text-muted-foreground">Prefira PDF A4 vetorial. Imagens PNG/JPG: A4 em 300 dpi (2480×3508 px).{form.arquivo_path && !arquivo ? ' Deixe em branco para manter o atual.' : ''}</p>
              </div>
              <div className="space-y-1">
                <Label>Timbrado da 1ª página (opcional)</Label>
                <Input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => escolher(e.target.files?.[0], true)} />
                {(bytes1 || form.arquivo_primeira_pagina_path) && !remover1 && (
                  <Button type="button" variant="link" size="sm" className="px-0 h-auto" onClick={() => { setRemover1(true); setArquivo1(null); setBytes1(null); setTipo1(null); }}>
                    Remover timbrado da 1ª página
                  </Button>
                )}
              </div>

              <div>
                <Label>Margens da área útil (mm)</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {([['margem_superior_mm', 'Superior'], ['margem_inferior_mm', 'Inferior'], ['margem_esquerda_mm', 'Esquerda'], ['margem_direita_mm', 'Direita']] as const).map(([k, l]) => (
                    <div key={k} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{l}</span>
                      <Input type="number" step="0.5" min={0} value={form[k] as number} onChange={num(k)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Escala mínima (%)</Label>
                  <Input type="number" min={10} max={100} value={Math.round(form.escala_minima * 100)}
                    onChange={e => setForm(f => ({ ...f, escala_minima: (Number(e.target.value) || 0) / 100 }))} />
                  <p className="text-xs text-muted-foreground">Abaixo disso a página recebe alerta.</p>
                </div>
                <div className="space-y-1">
                  <Label>Alinhamento vertical</Label>
                  <Select value={form.alinhamento_vertical} onValueChange={v => setForm(f => ({ ...f, alinhamento_vertical: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="topo">Topo</SelectItem>
                      <SelectItem value="centro">Centro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Ativo</Label>
                  <div className="pt-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /></div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Demais páginas</p>
              <TimbradoPreview bytes={bytes} tipo={tipo} margens={margens} largura={260} />
              {bytes1 && !remover1 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">1ª página</p>
                  <TimbradoPreview bytes={bytes1} tipo={tipo1} margens={margens} largura={260} />
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
