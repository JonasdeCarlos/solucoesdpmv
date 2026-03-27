import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Info, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';
import { calcularDataPagamentoSugerida, formatCompetencia } from '@/utils/rescisaoDateUtils';
import { useClientes } from '@/hooks/useClientes';
import { type Client, createEmptyClient } from '@/types/client';

interface CapaData {
  employeeName: string;
  terminationDate: string;
  paymentDateSuggested: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
}

interface Props {
  data: CapaData;
  onChange: (data: CapaData) => void;
  onNext: () => void;
}

const RescisaoStep1Capa: React.FC<Props> = ({ data, onChange, onNext }) => {
  const { clientes, saveCliente } = useClientes();
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState<Client>(createEmptyClient());

  const update = (key: keyof CapaData, value: string) => {
    onChange({ ...data, [key]: value });
  };

  // Track se o usuário editou manualmente a data de pagamento
  const [manualPayment, setManualPayment] = useState(false);

  useEffect(() => {
    if (data.terminationDate) {
      const dt = new Date(data.terminationDate + 'T12:00:00');
      if (!isNaN(dt.getTime())) {
        const suggested = calcularDataPagamentoSugerida(dt);
        const sugStr = format(suggested, 'yyyy-MM-dd');
        const comp = formatCompetencia(dt);
        onChange({
          ...data,
          paymentDateSuggested: sugStr,
          paymentDateFinal: manualPayment ? data.paymentDateFinal : sugStr,
          competenceMonth: comp,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.terminationDate]);

  const handleSelectClient = (clientId: string) => {
    if (clientId === '__new__') {
      setNewClient(createEmptyClient());
      setShowNewClient(true);
      return;
    }
    const c = clientes.find(cl => cl.id === clientId);
    if (c) {
      onChange({
        ...data,
        companyName: c.nome,
        companyCnpj: c.tipo === 'PJ' ? c.cnpj : c.cpf,
      });
    }
  };

  const handleSaveNewClient = async () => {
    if (!newClient.nome.trim()) return;
    const { error } = await saveCliente(newClient);
    if (!error) {
      onChange({
        ...data,
        companyName: newClient.nome,
        companyCnpj: newClient.tipo === 'PJ' ? newClient.cnpj : newClient.cpf,
      });
      setShowNewClient(false);
    }
  };

  const pjClientes = clientes.filter(c => c.tipo === 'PJ');
  const pfClientes = clientes.filter(c => c.tipo === 'PF');

  const isValid = data.employeeName.trim() && data.terminationDate && data.paymentDateFinal;

  return (
    <div className="space-y-6">
      {/* Cliente/Empresa selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Users className="h-4 w-4" /> Selecionar Cliente/Empresa
        </Label>
        <div className="flex gap-2">
          <Select onValueChange={handleSelectClient}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Escolha um cliente cadastrado ou crie novo" />
            </SelectTrigger>
            <SelectContent>
              {pjClientes.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Pessoa Jurídica</div>
                  {pjClientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.cnpj ? `— ${c.cnpj}` : ''}
                    </SelectItem>
                  ))}
                </>
              )}
              {pfClientes.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Pessoa Física</div>
                  {pfClientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.cpf ? `— ${c.cpf}` : ''}
                    </SelectItem>
                  ))}
                </>
              )}
              <SelectItem value="__new__">
                <span className="flex items-center gap-1 text-primary font-medium">
                  <Plus className="h-3 w-3" /> Cadastrar novo cliente
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Nome do Empregado *</Label>
          <Input
            value={data.employeeName}
            onChange={(e) => update('employeeName', e.target.value)}
            placeholder="Nome completo"
          />
        </div>

        <div className="space-y-2">
          <Label>Data da Rescisão *</Label>
          <Input
            type="date"
            value={data.terminationDate}
            onChange={(e) => update('terminationDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Data de Pagamento *</Label>
          <Input
            type="date"
            value={data.paymentDateFinal}
            onChange={(e) => update('paymentDateFinal', e.target.value)}
          />
          {data.paymentDateSuggested && (
            <p className="text-xs text-muted-foreground">
              Data sugerida: {format(new Date(data.paymentDateSuggested + 'T12:00:00'), 'dd/MM/yyyy')} — art. 477, §6º CLT
            </p>
          )}
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Sugestão baseada no art. 477, §6º da CLT (10 dias corridos). Confirme conforme a situação e regras aplicáveis.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Empresa</Label>
          <Input
            value={data.companyName}
            onChange={(e) => update('companyName', e.target.value)}
            placeholder="Razão social"
          />
        </div>
        <div className="space-y-2">
          <Label>CNPJ / CPF</Label>
          <Input
            value={data.companyCnpj}
            onChange={(e) => update('companyCnpj', e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>Competência</Label>
          <Input value={data.competenceMonth} readOnly className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Conferido por</Label>
          <Input
            value={data.checkedBy}
            onChange={(e) => update('checkedBy', e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isValid}>
          Próximo: Upload de Documentos
        </Button>
      </div>

      {/* Dialog novo cliente */}
      <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newClient.tipo} onValueChange={(v) => setNewClient({ ...newClient, tipo: v as 'PF' | 'PJ' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome / Razão Social *</Label>
              <Input value={newClient.nome} onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })} />
            </div>
            {newClient.tipo === 'PJ' ? (
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={newClient.cpf} onChange={(e) => setNewClient({ ...newClient, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={newClient.endereco} onChange={(e) => setNewClient({ ...newClient, endereco: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClient(false)}>Cancelar</Button>
            <Button onClick={handleSaveNewClient} disabled={!newClient.nome.trim()}>Salvar e Usar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RescisaoStep1Capa;
