import { useMemo, useState } from 'react';
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
  const [ordem, setOrdem] = useState<'nome' | 'codigo'>('nome');

  const lista = useMemo(() => [...funcionarios].sort((a, b) =>
    ordem === 'codigo' ? Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo) : a.nome.localeCompare(b.nome, 'pt-BR')), [funcionarios, ordem]);

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

  const th = (k: 'nome' | 'codigo', label: string, cls: string) => (
    <th className={`p-2 text-left ${cls}`}>
      <button type="button" className={`hover:underline ${ordem === k ? 'text-primary' : ''}`} onClick={() => setOrdem(k)}>{label}{ordem === k ? ' ▲' : ''}</button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <Input className="w-32" placeholder="Código" maxLength={10} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
        <Input className="flex-1 min-w-[200px]" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        <Button variant="outline" onClick={() => setImp(true)}><FileUp className="w-4 h-4 mr-1" />Importar extrato</Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar por:</span>
        <Button size="sm" variant={ordem === 'codigo' ? 'default' : 'outline'} onClick={() => setOrdem('codigo')}>Código</Button>
        <Button size="sm" variant={ordem === 'nome' ? 'default' : 'outline'} onClick={() => setOrdem('nome')}>Ordem alfabética</Button>
      </div>
      <div className="border rounded-md max-h-[50vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0"><tr>
            {th('codigo', 'Código', 'w-28')}{th('nome', 'Nome', '')}
            <th className="p-2 w-20">Ativo</th>
            <th className="p-2 w-32" title="Desmarcado: participa do rateio, mas não vai para o arquivo do Domínio">Gera lançamento</th>
            <th className="w-10" />
          </tr></thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-2">{f.codigo}</td>
                <td className="p-1"><Input defaultValue={f.nome} onBlur={(e) => e.target.value !== f.nome && patch(f.id, { nome: e.target.value })} /></td>
                <td className="p-2 text-center"><Switch checked={f.ativo} onCheckedChange={(v) => patch(f.id, { ativo: v })} /></td>
                <td className="p-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Switch checked={f.gera_lancamento !== false} onCheckedChange={(v) => patch(f.id, { gera_lancamento: v })} />
                    <span className="text-xs w-7">{f.gera_lancamento !== false ? 'Sim' : 'Não'}</span>
                  </div>
                </td>
                <td><Button size="icon" variant="ghost" onClick={() => del(f.id)}><Trash2 className="w-4 h-4" /></Button></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum funcionário.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">"Gera lançamento = Não": o funcionário continua recebendo sua parte no rateio, mas fica fora do arquivo de exportação.</p>
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
