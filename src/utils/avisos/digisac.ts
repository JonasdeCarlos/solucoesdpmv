import { supabase } from '@/integrations/supabase/client';
import { buildWhatsappMessage, type AvisoMsgInput, type AvisoMsgPrefix } from './whatsappMessage';

export interface SendAvisoDigisacInput {
  aviso: AvisoMsgInput;
  whatsapp: string;
  prefix: AvisoMsgPrefix;
}

export async function sendAvisoDigisac({ aviso, whatsapp, prefix }: SendAvisoDigisacInput) {
  const number = (whatsapp || '').replace(/\D/g, '');
  if (!number) {
    return { ok: false, error: 'WhatsApp da empresa não cadastrado. Cadastre em Avisos → Empresas.' };
  }
  const text = buildWhatsappMessage(aviso, prefix);
  const { data, error } = await supabase.functions.invoke('digisac-send', {
    body: { number, text },
  });
  if (error) return { ok: false, error: error.message || 'Falha ao enviar via Digisac.' };
  if ((data as any)?.error) return { ok: false, error: String((data as any).error) };
  return { ok: true, data };
}