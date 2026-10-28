import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import NecessidadeContratacao from '../components/NecessidadeContratacao';
import { apiPublica, chamarPublica } from '../api';

export default function Pec5x2PublicaPage() {
  const { token = '' } = useParams();
  const api = useMemo(() => apiPublica(token), [token]);
  const [empresa, setEmpresa] = useState<{ nome: string; cnpj?: string } | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { chamarPublica(token, 'load').then((d) => setEmpresa(d.empresa || { nome: '' })).catch((e) => setErro(e.message)); }, [token]);
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-6 space-y-2 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold">PEC 5x2 – Necessidade de Contratação</h1>
        <p className="text-sm text-muted-foreground">{empresa?.nome ? `${empresa.nome} · ` : ''}Preencha os setores, horários e movimento de cada dia. Tudo é salvo automaticamente e o escritório acompanha.</p>
        {erro ? <p className="text-destructive">{erro}</p>
          : empresa ? <NecessidadeContratacao empresaId="publico" empresa={empresa} api={api} />
          : <p className="text-sm text-muted-foreground">Carregando…</p>}
        <p className="text-xs text-muted-foreground pt-4">Monte Verde Contabilidade · estimativa para planejamento.</p>
      </div>
    </div>
  );
}
