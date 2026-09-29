import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Save, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { tbl, efetivoPontos, type Catalogo, type Politica } from '../hooks/usePremiacao';
import { FORMULA_RODAPE, TEXTO_REFERENCIA, TEXTO_RUBRICA } from '../utils/textos';

const num = (v: string) => (v === '' ? null : Number(v));
const err = (e: any) => { if (e) { toast.error(e.message?.includes('duplicate') ? 'Código já existe nesta política.' : e.message); return true; } return false; };

export function PoliticaTab({ politica, onSaved }: { politica: Politica; onSaved: () => void }) {
  const [f, setF] = useState<any>(politica);
  useEffect(() => setF(politica), [politica]);
  const salvar = async () => {
    const { id, empresa_id, created_at, updated_at, ...rest } = f;
    const { error } = await tbl('premiacao_politicas').update(rest).eq('id', politica.id);
    if (!err(error)) { toast.success('Política salva.'); onSaved(); }
  };
  const campo = (k: string, label: string, type = 'number', help?: string) => (
    <div><Label className="text-xs">{label}</Label>
      <Input type={type} value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: type === 'number' ? num(e.target.value) : e.target.value || null })} />
      {help && <p className="text-[11px] text-muted-foreground mt-1">{help}</p>}</div>
  );
  return (
    <div className="space-y-3 pt-2">
      <div className="grid md:grid-cols-3 gap-3">
        {campo('nome', 'Nome da política', 'text')}
        {campo('valor_ponto', 'Valor do ponto (R$)')}
        {campo('pontuacao_referencia_padrao', 'Pontuação de referência padrão', 'number', TEXTO_REFERENCIA)}
        {campo('teto_mensal_pontos', 'Teto mensal de pontos (opcional)')}
        {campo('limite_saldo_negativo', 'Limite do saldo negativo (ex.: -200)')}
        {campo('meses_max_transporte', 'Meses máximos de transporte negativo')}
        {campo('codigo_rubrica_dominio', 'Rubrica Domínio', 'text', TEXTO_RUBRICA)}
        {campo('vigencia_inicio', 'Vigência início', 'date')}
        {campo('vigencia_fim', 'Vigência fim', 'date')}
      </div>
      <div className="flex items-center gap-2"><Switch checked={!!f.ativo} onCheckedChange={v => setF({ ...f, ativo: v })} /><span className="text-sm">Política ativa</span></div>
      <p className="text-xs rounded bg-muted p-2">{FORMULA_RODAPE}</p>
      <Button size="sm" onClick={salvar}><Save className="w-3 h-3 mr-1" />Salvar política</Button>
    </div>
  );
}

