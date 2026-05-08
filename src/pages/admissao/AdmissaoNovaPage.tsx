import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAdmissaoTemplates } from '@/hooks/useAdmissaoTemplates';
import { useAdmissaoRequests } from '@/hooks/useAdmissaoRequests';
import { useClientes } from '@/hooks/useClientes';
import { toast } from 'sonner';

const AdmissaoNovaPage = () => {
  const { templates } = useAdmissaoTemplates();
  const { create } = useAdmissaoRequests();
  const { clientes } = useClientes();
  const nav = useNavigate();

  const [tplId, setTplId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [busy, setBusy] = useState(false);

  const published = templates.filter((t) => t.is_published);

  const onClient = (id: string) => {
    setCompanyId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) {
      setCompanyName(c.nome);
      setCompanyCnpj(c.cnpj || c.cpf || '');
    }
  };

  const submit = async () => {
    if (!tplId) return toast.error('Selecione um formulário');
    if (!companyName.trim()) return toast.error('Informe a empresa');
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setBusy(true);
    const { data, error } = await create({
      template_id: tpl.id,
      template_name_snapshot: tpl.name,
      template_schema_snapshot: tpl.schema_json,
      company_name: companyName.trim(),
      company_cnpj: companyCnpj.trim(),
      employee_name: employeeName.trim(),
    });
    setBusy(false);
    if (error || !data) return toast.error('Erro ao criar');
    toast.success('Admissão criada');
    nav(`/admissao/escritorio/admissoes/${data.id}`);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admissao/escritorio"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
      </Button>
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Nova admissão</h2>

        <div>
          <Label>Formulário</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger><SelectValue placeholder="Selecione um formulário publicado..." /></SelectTrigger>
            <SelectContent>
              {published.length === 0 && <SelectItem value="__none" disabled>Nenhum formulário publicado</SelectItem>}
              {published.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Empresa (cliente)</Label>
          <Select value={companyId} onValueChange={onClient}>
            <SelectTrigger><SelectValue placeholder="Selecionar cliente cadastrado..." /></SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Razão social / nome</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div>
            <Label>CNPJ / CPF</Label>
            <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Nome do colaborador (opcional)</Label>
          <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Será preenchido pelo cliente se vazio" />
        </div>

        <Button onClick={submit} disabled={busy} className="w-full">
          {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Criar e gerar link
        </Button>
      </Card>
    </div>
  );
};

export default AdmissaoNovaPage;