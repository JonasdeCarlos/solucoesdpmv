import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useVerbas } from '@/hooks/useVerbas';
import { type Verba, type TipoCalculo, createEmptyVerba, TIPO_CALCULO_LABELS } from '@/types/verba';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const VerbasPage = () => {
  const { verbas, loading, saveVerba, deleteVerba } = useVerbas();
  const [editing, setEditing] = useState<Verba | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast({ title: 'Nome da verba é obrigatório', variant: 'destructive' });
      return;
    }
    const { error } = await saveVerba(editing);
    if (error) {
      toast({ title: 'Erro ao salvar verba', variant: 'destructive' });
      return;
    }
    setDialogOpen(false);
    setEditing(null);
    toast({ title: 'Verba salva com sucesso!' });
  };

  const handleDelete = async (id: string) => {
    await deleteVerba(id);
    toast({ title: 'Verba excluída.' });
  };

  const openNew = () => {
    setEditing(createEmptyVerba());
    setDialogOpen(true);
  };

  const openEdit = (verba: Verba) => {
    setEditing({ ...verba });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cadastro de Verbas</h2>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Verba
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="results-table-header">
                <TableHead className="text-card">Descrição</TableHead>
                <TableHead className="text-card">Tipo Cálculo</TableHead>
                <TableHead className="text-card">P/D</TableHead>
                <TableHead className="text-card">FGTS</TableHead>
                <TableHead className="text-card">DSR</TableHead>
                <TableHead className="text-card w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : verbas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma verba cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                verbas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.nome}</TableCell>
                    <TableCell>{TIPO_CALCULO_LABELS[v.tipoCalculo]}</TableCell>
                    <TableCell>
                      <Badge variant={v.padraoPD === 'P' ? 'default' : 'destructive'}>
                        {v.padraoPD}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.incideFGTS ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {v.calculaDSR ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.nome ? 'Editar Verba' : 'Nova Verba'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Ex: Salário, Hora Extra 50%, DSR..."
                />
              </div>

              <div>
                <Label>Tipo de Cálculo</Label>
                <Select
                  value={editing.tipoCalculo}
                  onValueChange={(v) => setEditing({ ...editing, tipoCalculo: v as TipoCalculo })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_CALCULO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Referência padrão (opcional)</Label>
                <Input
                  value={editing.referenciaPadrao}
                  onChange={(e) => setEditing({ ...editing, referenciaPadrao: e.target.value })}
                  placeholder="Ex: 30, 8%, etc."
                />
              </div>

              <div>
                <Label>Padrão P/D</Label>
                <RadioGroup
                  value={editing.padraoPD}
                  onValueChange={(v) => setEditing({ ...editing, padraoPD: v as 'P' | 'D' })}
                  className="flex gap-4 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="P" id="pd-p" />
                    <Label htmlFor="pd-p">Provento (P)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="D" id="pd-d" />
                    <Label htmlFor="pd-d">Desconto (D)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="incide-fgts">Incide FGTS?</Label>
                <Switch
                  id="incide-fgts"
                  checked={editing.incideFGTS}
                  onCheckedChange={(v) => setEditing({ ...editing, incideFGTS: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="calcula-dsr">Calcula DSR?</Label>
                <Switch
                  id="calcula-dsr"
                  checked={editing.calculaDSR}
                  onCheckedChange={(v) => setEditing({ ...editing, calculaDSR: v })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerbasPage;
