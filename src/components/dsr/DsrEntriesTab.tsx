import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useProvisionEntries, useVerbasDsr } from '@/hooks/useDsrModule';
import { type ProvisionEntry } from '@/types/dsr';
import { baseDoLancamento } from '@/utils/dsrCalculations';

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
  const [draft, setDraft] = useState<ProvisionEntry>(emptyEntry(empresa, competencia));

  // Sincroniza draft com filtros
  if (draft.empresaNome !== empresa || draft.competencia !== competencia) {
    setDraft({ ...draft, empresaNome: empresa, competencia });
  }

  const handleSave = async () => {
    if (!competencia) return toast.error('Informe a competência (AAAA-MM).');
    if (!draft.verbaId) return toast.error('Selecione uma verba.');
    const verba = verbas.find((v) => v.id === draft.verbaId);
    const tipo = verba?.tipoLancamento || 'valor_fixo';
    const final: ProvisionEntry = { ...draft, tipoLancamento: tipo };
    if (baseDoLancamento(final) <= 0) {
      return toast.error('Informe um valor (ou quantidade × valor unitário) positivo.');
    }
    const { error } = await saveEntry(final);
    if (error) toast.error('Erro ao salvar.');
    else {
      toast.success('Lançamento salvo.');
      setDraft(emptyEntry(empresa, competencia));
    }
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo lançamento</CardTitle>
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
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" />Adicionar</Button>
            <Button variant="outline" onClick={() => setDraft(emptyEntry(empresa, competencia))}><Plus className="w-4 h-4 mr-1" />Limpar</Button>
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
                    <TableRow key={e.id}>
                      <TableCell>{v?.nome || '—'}</TableCell>
                      <TableCell>{e.centroCusto || '—'}</TableCell>
                      <TableCell>{e.colaborador || '—'}</TableCell>
                      <TableCell className="text-right">{fmtBRL(baseDoLancamento(e))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => deleteEntry(e.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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