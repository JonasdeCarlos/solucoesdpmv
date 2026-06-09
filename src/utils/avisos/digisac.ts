import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildWhatsappMessage, type AvisoMsgInput, type AvisoMsgPrefix } from './whatsappMessage';

export interface SendAvisoDigisacInput {
  aviso: AvisoMsgInput & { id?: string };
  empresa: { id?: string; whatsapp?: string | null; digisac_contact_id?: string | null; gestor_digisac_user_id?: string | null } | undefined | null;
  prefix: AvisoMsgPrefix;
  tipo_aviso: 'aviso1' | 'aviso2' | 'aviso3' | 'ligacao';
}

export async function sendAvisoDigisac({ aviso, empresa, prefix, tipo_aviso }: SendAvisoDigisacInput) {
  if (!empresa?.id) {
    return { ok: false, error: 'Empresa do aviso não localizada.' };
  }
  const hasContact = !!empresa.digisac_contact_id;
  const hasWa = !!(empresa.whatsapp && String(empresa.whatsapp).replace(/\D/g, ''));
  if (!hasContact && !hasWa) {
    return { ok: false, error: 'Cadastre o WhatsApp da empresa antes de enviar avisos via Digisac.' };
  }
  if (!empresa.gestor_digisac_user_id) {
    toast.warning(
      'Esta empresa não tem gestor responsável cadastrado. O aviso será enviado, mas a resposta pode cair em fila geral. Cadastre o gestor no perfil da empresa para atendimento direto.',
      { duration: 7000 },
    );
  }
  const mensagem = buildWhatsappMessage(aviso, prefix);
  const { data, error } = await supabase.functions.invoke('avisos-digisac-send', {
    body: { empresa_id: empresa.id, aviso_id: aviso.id, mensagem, tipo_aviso },
  });
  if (error) return { ok: false, error: error.message || 'Falha ao enviar via Digisac.' };
  if ((data as any)?.erro) return { ok: false, error: String((data as any).erro) };
  return { ok: true, data };
}

export async function pingDigisac() {
  const { data, error } = await supabase.functions.invoke('avisos-digisac-ping', { body: {} });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}