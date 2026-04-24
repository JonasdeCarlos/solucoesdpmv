import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { useProvisionEntries, useVerbasDsr } from '@/hooks/useDsrModule';
import { useEmpregados } from '@/hooks/useEmpregados';
import { type ProvisionEntry } from '@/types/dsr';
import { baseDoLancamento } from '@/utils/dsrCalculations';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function emptyEntry(empresa: string, comp: string): ProvisionEntry {
  return {
    id: crypto.randomUUID(),
    empresaNome: empresa,
    competencia: comp,
    centroCusto: '',
    colaborador: '',
    verbaId: '',
    tipoLancamento: 'valor_fixo',
    valor: 0,
    quantidade: 0,
    valorUnitario: 0,
    observacao: '',
  };
}

interface Props {
  empresa: string;
  setEmpresa: (v: string) => void;
  competencia: string;
  setCompetencia: (v: string) => void;
}

export default function DsrEntriesTab({ empresa, setEmpresa, competencia, setCompetencia }: Props) {
  const { verbas } = useVerbasDsr();
  const { entries, saveEntry, deleteEntry } = useProvisionEntries(empresa, competencia);
  const { empregados } = useEmpregados();
  const [draft, setDraft] = useState<ProvisionEntry>(emptyEntry(empresa, competencia));
  const [mesesAlvo, setMesesAlvo] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replicarEdicao, setReplicarEdicao] = useState(false);

  // ── Lançamento em massa (todos colaboradores × meses) ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkVerbaId, setBulkVerbaId] = useState('');
  const [bulkValor, setBulkValor] = useState<number>(0);
  const [bulkQtd, setBulkQtd] = useState<number>(0);
  const [bulkUnit, setBulkUnit] = useState<number>(0);
  const [bulkObs, setBulkObs] = useState('');
  const [bulkCC, setBulkCC] = useState('');
  const [bulkColaboradores, setBulkColaboradores] = useState<string[]>([]);
  const [bulkMeses, setBulkMeses] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const ano = competencia ? Number(competencia.split('-')[0]) : new Date().getFullYear();
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const empregadosEmpresa = empregados.filter(
    (e) => !empresa || e.empresaNome.trim().toUpperCase() === empresa.trim().toUpperCase(),
  );

  const bulkVerba = verbas.find((v) => v.id === bulkVerbaId);
  const bulkTipo = bulkVerba?.tipoLancamento || 'valor_fixo';
  const bulkBase = bulkTipo === 'valor_fixo' ? bulkValor : bulkQtd * bulkUnit;
  const bulkTotalLancamentos = bulkColaboradores.length * bulkMeses.length;

  const toggleBulkColab = (nome: string) => {
    setBulkColaboradores((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome],
    );
  };
  const toggleBulkMes = (m: number) => {
    setBulkMeses((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a,b)=>a-b));
  };
  const selecionarTodosColabs = () => setBulkColaboradores(empregadosEmpresa.map((e) => e.nome));
  const limparColabs = () => setBulkColaboradores([]);

  const handleBulkSave = async () => {
    if (!empresa) return toast.error('Informe a empresa nos filtros.');
    if (!bulkVerbaId) return toast.error('Selecione uma verba.');
    if (bulkColaboradores.length === 0) return toast.error('Selecione ao menos um colaborador.');
    if (bulkMeses.length === 0) return toast.error('Selecione ao menos um mês.');
    if (bulkBase <= 0) return toast.error('Informe um valor positivo.');

    setBulkSaving(true);
    let ok = 0, fail = 0;
    for (const colab of bulkColaboradores) {
      for (const m of bulkMeses) {
        const comp = `${ano}-${String(m).padStart(2, '0')}`;
        const row: ProvisionEntry = {
          id: crypto.randomUUID(),
          empresaNome: empresa,
          competencia: comp,
          centroCusto: bulkCC,
          colaborador: colab,
          verbaId: bulkVerbaId,
          tipoLancamento: bulkTipo,
          valor: bulkTipo === 'valor_fixo' ? bulkValor : 0,
          quantidade: bulkTipo === 'valor_fixo' ? 0 : bulkQtd,
          valorUnitario: bulkTipo === 'valor_fixo' ? 0 : bulkUnit,
          observacao: bulkObs,
        };
        const { error } = await saveEntry(row);
        if (error) fail++; else ok++;
      }
    }
    setBulkSaving(false);
    if (fail) toast.error(`${fail} lançamentos falharam.`);
    if (ok) toast.success(`${ok} lançamentos criados (${bulkColaboradores.length} colaborador(es) × ${bulkMeses.length} mês(es)).`);
    setBulkOpen(false);
    // Reset parcial
    setBulkValor(0); setBulkQtd(0); setBulkUnit(0); setBulkObs('');
  };

  // Sincroniza draft com filtros
  if (!editingId && (draft.empresaNome !== empresa || draft.competencia !== competencia)) {
    setDraft({ ...draft, empresaNome: empresa, competencia });
  }

  const toggleMes = (m: number) => {
    setMesesAlvo((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a,b)=>a-b));
  };
  const selecionarAnoTodo = () => setMesesAlvo([1,2,3,4,5,6,7,8,9,10,11,12]);
  const limparSelecao = () => setMesesAlvo([]);

  const cancelEdit = () => {
    setEditingId(null);
    setReplicarEdicao(false);
    setMesesAlvo([]);
    setDraft(emptyEntry(empresa, competencia));
  };

  const startEdit = (e: ProvisionEntry) => {
    setEditingId(e.id);
    setDraft({ ...e });
    setReplicarEdicao(false);
    setMesesAlvo([]);
    // Scroll para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!competencia) return toast.error('Informe a competência (AAAA-MM).');
    if (!draft.verbaId) return toast.error('Selecione uma verba.');
    const verba = verbas.find((v) => v.id === draft.verbaId);
    const tipo = verba?.tipoLancamento || 'valor_fixo';
    const final: ProvisionEntry = { ...draft, tipoLancamento: tipo };
    if (baseDoLancamento(final) <= 0) {
      return toast.error('Informe um valor (ou quantidade × valor unitário) positivo.');
    }

    // ── Modo edição ──
    if (editingId) {
      // 1) Atualiza o lançamento atual (mantém id)
      const { error: errUpd } = await saveEntry({ ...final, id: editingId });
      if (errUpd) {
        return toast.error('Falha ao atualizar lançamento.');
      }

      // 2) Se marcado replicar, cria novos lançamentos nos demais meses do ano
      if (replicarEdicao) {
        const mesAtual = Number(final.competencia.split('-')[1]);
        const alvos = (mesesAlvo.length > 0 ? mesesAlvo : [1,2,3,4,5,6,7,8,9,10,11,12])
          .filter((m) => m !== mesAtual);
        let ok = 0, fail = 0;
        for (const m of alvos) {
          const comp = `${ano}-${String(m).padStart(2, '0')}`;
          const row: ProvisionEntry = { ...final, id: crypto.randomUUID(), competencia: comp };
          const { error } = await saveEntry(row);
          if (error) fail++; else ok++;
        }
        if (fail) toast.error(`${fail} replicações falharam.`);
        if (ok) toast.success(`Lançamento atualizado e replicado em ${ok} mês(es).`);
        else toast.success('Lançamento atualizado.');
      } else {
        toast.success('Lançamento atualizado.');
      }

      cancelEdit();
      return;
    }

    // Define lista de competências alvo
    const competenciasAlvo = mesesAlvo.length > 0
      ? mesesAlvo.map((m) => `${ano}-${String(m).padStart(2, '0')}`)
      : [competencia];

    let ok = 0;
    let fail = 0;
    for (const comp of competenciasAlvo) {
      const row: ProvisionEntry = { ...final, id: crypto.randomUUID(), competencia: comp };
      const { error } = await saveEntry(row);
      if (error) fail++;
      else ok++;
    }
    if (fail) toast.error(`${fail} lançamentos falharam.`);
    if (ok) toast.success(competenciasAlvo.length > 1
      ? `${ok} lançamentos criados (${competenciasAlvo.length} meses).`
      : 'Lançamento salvo.');
    setDraft(emptyEntry(empresa, competencia));
    setMesesAlvo([]);
  };

  const verbaSelecionada = verbas.find((v) => v.id === draft.verbaId);
  const tipoEntrada = verbaSelecionada?.tipoLancamento || 'valor_fixo';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Empresa</Label>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div>
              <Label>Competência (AAAA-MM)</Label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-base">Lançamento em massa</Label>
                <p className="text-xs text-muted-foreground">
                  Crie o mesmo lançamento para vários colaboradores em múltiplos meses de {ano}.
                </p>
              </div>
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!empresa}>
                    <Users className="w-4 h-4 mr-1" />
                    Lançar para colaboradores no ano todo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Lançamento em massa — {empresa || '(empresa não definida)'} · {ano}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Label>Verba</Label>
                        <Select value={bulkVerbaId} onValueChange={setBulkVerbaId}>
                          <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                          <SelectContent>
                            {verbas.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.codigo ? `${v.codigo} — ` : ''}{v.nome}{v.incideDsr ? ' (DSR)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Centro de custo</Label>
                        <Input value={bulkCC} onChange={(e) => setBulkCC(e.target.value)} />
                      </div>
                    </div>

                    {bulkTipo === 'valor_fixo' ? (
                      <div className="md:max-w-xs">
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number" step="0.01"
                          value={bulkValor || ''}
                          onChange={(e) => setBulkValor(Number(e.target.value) || 0)}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Quantidade</Label>
                          <Input type="number" step="0.01" value={bulkQtd || ''}
                            onChange={(e) => setBulkQtd(Number(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label>Valor unitário (R$)</Label>
                          <Input type="number" step="0.01" value={bulkUnit || ''}
                            onChange={(e) => setBulkUnit(Number(e.target.value) || 0)} />
                        </div>
                        <div className="flex items-end">
                          <p className="text-sm">Total: <strong>{fmtBRL(bulkBase)}</strong></p>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Observação</Label>
                      <Input value={bulkObs} onChange={(e) => setBulkObs(e.target.value)} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Colaboradores ({empregadosEmpresa.length} cadastrado(s))</Label>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={selecionarTodosColabs}>Todos</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={limparColabs}>Limpar</Button>
                        </div>
                      </div>
                      {empregadosEmpresa.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Nenhum colaborador cadastrado para esta empresa. Cadastre em "Empregados".
                        </p>
                      ) : (
                        <ScrollArea className="h-40 border rounded p-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                            {empregadosEmpresa.map((emp) => {
                              const checked = bulkColaboradores.includes(emp.nome);
                              return (
                                <label key={emp.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer ${checked ? 'bg-primary/10' : ''}`}>
                                  <Checkbox checked={checked} onCheckedChange={() => toggleBulkColab(emp.nome)} />
                                  <span>{emp.nome}{emp.funcao ? ` · ${emp.funcao}` : ''}</span>
                                </label>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Meses de {ano}</Label>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline"
                            onClick={() => setBulkMeses([1,2,3,4,5,6,7,8,9,10,11,12])}>Ano todo</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setBulkMeses([])}>Limpar</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-12 gap-2">
                        {mesesNomes.map((nome, idx) => {
                          const m = idx + 1;
                          const checked = bulkMeses.includes(m);
                          return (
                            <label key={m}
                              className={`flex items-center gap-1 text-xs px-2 py-1 border rounded cursor-pointer ${checked ? 'bg-primary/10 border-primary/40' : ''}`}>
                              <Checkbox checked={checked} onCheckedChange={() => toggleBulkMes(m)} />
                              <span>{nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {bulkTotalLancamentos > 0 && (
                      <div className="text-sm p-3 bg-muted/40 rounded">
                        Serão criados <strong>{bulkTotalLancamentos}</strong> lançamento(s):{' '}
                        {bulkColaboradores.length} colaborador(es) × {bulkMeses.length} mês(es) ·{' '}
                        valor unitário <strong>{fmtBRL(bulkBase)}</strong> ·{' '}
                        total geral <strong>{fmtBRL(bulkBase * bulkTotalLancamentos)}</strong>.
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancelar</Button>
                    <Button onClick={handleBulkSave} disabled={bulkSaving}>
                      <Save className="w-4 h-4 mr-1" />
                      {bulkSaving ? 'Salvando…' : `Criar ${bulkTotalLancamentos || ''} lançamento(s)`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {!empresa && (
              <p className="text-xs text-destructive mt-2">
                Informe o nome da empresa acima para habilitar o lançamento em massa.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Verba</Label>
              <Select value={draft.verbaId} onValueChange={(v) => setDraft({ ...draft, verbaId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {verbas.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.codigo ? `${v.codigo} — ` : ''}{v.nome}{v.incideDsr ? ' (DSR)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Centro de custo / Obra</Label>
              <Input value={draft.centroCusto} onChange={(e) => setDraft({ ...draft, centroCusto: e.target.value })} />
            </div>
            <div>
              <Label>Colaborador (opcional)</Label>
              <Input value={draft.colaborador} onChange={(e) => setDraft({ ...draft, colaborador: e.target.value })} />
            </div>
          </div>

          {tipoEntrada === 'valor_fixo' ? (
            <div className="md:max-w-xs">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.valor || ''}
                onChange={(e) => setDraft({ ...draft, valor: Number(e.target.value) || 0 })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.quantidade || ''}
                  onChange={(e) => setDraft({ ...draft, quantidade: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Valor unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.valorUnitario || ''}
                  onChange={(e) => setDraft({ ...draft, valorUnitario: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-end">
                <p className="text-sm">
                  Total: <strong>{fmtBRL((draft.quantidade || 0) * (draft.valorUnitario || 0))}</strong>
                </p>
              </div>
            </div>
          )}

          <div>
            <Label>Observação</Label>
            <Input value={draft.observacao} onChange={(e) => setDraft({ ...draft, observacao: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              {editingId ? 'Salvar alterações' : 'Adicionar'}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-1" />Cancelar edição
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setDraft(emptyEntry(empresa, competencia))}>
                <Plus className="w-4 h-4 mr-1" />Limpar
              </Button>
            )}
          </div>

          <div className="border-t pt-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <Label>
                {editingId
                  ? `Também aplicar este valor em outros meses de ${ano}`
                  : `Replicar para múltiplos meses de ${ano}`}
              </Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selecionarAnoTodo}>Ano todo</Button>
                <Button type="button" size="sm" variant="ghost" onClick={limparSelecao}>Limpar seleção</Button>
              </div>
            </div>
            {editingId ? (
              <div className="space-y-2 mb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={replicarEdicao}
                    onCheckedChange={(v) => setReplicarEdicao(!!v)}
                  />
                  <span>Replicar este lançamento para os meses marcados (ou ano todo).</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  A competência editada ({draft.competencia}) é sempre atualizada. Os demais meses
                  marcados receberão um <strong>novo lançamento</strong> com o mesmo valor.
                  Se marcar "Ano todo" sem selecionar meses, replica para todos os 12 meses de {ano}.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">
                Se nenhum mês for marcado, o lançamento é criado apenas na competência atual ({competencia || '—'}).
                Marque um ou mais meses para replicar o mesmo valor em cada competência.
              </p>
            )}
            <div className="grid grid-cols-4 md:grid-cols-12 gap-2">
              {mesesNomes.map((nome, idx) => {
                const m = idx + 1;
                const checked = mesesAlvo.includes(m);
                return (
                  <label
                    key={m}
                    className={`flex items-center gap-1 text-xs px-2 py-1 border rounded cursor-pointer ${checked ? 'bg-primary/10 border-primary/40' : ''} ${editingId && !replicarEdicao ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!!editingId && !replicarEdicao}
                      onCheckedChange={() => toggleMes(m)}
                    />
                    <span>{nome}</span>
                  </label>
                );
              })}
            </div>
            {mesesAlvo.length > 0 && (!editingId || replicarEdicao) && (
              <p className="text-xs mt-2">
                {editingId
                  ? <>Replicar em <strong>{mesesAlvo.length}</strong> mês(es) marcado(s) de {ano} (além da competência editada).</>
                  : <>Será criado <strong>1 lançamento por mês</strong> em <strong>{mesesAlvo.length}</strong> competência(s) de {ano}.</>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos da competência {competencia || '—'}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verba</TableHead>
                  <TableHead>CC / Obra</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const v = verbas.find((x) => x.id === e.verbaId);
                  return (
                    <TableRow key={e.id} className={editingId === e.id ? 'bg-primary/5' : ''}>
                      <TableCell>{v?.nome || '—'}</TableCell>
                      <TableCell>{e.centroCusto || '—'}</TableCell>
                      <TableCell>{e.colaborador || '—'}</TableCell>
                      <TableCell className="text-right">{fmtBRL(baseDoLancamento(e))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(e)} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEntry(e.id)} title="Excluir">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}