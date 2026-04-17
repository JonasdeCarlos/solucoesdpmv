import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Empregado {
  id: string;
  nome: string;
  cpf: string;
  funcao: string;
  empresaNome: string;
}

export function useEmpregados() {
  const [empregados, setEmpregados] = useState<Empregado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmpregados = useCallback(async () => {
    const { data, error } = await supabase
      .from('empregados')
      .select('*')
      .order('nome', { ascending: true });
    if (!error && data) {
      setEmpregados(data.map(d => ({
        id: d.id,
        nome: d.nome,
        cpf: d.cpf,
        funcao: d.funcao,
        empresaNome: d.empresa_nome,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmpregados(); }, [fetchEmpregados]);

  const upsertEmpregado = useCallback(async (emp: Omit<Empregado, 'id'>) => {
    const nomeNorm = emp.nome.trim().replace(/\s+/g, ' ');
    const cpfNorm = (emp.cpf || '').trim();

    // 1) Match por CPF (quando informado) dentro da mesma empresa — evita duplicatas com nomes diferentes
    let existingId: string | null = null;
    if (cpfNorm) {
      const { data: byCpf } = await supabase
        .from('empregados')
        .select('id')
        .eq('cpf', cpfNorm)
        .eq('empresa_nome', emp.empresaNome)
        .maybeSingle();
      if (byCpf) existingId = byCpf.id;
    }

    // 2) Fallback: match por nome normalizado
    if (!existingId) {
      const { data: all } = await supabase
        .from('empregados')
        .select('id, nome')
        .eq('empresa_nome', emp.empresaNome);
      const match = all?.find(r => r.nome.trim().replace(/\s+/g, ' ').toUpperCase() === nomeNorm.toUpperCase());
      if (match) existingId = match.id;
    }

    if (existingId) {
      await supabase
        .from('empregados')
        .update({ nome: nomeNorm, cpf: cpfNorm, funcao: emp.funcao, updated_at: new Date().toISOString() })
        .eq('id', existingId);
    } else {
      await supabase
        .from('empregados')
        .insert({
          nome: nomeNorm,
          cpf: cpfNorm,
          funcao: emp.funcao,
          empresa_nome: emp.empresaNome,
        });
    }
    await fetchEmpregados();
  }, [fetchEmpregados]);

  return { empregados, loading, upsertEmpregado, refetch: fetchEmpregados };
}