export function ColaboradoresTab({ politica, cat }: { politica: Politica; cat: Catalogo }) {
  const [novo, setNovo] = useState({ codigo: '', nome: '', cargo_id: '' });
  const add = async () => {
    if (!novo.nome.trim()) return toast.error('Informe o nome.');
    const { error } = await tbl('premiacao_colaboradores').insert({ empresa_id: politica.empresa_id, codigo: novo.codigo || null, nome: novo.nome.trim(), cargo_id: novo.cargo_id || null });
    if (!err(error)) { setNovo({ codigo: '', nome: '', cargo_id: '' }); cat.reload(); }
  };
  const upd = async (id: string, patch: any) => { const { error } = await tbl('premiacao_colaboradores').update(patch).eq('id', id); if (!err(error)) cat.reload(); };
  const importar = async () => {
    const existentes = new Set(cat.colaboradores.map(c => (c.codigo || c.nome).toUpperCase()));
    const rows: any[] = [];
    const { data: ts } = await tbl('ts_funcionarios').select('codigo,nome,ativo').eq('empresa_id', politica.empresa_id);
    (ts || []).forEach((t: any) => rows.push({ codigo: t.codigo, nome: t.nome }));
    const { data: pols } = await tbl('prize_policies').select('id').eq('client_id', politica.empresa_id);
    const ids = (pols || []).map((p: any) => p.id);
    if (ids.length) {
      const { data: pe } = await tbl('prize_employees').select('nome,codigo_folha,matricula,cargo').in('policy_id', ids);
      (pe || []).forEach((e: any) => rows.push({ codigo: e.codigo_folha || e.matricula || null, nome: e.nome, funcao: e.cargo }));
    }
    const vistos = new Set<string>();
    const novos = rows.filter(r => { const k = (r.codigo || r.nome || '').toUpperCase(); if (!k || existentes.has(k) || vistos.has(k)) return false; vistos.add(k); return true; })
      .map(r => ({ ...r, empresa_id: politica.empresa_id, cargo_id: cat.cargos.find(c => c.nome.toUpperCase() === (r.funcao || '').toUpperCase())?.id || null }));
    if (!novos.length) return toast.info('Nenhum funcionário novo para importar.');
    const { error } = await tbl('premiacao_colaboradores').insert(novos);
    if (!err(error)) { toast.success(`${novos.length} colaborador(es) importado(s).`); cat.reload(); }
  };
  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">Código (Domínio)</Label><Input className="w-28" value={novo.codigo} onChange={e => setNovo({ ...novo, codigo: e.target.value })} /></div>
        <div className="flex-1 min-w-48"><Label className="text-xs">Nome</Label><Input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></div>
        <div><Label className="text-xs">Função</Label>
          <Select value={novo.cargo_id} onValueChange={v => setNovo({ ...novo, cargo_id: v })}><SelectTrigger className="w-52"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.cargos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
        <Button size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
        <Button size="sm" variant="outline" onClick={importar}><Download className="w-3 h-3 mr-1" />Importar da Taxa de Serviço e políticas</Button>
      </div>
      {cat.cargos.length === 0 && <p className="text-xs text-muted-foreground">Cadastre as funções na aba Cargos e Salários para usar referências por função.</p>}
      <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Desligamento</TableHead><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{cat.colaboradores.map(c => (
          <TableRow key={c.id}>
            <TableCell><Input className="h-8 w-24" defaultValue={c.codigo || ''} onBlur={e => e.target.value !== (c.codigo || '') && upd(c.id, { codigo: e.target.value || null })} /></TableCell>
            <TableCell>{c.nome}</TableCell>
            <TableCell><Select value={c.cargo_id || ''} onValueChange={v => upd(c.id, { cargo_id: v })}><SelectTrigger className="h-8 w-52"><SelectValue placeholder={c.funcao || 'Selecione'} /></SelectTrigger>
              <SelectContent>{cat.cargos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select></TableCell>
            <TableCell><Input type="date" className="h-8 w-36" defaultValue={c.data_desligamento || ''} onBlur={e => upd(c.id, { data_desligamento: e.target.value || null })} /></TableCell>
            <TableCell><Switch checked={c.ativo} onCheckedChange={v => upd(c.id, { ativo: v })} /></TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={async () => { if (confirm('Excluir colaborador e seus lançamentos?')) { await tbl('premiacao_colaboradores').delete().eq('id', c.id); cat.reload(); } }}><Trash2 className="w-4 h-4" /></Button></TableCell>
          </TableRow>))}</TableBody></Table>
    </div>
  );
}

export function ReferenciasTab({ politica, cat }: { politica: Politica; cat: Catalogo }) {
  const salvar = async (cargo_id: string, v: string) => {
    if (v === '') { await tbl('premiacao_referencias').delete().eq('politica_id', politica.id).eq('cargo_id', cargo_id); }
    else {
      const { error } = await tbl('premiacao_referencias').upsert({ politica_id: politica.id, cargo_id, pontuacao_referencia: Number(v) }, { onConflict: 'politica_id,cargo_id' });
      if (err(error)) return;
    }
    toast.success('Referência salva.'); cat.reload();
  };
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs text-muted-foreground">{TEXTO_REFERENCIA} Em branco = usa a referência padrão ({politica.pontuacao_referencia_padrao}).</p>
      <Table><TableHeader><TableRow><TableHead>Função</TableHead><TableHead>Área</TableHead><TableHead className="w-48">Pontuação de referência</TableHead></TableRow></TableHeader>
        <TableBody>{cat.cargos.map(c => {
          const r = cat.referencias.find(x => x.cargo_id === c.id);
          return <TableRow key={c.id}><TableCell>{c.nome}</TableCell><TableCell>{c.area || '—'}</TableCell>
            <TableCell><Input type="number" className="h-8" placeholder={String(politica.pontuacao_referencia_padrao)} defaultValue={r?.pontuacao_referencia ?? ''} onBlur={e => e.target.value !== String(r?.pontuacao_referencia ?? '') && salvar(c.id, e.target.value)} /></TableCell></TableRow>;
        })}</TableBody></Table>
      {!cat.cargos.length && <p className="text-sm text-muted-foreground">Nenhuma função cadastrada para esta empresa (aba Cargos e Salários).</p>}
    </div>
  );
}

