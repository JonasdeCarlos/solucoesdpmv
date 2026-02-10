import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type Client } from '@/types/client';

export function useClientes() {
  const [clientes, setClientes] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('clientes' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setClientes((data as any[]).map((d) => ({
        id: d.id,
        nome: d.nome,
        tipo: d.tipo as 'PF' | 'PJ',
        cpf: d.cpf || '',
        cnpj: d.cnpj || '',
        endereco: d.endereco || '',
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const saveCliente = async (client: Client) => {
    const row = {
      id: client.id,
      nome: client.nome,
      tipo: client.tipo,
      cpf: client.cpf,
      cnpj: client.cnpj,
      endereco: client.endereco,
    };
    const { error } = await supabase
      .from('clientes' as any)
      .upsert(row as any);
    if (!error) await fetchClientes();
    return { error };
  };

  const deleteCliente = async (id: string) => {
    const { error } = await supabase
      .from('clientes' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchClientes();
    return { error };
  };

  return { clientes, loading, saveCliente, deleteCliente };
}
