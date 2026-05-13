import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { formatCnpj } from '@/utils/avisos/normalize';

const AvisoEmpresasPage = () => {
  const { empresas, loading, setResponsavelAndPropagate } = useAvisoEmpresas();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const filt = useMemo(() => empresas.filter((e) =>
    !q || `${e.code} ${e.name} ${e.cnpj} ${e.responsavel}`.toLowerCase().includes(q.toLowerCase())
  ), [empresas, q]);

  const save = async (emp: any) => {
    const novo = (editing[emp.id] ?? emp.responsavel ?? '').trim();
    if (novo === (emp.responsavel || '')) return;
    await setResponsavelAndPropagate(emp, novo);
    toast.success(`Responsável atualizado para ${emp.code}.`);
    setEditing((s) => { const n = { ...s }; delete n[emp.id]; return n; });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <Link to="/avisos"><Button variant="outline">← Avisos</Button></Link>
      </div>
      <Input placeholder="Buscar por código / nome / CNPJ / responsável" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p> :
          filt.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma empresa.</p> :
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-2">Código</th><th className="text-left p-2">Nome</th><th className="text-left p-2">CNPJ</th><th className="text-left p-2">Responsável</th><th></th></tr></thead>
            <tbody>
              {filt.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">{e.code}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2 font-mono text-xs">{formatCnpj(e.cnpj)}</td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Atribuir responsável"
                      value={editing[e.id] ?? e.responsavel ?? ''}
                      onChange={(ev) => setEditing((s) => ({ ...s, [e.id]: ev.target.value }))}
                      onBlur={() => save(e)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <Link to={`/avisos?empresa=${encodeURIComponent(e.code)}`}>
                      <Button size="sm" variant="outline">Ver avisos</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
      </Card>
      <p className="text-xs text-muted-foreground">
        O nome atribuído é aplicado automaticamente a novos avisos importados desta empresa, e atualiza os avisos em aberto.
      </p>
    </div>
  );
};
export default AvisoEmpresasPage;