export function MedalhasTab({ politica, cat }: { politica: Politica; cat: Catalogo }) {
  const upd = async (id: string, patch: any) => { const { error } = await tbl('premiacao_medalhas').update(patch).eq('id', id); if (!err(error)) cat.reload(); };
  const add = async () => { const { error } = await tbl('premiacao_medalhas').insert({ politica_id: politica.id, nome: 'Nova medalha', pontos_padrao: 1, cor_hex: '#628E3F', ordem: cat.medalhas.length + 1 }); if (!err(error)) cat.reload(); };
  return (
    <div className="space-y-2 pt-2">
      <Table><TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Nome</TableHead><TableHead>Pontos</TableHead><TableHead>Cor</TableHead><TableHead>Ícone</TableHead><TableHead>Ativa</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{cat.medalhas.map(m => (
          <TableRow key={m.id}>
            <TableCell><Input type="number" className="h-8 w-16" defaultValue={m.ordem} onBlur={e => upd(m.id, { ordem: Number(e.target.value) })} /></TableCell>
            <TableCell><Input className="h-8" defaultValue={m.nome} onBlur={e => e.target.value !== m.nome && upd(m.id, { nome: e.target.value })} /></TableCell>
            <TableCell><Input type="number" className="h-8 w-20" defaultValue={m.pontos_padrao} onBlur={e => upd(m.id, { pontos_padrao: Number(e.target.value) })} /></TableCell>
            <TableCell><input type="color" defaultValue={m.cor_hex} onBlur={e => upd(m.id, { cor_hex: e.target.value })} /></TableCell>
            <TableCell><Input className="h-8 w-24" defaultValue={m.icone || ''} onBlur={e => upd(m.id, { icone: e.target.value })} /></TableCell>
            <TableCell><Switch checked={m.ativo} onCheckedChange={v => upd(m.id, { ativo: v })} /></TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={async () => { await tbl('premiacao_medalhas').delete().eq('id', m.id); cat.reload(); }}><Trash2 className="w-4 h-4" /></Button></TableCell>
          </TableRow>))}</TableBody></Table>
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Nova medalha</Button>
    </div>
  );
}

