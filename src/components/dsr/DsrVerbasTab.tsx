import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useVerbasDsr } from '@/hooks/useDsrModule';
import { type VerbaDsr } from '@/types/dsr';

function emptyVerba(): VerbaDsr {
  return {
    id: crypto.randomUUID(),
    codigo: '',
    nome: '',
    tipoLancamento: 'valor_fixo',
    incideDsr: true,
    regraDsr: 'padrao',
    regraDsrCustom: '',
    consideraDomingoDsr: true,
    consideraFeriadoDsr: true,
    observacoes: '',
  };
}

export default function DsrVerbasTab() {
  const { verbas, saveVerba, deleteVerba, loading } = useVerbasDsr();
  const [draft, setDraft] = useState<VerbaDsr>(emptyVerba());

  const handleSave = async () => {
    if (!draft.nome.trim()) {
      toast.error('Informe o nome da verba.');
      return;
    }
    const { error } = await saveVerba(draft);
    if (error) toast.error('Erro ao salvar verba.');
    else {
      toast.success('Verba salva.');
      setDraft(emptyVerba());
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta verba?')) return;
    const { error } = await deleteVerba(id);
    if (error) toast.error('Erro ao excluir.');
    else toast.success('Verba excluída.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Verba</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Código</Label>
              <Input value={draft.codigo} onChange={(e) => setDraft({ ...draft, codigo: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Nome da verba *</Label>
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de lançamento</Label>
              <Select value={draft.tipoLancamento} onValueChange={(v) => setDraft({ ...draft, tipoLancamento: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                  <SelectItem value="qtd_x_valor">Quantidade × Valor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Regra de DSR</Label>
              <Select value={draft.regraDsr} onValueChange={(v) => setDraft({ ...draft, regraDsr: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão: (Base ÷ DU) × Dias DSR</SelectItem>
                  <SelectItem value="custom">Customizada (texto livre)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.regraDsr === 'custom' && (
            <div>
              <Label>Descrição da regra customizada</Label>
              <Input
                value={draft.regraDsrCustom || ''}
                onChange={(e) => setDraft({ ...draft, regraDsrCustom: e.target.value })}
                placeholder="Ex: 1/6 da base do mês"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label>Incide DSR?</Label>
                <p className="text-xs text-muted-foreground">Habilita o cálculo do reflexo</p>
              </div>
              <Switch checked={draft.incideDsr} onCheckedChange={(v) => setDraft({ ...draft, incideDsr: v })} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label>Domingos como DSR</Label>
              </div>
              <Switch checked={draft.consideraDomingoDsr} onCheckedChange={(v) => setDraft({ ...draft, consideraDomingoDsr: v })} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label>Feriados como DSR</Label>
              </div>
              <Switch checked={draft.consideraFeriadoDsr} onCheckedChange={(v) => setDraft({ ...draft, consideraFeriadoDsr: v })} />
            </div>
          </div>

          <div>
            <Label>Observações internas</Label>
            <Textarea
              value={draft.observacoes}
              onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" />Salvar verba</Button>
            <Button variant="outline" onClick={() => setDraft(emptyVerba())}><Plus className="w-4 h-4 mr-1" />Nova</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verbas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : verbas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma verba cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">DSR</TableHead>
                  <TableHead className="text-center">Dom.</TableHead>
                  <TableHead className="text-center">Fer.</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verbas.map((v) => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => setDraft(v)}>
                    <TableCell className="font-mono text-xs">{v.codigo || '—'}</TableCell>
                    <TableCell>{v.nome}</TableCell>
                    <TableCell className="text-xs">{v.tipoLancamento === 'valor_fixo' ? 'Valor fixo' : 'Qtd × Valor'}</TableCell>
                    <TableCell className="text-center">{v.incideDsr ? '✓' : '—'}</TableCell>
                    <TableCell className="text-center">{v.consideraDomingoDsr ? '✓' : '—'}</TableCell>
                    <TableCell className="text-center">{v.consideraFeriadoDsr ? '✓' : '—'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)}>
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