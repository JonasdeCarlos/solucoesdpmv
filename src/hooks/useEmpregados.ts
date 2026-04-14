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
    const { data: existing } = await supabase
      .from('empregados')
      .select('id')
      .eq('nome', emp.nome)
      .eq('empresa_nome', emp.empresaNome)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('empregados')
        .update({ cpf: emp.cpf, funcao: emp.funcao, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('empregados')
        .insert({
          nome: emp.nome,
          cpf: emp.cpf,
          funcao: emp.funcao,
          empresa_nome: emp.empresaNome,
        });
    }
    await fetchEmpregados();
  }, [fetchEmpregados]);

  return { empregados, loading, upsertEmpregado, refetch: fetchEmpregados };
}