export function ServicosTab({ politica, cat }: { politica: Politica; cat: Catalogo }) {
  const upd = async (id: string, patch: any) => { const { error } = await tbl('premiacao_servicos').update(patch).eq('id', id); if (!err(error)) cat.reload(); };
  const add = async () => {
    const prox = String(Math.max(0, ...cat.servicos.map(s => Number(s.codigo) || 0)) + 1).padStart(3, '0');
    const { error } = await tbl('premiacao_servicos').insert({ politica_id: politica.id, codigo: prox, descricao: 'Novo serviço', medalha_id: cat.medalhas[0]?.id || null });
    if (!err(error)) cat.reload();
  };
  return (
    <div className="space-y-2 pt-2">
      <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Gera pontos</TableHead><TableHead>Medalha</TableHead><TableHead>Pontos próprios</TableHead><TableHead>Limite/mês</TableHead><TableHead>Comprovação</TableHead><TableHead>Efetivo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{cat.servicos.map(s => {
          const md = cat.medalhas.find(m => m.id === s.medalha_id);
          return (
            <TableRow key={s.id} className={s.ativo ? '' : 'opacity-50'}>
              <TableCell><Input className="h-8 w-20" defaultValue={s.codigo} onBlur={e => e.target.value !== s.codigo && upd(s.id, { codigo: e.target.value })} /></TableCell>
              <TableCell><Input className="h-8 min-w-56" defaultValue={s.descricao} onBlur={e => e.target.value !== s.descricao && upd(s.id, { descricao: e.target.value })} /></TableCell>
              <TableCell><Switch checked={s.gera_pontos} onCheckedChange={v => upd(s.id, { gera_pontos: v })} /></TableCell>
              <TableCell><Select value={s.medalha_id || ''} onValueChange={v => upd(s.id, { medalha_id: v })} disabled={!s.gera_pontos}><SelectTrigger className="h-8 w-28"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{cat.medalhas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select></TableCell>
              <TableCell><Input type="number" className="h-8 w-20" defaultValue={s.pontos_override ?? ''} onBlur={e => upd(s.id, { pontos_override: num(e.target.value) })} /></TableCell>
              <TableCell><Input type="number" className="h-8 w-20" defaultValue={s.limite_por_competencia ?? ''} onBlur={e => upd(s.id, { limite_por_competencia: num(e.target.value) })} /></TableCell>
              <TableCell><Switch checked={s.exige_comprovacao} onCheckedChange={v => upd(s.id, { exige_comprovacao: v })} /></TableCell>
              <TableCell>{s.gera_pontos
                ? <Badge style={{ backgroundColor: md?.cor_hex, color: '#fff' }}>{efetivoPontos(s, cat.medalhas)} pts</Badge>
                : <Badge variant="outline">Só contagem</Badge>}</TableCell>
              <TableCell className="flex gap-1">
                <Switch checked={s.ativo} onCheckedChange={v => upd(s.id, { ativo: v })} />
                <Button size="icon" variant="ghost" onClick={async () => { if (confirm('Excluir serviço?')) { await tbl('premiacao_servicos').delete().eq('id', s.id); cat.reload(); } }}><Trash2 className="w-4 h-4" /></Button>
              </TableCell>
            </TableRow>);
        })}</TableBody></Table>
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Novo serviço</Button>
    </div>
  );
}

export function DesabonosTab({ politica, cat }: { politica: Politica; cat: Catalogo }) {
  const upd = async (id: string, patch: any) => { const { error } = await tbl('premiacao_desabonos').update(patch).eq('id', id); if (!err(error)) cat.reload(); };
  const add = async () => {
    const prox = String(Math.max(29, ...cat.desabonos.map(s => Number(s.codigo) || 0)) + 1).padStart(3, '0');
    const { error } = await tbl('premiacao_desabonos').insert({ politica_id: politica.id, codigo: prox, descricao: 'Nova ocorrência', pontos: 10 });
    if (!err(error)) cat.reload();
  };
  return (
    <div className="space-y-2 pt-2">
      <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Ocorrência</TableHead><TableHead>Pontos</TableHead><TableHead /><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{cat.desabonos.map(d => (
          <TableRow key={d.id}>
            <TableCell><Input className="h-8 w-20" defaultValue={d.codigo} onBlur={e => e.target.value !== d.codigo && upd(d.id, { codigo: e.target.value })} /></TableCell>
            <TableCell><Input className="h-8 min-w-56" defaultValue={d.descricao} onBlur={e => e.target.value !== d.descricao && upd(d.id, { descricao: e.target.value })} /></TableCell>
            <TableCell><Input type="number" className="h-8 w-20" defaultValue={d.pontos} onBlur={e => upd(d.id, { pontos: Math.abs(Number(e.target.value)) })} /></TableCell>
            <TableCell><Badge variant="destructive">−{d.pontos}</Badge></TableCell>
            <TableCell><Switch checked={d.ativo} onCheckedChange={v => upd(d.id, { ativo: v })} /></TableCell>
            <TableCell><Button size="icon" variant="ghost" onClick={async () => { await tbl('premiacao_desabonos').delete().eq('id', d.id); cat.reload(); }}><Trash2 className="w-4 h-4" /></Button></TableCell>
          </TableRow>))}</TableBody></Table>
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Novo desabono</Button>
    </div>
  );
}
