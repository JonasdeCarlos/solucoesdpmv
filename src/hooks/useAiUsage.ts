import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AiUsageRow = {
  id: string;
  client_id: string;
  function_name: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  credits_estimate: number;
  meta: any;
  created_at: string;
};

export function useAiUsage(client_id: string | undefined) {
  const [items, setItems] = useState<AiUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('ai_usage_log' as any)
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(500);
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);

  useEffect(() => { load(); }, [load]);

  const totals = items.reduce((acc, r) => ({
    calls: acc.calls + 1,
    prompt: acc.prompt + (r.prompt_tokens || 0),
    completion: acc.completion + (r.completion_tokens || 0),
    total: acc.total + (r.total_tokens || 0),
    credits: acc.credits + Number(r.credits_estimate || 0),
  }), { calls: 0, prompt: 0, completion: 0, total: 0, credits: 0 });

  return { items, loading, totals, reload: load };
}