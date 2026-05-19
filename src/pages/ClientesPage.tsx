import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClientes } from '@/hooks/useClientes';
import { type Client, createEmptyClient } from '@/types/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'clientes_draft_state_v1';

function loadPersistedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { editing?: Client | null; dialogOpen?: boolean } : null;
  } catch {
    return null;
  }
}

const ClientesPage = () => {
  const { clientes, loading, saveCliente, deleteCliente } = useClientes();
  const persisted = loadPersistedDraft();
  const [editing, setEditing] = useState<Client | null>(persisted?.editing ?? null);
  const [dialogOpen, setDialogOpen] = useState(persisted?.dialogOpen ?? false);
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editing, dialogOpen }));
  }, [editing, dialogOpen]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    const { error } = await saveCliente(editing);
    if (error) {
      toast({ title: 'Erro ao salvar cliente', variant: 'destructive' });
      return;
    }
    setDialogOpen(false);
    setEditing(null);
    toast({ title: 'Cliente salvo com sucesso!' });
  };

  const handleDelete = async (id: string) => {
    await deleteCliente(id);
    toast({ title: 'Cliente excluído.' });
  };

  const openNew = () => {
    setEditing(createEmptyClient());
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing({ ...client });
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cadastro de Clientes</h2>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Cliente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="results-table-header">
                <TableHead className="text-card">Nome / Razão Social</TableHead>
                <TableHead className="text-card">Tipo</TableHead>
                <TableHead className="text-card">CPF / CNPJ</TableHead>
                <TableHead className="text-card w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum cliente cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.tipo}</TableCell>
                    <TableCell>{c.tipo === 'PJ' ? c.cnpj : c.cpf}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.nome ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Nome completo ou razão social"
                />
              </div>

              <div>
                <Label>Tipo</Label>
                <RadioGroup
                  value={editing.tipo}
                  onValueChange={(v) => setEditing({ ...editing, tipo: v as 'PF' | 'PJ', cpf: '', cnpj: '' })}
                  className="flex gap-4 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PF" id="tipo-pf" />
                    <Label htmlFor="tipo-pf">Pessoa Física</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PJ" id="tipo-pj" />
                    <Label htmlFor="tipo-pj">Pessoa Jurídica</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>{editing.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                <Input
                  value={editing.tipo === 'PJ' ? editing.cnpj : editing.cpf}
                  onChange={(e) =>
                    editing.tipo === 'PJ'
                      ? setEditing({ ...editing, cnpj: e.target.value })
                      : setEditing({ ...editing, cpf: e.target.value })
                  }
                  placeholder={editing.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                />
              </div>

              <div>
                <Label>Endereço (opcional)</Label>
                <Input
                  value={editing.endereco}
                  onChange={(e) => setEditing({ ...editing, endereco: e.target.value })}
                  placeholder="Rua, número, cidade/UF"
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

export default ClientesPage;
