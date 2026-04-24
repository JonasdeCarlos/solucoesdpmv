import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFeriadosExtendidos } from '@/hooks/useDsrModule';
import { feriadosNacionaisDoAno } from '@/utils/dsrCalculations';
import { type FeriadoExtendido } from '@/types/dsr';

function emptyFeriado(): Omit<FeriadoExtendido, 'id'> {
  return {
    data: '',
    nome: '',
    municipio: '',
    uf: '',
    escopo: 'municipal',
    contaDiaNaoUtil: true,
    contaDsr: true,
  };
}

export default function DsrCalendarTab() {
  const { feriados, overrides, addFeriado, deleteFeriado, setOverrideNacional } = useFeriadosExtendidos();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [draft, setDraft] = useState<Omit<FeriadoExtendido, 'id'>>(emptyFeriado());

  const nacionais = useMemo(() => feriadosNacionaisDoAno(ano), [ano]);
  const overrideMap = useMemo(
    () => new Map(overrides.filter((o) => o.ano === ano).map((o) => [o.chave, o.pontoFacultativo])),
    [overrides, ano],
  );

  const handleAdd = async () => {
    if (!draft.data || !draft.nome.trim()) {
      toast.error('Preencha data e nome.');
      return;
    }
    const { error } = await addFeriado(draft);
    if (error) toast.error('Erro ao adicionar.');
    else {
      toast.success('Feriado cadastrado.');
      setDraft(emptyFeriado());
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir feriado?')) return;
    await deleteFeriado(id);
    toast.success('Excluído.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feriados Nacionais ({ano})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Label>Ano:</Label>
            <Input
              type="number"
              className="w-28"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())}
            />
            <p className="text-xs text-muted-foreground ml-2">
              Marque como “ponto facultativo” para excluir do cálculo.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Feriado</TableHead>
                <TableHead className="text-center">Ponto facultativo?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nacionais.map((f) => {
                const isFac = !!overrideMap.get(f.chave);
                return (
                  <TableRow key={f.chave}>
                    <TableCell className="font-mono text-xs">{f.data.split('-').reverse().join('/')}</TableCell>
                    <TableCell>{f.nome}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isFac}
                        onCheckedChange={async (v) => {
                          await setOverrideNacional(ano, f.chave, v);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar feriado municipal/estadual/interno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Nome do feriado</Label>
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={draft.escopo} onValueChange={(v) => setDraft({ ...draft, escopo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="estadual">Estadual</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Município</Label>
              <Input value={draft.municipio} onChange={(e) => setDraft({ ...draft, municipio: e.target.value })} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={draft.uf} onChange={(e) => setDraft({ ...draft, uf: e.target.value.toUpperCase() })} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label>Conta como dia não útil</Label>
              <Switch checked={draft.contaDiaNaoUtil} onCheckedChange={(v) => setDraft({ ...draft, contaDiaNaoUtil: v })} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label>Conta como DSR</Label>
              <Switch checked={draft.contaDsr} onCheckedChange={(v) => setDraft({ ...draft, contaDsr: v })} />
            </div>
          </div>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feriados cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {feriados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum feriado adicional.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Município/UF</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead className="text-center">Não útil</TableHead>
                  <TableHead className="text-center">DSR</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feriados.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.data.split('-').reverse().join('/')}</TableCell>
                    <TableCell>{f.nome}</TableCell>
                    <TableCell>{f.municipio}{f.uf ? `/${f.uf}` : ''}</TableCell>
                    <TableCell className="capitalize">{f.escopo}</TableCell>
                    <TableCell className="text-center">{f.contaDiaNaoUtil ? '✓' : '—'}</TableCell>
                    <TableCell className="text-center">{f.contaDsr ? '✓' : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}