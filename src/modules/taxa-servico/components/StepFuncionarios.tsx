import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import ImportarExtratoDialog from './ImportarExtratoDialog';
import { tsDb, upsertFuncionarios, type TsFuncionario } from '../hooks/useTaxaServico';

interface Props { empresaId: string; funcionarios: TsFuncionario[]; reload: () => Promise<void>; onBack: () => void; onNext: () => void }

export default function StepFuncionarios({ empresaId, funcionarios, reload, onBack, onNext }: Props) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [imp, setImp] = useState(false);

  const add = async () => {
    if (!/^\d{1,10}$/.test(codigo) || !nome.trim()) return toast.error('Informe código (até 10 dígitos) e nome.');
    const { error } = await upsertFuncionarios(empresaId, [{ codigo, nome: nome.trim() }]);
    if (error) return toast.error(error.message);
    setCodigo(''); setNome(''); await reload();
  };
  const patch = async (id: string, p: Partial<TsFuncionario>) => { await tsDb.from('ts_funcionarios').update(p).eq('id', id); await reload(); };
  const del = async (id: string) => {
    const { error } = await tsDb.from('ts_funcionarios').delete().eq('id', id);
    if (error) toast.error('Não foi possível excluir (possui lançamentos). Desative-o.');
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <Input className="w-32" placeholder="Código" maxLength={10} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
        <Input className="flex-1 min-w-[200px]" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        <Button variant="outline" onClick={() => setImp(true)}><FileUp className="w-4 h-4 mr-1" />Importar extrato</Button>
      </div>
      <div className="border rounded-md max-h-[50vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left w-28">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 w-20">Ativo</th><th className="w-10" /></tr></thead>
          <tbody>
            {funcionarios.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-2">{f.codigo}</td>
                <td className="p-1"><Input defaultValue={f.nome} onBlur={(e) => e.target.value !== f.nome && patch(f.id, { nome: e.target.value })} /></td>
                <td className="p-2 text-center"><Switch checked={f.ativo} onCheckedChange={(v) => patch(f.id, { ativo: v })} /></td>
                <td><Button size="icon" variant="ghost" onClick={() => del(f.id)}><Trash2 className="w-4 h-4" /></Button></td>
              </tr>
            ))}
            {!funcionarios.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum funcionário.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button disabled={!funcionarios.some((f) => f.ativo)} onClick={onNext}>Avançar</Button>
      </div>
      <ImportarExtratoDialog open={imp} onOpenChange={setImp} empresaId={empresaId} onConfirm={async (rows) => {
        const valid = rows.filter((r) => /^\d{1,10}$/.test(r.codigo)).map((r) => ({ codigo: r.codigo, nome: r.nome || `Funcionário ${r.codigo}` }));
        const { error } = await upsertFuncionarios(empresaId, valid);
        if (error) return void toast.error(error.message);
        toast.success(`${valid.length} funcionário(s) gravado(s)`);
        await reload();
      }} />
    </div>
  );
}
