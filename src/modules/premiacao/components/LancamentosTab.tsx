import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Paperclip, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { tbl, efetivoPontos, fmtComp, type Catalogo, type Lancamento, type Politica } from '../hooks/usePremiacao';

type Resolvido = { tipo: 'servico' | 'desabono'; id: string; codigo: string; descricao: string; pontos: number; gera: boolean; limite: number | null; exigeComp: boolean };

export default function LancamentosTab({ politica, cat, competencia }: { politica: Politica; cat: Catalogo; competencia: string }) {
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [colab, setColab] = useState('');
  const [f, setF] = useState({ codigo: '', quantidade: 1, data: new Date().toISOString().slice(0, 10), os: '', obs: '' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lote, setLote] = useState('');
  const [verLote, setVerLote] = useState(false);

  const load = async () => {
    const [l, a] = await Promise.all([
      tbl('premiacao_lancamentos').select('*').eq('politica_id', politica.id).eq('competencia', competencia).order('created_at', { ascending: false }),
      tbl('premiacao_apuracoes').select('colaborador_id,status').eq('politica_id', politica.id).eq('competencia', competencia).neq('status', 'aberta'),
    ]);
    setLancs(l.data || []); setFechados(new Set((a.data || []).map((x: any) => x.colaborador_id)));
  };
  useEffect(() => { load(); }, [politica.id, competencia]);

  const resolver = (codigo: string): Resolvido | null => {
    const c = codigo.trim();
    const s = cat.servicos.find(x => x.codigo === c && x.ativo);
    if (s) return { tipo: 'servico', id: s.id, codigo: s.codigo, descricao: s.descricao, pontos: efetivoPontos(s, cat.medalhas), gera: s.gera_pontos, limite: s.limite_por_competencia, exigeComp: s.exige_comprovacao };
    const d = cat.desabonos.find(x => x.codigo === c && x.ativo);
    if (d) return { tipo: 'desabono', id: d.id, codigo: d.codigo, descricao: d.descricao, pontos: d.pontos, gera: true, limite: null, exigeComp: false };
    return null;
  };
  const r = useMemo(() => resolver(f.codigo), [f.codigo, cat]);

  const validar = (colabId: string, res: Resolvido | null, qtd: number, obs: string, extra: Lancamento[] = []): string | null => {
    if (!colabId) return 'Selecione o colaborador.';
    if (!res) return 'Código não encontrado.';
    if (fechados.has(colabId)) return 'Competência já fechada para este colaborador.';
    if (!(qtd > 0)) return 'Quantidade inválida.';
    if (res.tipo === 'desabono' && !obs.trim()) return `Observação obrigatória para desabono (${res.codigo}).`;
    if (res.limite) {
      const ja = [...lancs, ...extra].filter(l => l.colaborador_id === colabId && l.servico_id === res.id).reduce((s, l) => s + l.quantidade, 0);
      if (ja + qtd > res.limite) return `Limite de ${res.limite} por competência para o código ${res.codigo} (já lançado: ${ja}).`;
    }
    return null;
  };

  const montar = (colabId: string, res: Resolvido, qtd: number, data: string, os: string, obs: string, anexo: string | null) => ({
    empresa_id: politica.empresa_id, politica_id: politica.id, colaborador_id: colabId, competencia, data_ocorrencia: data,
    tipo: res.tipo, servico_id: res.tipo === 'servico' ? res.id : null, desabono_id: res.tipo === 'desabono' ? res.id : null,
    codigo: res.codigo, descricao: res.descricao, quantidade: qtd, pontos_unitarios: res.pontos, pontos_total: res.pontos * qtd, gera_pontos: res.gera,
    referencia_os: os || null, observacao: obs || null, anexo_url: anexo,
  });

  const lancar = async () => {
    const e = validar(colab, r, f.quantidade, f.obs); if (e) return toast.error(e);
    if (r!.exigeComp && !arquivo && !f.os) return toast.error('Este serviço exige comprovação: informe o nº da OS ou anexe um arquivo.');
    let anexo: string | null = null;
    if (arquivo) {
      const path = `premiacao/${politica.id}/${competencia}/${crypto.randomUUID()}-${arquivo.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('cliente-dp-uploads').upload(path, arquivo);
      if (up.error) return toast.error('Falha ao enviar anexo: ' + up.error.message);
      anexo = path;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await tbl('premiacao_lancamentos').insert({ ...montar(colab, r!, f.quantidade, f.data, f.os, f.obs, anexo), lancado_por: user?.id || null });
    if (error) return toast.error(error.message);
    toast.success('Lançado.'); setF({ ...f, codigo: '', quantidade: 1, os: '', obs: '' }); setArquivo(null); load();
  };

  const lancarLote = async () => {
    // formato por linha: código colaborador ; código serviço/desabono ; quantidade ; data (dd/mm/aaaa) ; OS ; observação
    const rows: any[] = []; const erros: string[] = [];
    lote.split('\n').map(l => l.trim()).filter(Boolean).forEach((linha, i) => {
      const [cc, cod, q, dt, os, obs] = linha.split(/[;\t]/).map(x => (x || '').trim());
      const c = cat.colaboradores.find(x => x.codigo === cc || x.nome.toUpperCase() === cc.toUpperCase());
      const res = resolver(cod); const qtd = Number(q || 1);
      const data = dt ? dt.split('/').reverse().join('-') : new Date().toISOString().slice(0, 10);
      const e = validar(c?.id || '', res, qtd, obs || '', rows as any);
      if (!c) erros.push(`Linha ${i + 1}: colaborador "${cc}" não encontrado.`);
      else if (e) erros.push(`Linha ${i + 1}: ${e}`);
      else rows.push(montar(c.id, res!, qtd, data, os || '', obs || '', null));
    });
    if (erros.length) return toast.error(erros.slice(0, 5).join('\n'));
    if (!rows.length) return;
    const { error } = await tbl('premiacao_lancamentos').insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} lançamentos incluídos.`); setLote(''); load();
  };

  const abrirAnexo = async (path: string) => {
    const { data } = await supabase.storage.from('cliente-dp-uploads').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };
  const nome = (id: string) => cat.colaboradores.find(c => c.id === id)?.nome || '—';
  const lista = colab ? lancs.filter(l => l.colaborador_id === colab) : lancs;

  return (
    <div className="space-y-3 pt-2">
      <div className="grid md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-2"><Label className="text-xs">Colaborador</Label>
          <Select value={colab} onValueChange={setColab}><SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.colaboradores.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo ? `${c.codigo} — ` : ''}{c.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Código</Label>
          <Select value={f.codigo} onValueChange={v => setF({ ...f, codigo: v })}>
            <SelectTrigger className="h-8 font-mono"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Serviços (medalhas)</div>
              {cat.servicos.filter(s => s.ativo).map(s => (
                <SelectItem key={s.id} value={s.codigo}>{s.codigo} — {s.descricao}</SelectItem>
              ))}
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Desabonos</div>
              {cat.desabonos.filter(d => d.ativo).map(d => (
                <SelectItem key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</SelectItem>
              ))}
            </SelectContent>
          </Select></div>
        <div><Label className="text-xs">Quantidade</Label><Input type="number" min={1} className="h-8" value={f.quantidade} onChange={e => setF({ ...f, quantidade: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Data</Label><Input type="date" className="h-8" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></div>
        <div><Label className="text-xs">Nº da OS</Label><Input className="h-8" value={f.os} onChange={e => setF({ ...f, os: e.target.value })} /></div>
      </div>
      <div className="text-sm min-h-6">{f.codigo && (r
        ? <span>{r.descricao} — {r.tipo === 'desabono' ? <Badge variant="destructive">−{r.pontos * f.quantidade} pts</Badge> : r.gera ? <Badge>{r.pontos * f.quantidade} pts</Badge> : <Badge variant="outline">Só contagem para metas</Badge>}</span>
        : <span className="text-destructive">Código não encontrado</span>)}</div>
      <div className="grid md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-4"><Label className="text-xs">Observação {r?.tipo === 'desabono' && <span className="text-destructive">*</span>}</Label><Input className="h-8" value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} /></div>
        <div><Label className="text-xs">Anexo</Label><Input type="file" className="h-8 text-xs" onChange={e => setArquivo(e.target.files?.[0] || null)} /></div>
        <Button size="sm" onClick={lancar}><Plus className="w-3 h-3 mr-1" />Lançar</Button>
      </div>
      <Button size="sm" variant="outline" onClick={() => setVerLote(v => !v)}><ListPlus className="w-3 h-3 mr-1" />Lançamento em lote</Button>
      {verLote && (
        <div className="space-y-2 border rounded p-2">
          <p className="text-xs text-muted-foreground">Uma linha por lançamento (pode colar do Excel): código do colaborador ; código ; quantidade ; data dd/mm/aaaa ; nº OS ; observação</p>
          <Textarea rows={6} className="font-mono text-xs" value={lote} onChange={e => setLote(e.target.value)} placeholder="15;001;2;05/09/2026;OS123;" />
          <Button size="sm" onClick={lancarLote}>Incluir lote</Button>
        </div>
      )}
      <h4 className="font-semibold text-sm">Lançamentos de {fmtComp(competencia)} {colab && `— ${nome(colab)}`} ({lista.length})</h4>
      <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Colaborador</TableHead><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Qtd</TableHead><TableHead>Pontos</TableHead><TableHead>OS</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{lista.map(l => (
          <TableRow key={l.id}>
            <TableCell>{l.data_ocorrencia.split('-').reverse().join('/')}</TableCell><TableCell>{nome(l.colaborador_id)}</TableCell>
            <TableCell className="font-mono">{l.codigo}</TableCell><TableCell>{l.descricao}</TableCell><TableCell>{l.quantidade}</TableCell>
            <TableCell>{l.tipo === 'desabono' ? <span className="text-destructive font-medium">−{l.pontos_total}</span> : l.gera_pontos ? l.pontos_total : '—'}</TableCell>
            <TableCell>{l.referencia_os || '—'}</TableCell><TableCell className="max-w-48 truncate">{l.observacao}</TableCell>
            <TableCell className="flex gap-1">
              {l.anexo_url && <Button size="icon" variant="ghost" onClick={() => abrirAnexo(l.anexo_url!)}><Paperclip className="w-4 h-4" /></Button>}
              {!fechados.has(l.colaborador_id) && <Button size="icon" variant="ghost" onClick={async () => { if (confirm('Excluir lançamento?')) { await tbl('premiacao_lancamentos').delete().eq('id', l.id); load(); } }}><Trash2 className="w-4 h-4" /></Button>}
            </TableCell>
          </TableRow>))}</TableBody></Table>
    </div>
  );
}
