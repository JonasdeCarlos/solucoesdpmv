import { supabase } from '@/integrations/supabase/client';

type PublicReply = Record<string, any>;

export function checkPrizePublicReply(data: PublicReply | null): PublicReply {
  if (data?.requires_password) {
    const error = Object.assign(new Error(data.wrong ? 'Senha incorreta.' : 'Senha necessária.'), {
      requiresPassword: true,
    });
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  if (!data) throw new Error('Não foi possível carregar o prêmio. Tente novamente.');
  return data;
}

export async function invokePrizePublic(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('premio-hotelaria-public', { body });
  if (error) {
    // Preserve the server's access guidance instead of the SDK's generic HTTP error.
    const response = error.context;
    if (response instanceof Response) {
      const reply = await response.clone().json().catch(() => null);
      if (reply?.error || reply?.requires_password) return checkPrizePublicReply(reply);
    }
    throw new Error('Não foi possível acessar o prêmio. Tente novamente ou contate o escritório.');
  }
  return checkPrizePublicReply(data);
}