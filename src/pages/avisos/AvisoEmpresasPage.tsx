import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { formatCnpj } from '@/utils/avisos/normalize';

const AvisoEmpresasPage = () => {
  const { empresas, loading } = useAvisoEmpresas();
  const [q, setQ] = useState('');
  const filt = useMemo(() => empresas.filter((e) =>
    !q || `${e.code} ${e.name} ${e.cnpj}`.toLowerCase().includes(q.toLowerCase())
  ), [empresas, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <Link to="/admissao/escritorio/avisos"><Button variant="outline">← Avisos</Button></Link>
      </div>
      <Input placeholder="Buscar por código / nome / CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p> :
          filt.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma empresa.</p> :
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-2">Código</th><th className="text-left p-2">Nome</th><th className="text-left p-2">CNPJ</th><th></th></tr></thead>
            <tbody>
              {filt.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">{e.code}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2 font-mono text-xs">{formatCnpj(e.cnpj)}</td>
                  <td className="p-2 text-right">
                    <Link to={`/admissao/escritorio/avisos?empresa=${encodeURIComponent(e.code)}`}>
                      <Button size="sm" variant="outline">Ver avisos</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
      </Card>
    </div>
  );
};
export default AvisoEmpresasPage;
