import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildWhatsappMessage, type AvisoMsgInput, type AvisoMsgPrefix } from './whatsappMessage';

export interface SendAvisoDigisacInput {
  aviso: AvisoMsgInput & { id?: string };
  empresa: { id?: string; whatsapp?: string | null; whatsapp_numeros?: string[] | null; digisac_contact_id?: string | null; gestor_digisac_user_id?: string | null } | undefined | null;
  prefix: AvisoMsgPrefix;
  tipo_aviso: 'aviso1' | 'aviso2' | 'aviso3' | 'ligacao';
}

export async function sendAvisoDigisac({ aviso, empresa, prefix, tipo_aviso }: SendAvisoDigisacInput) {
  if (!empresa?.id) {
    return { ok: false, error: 'Empresa do aviso não localizada.' };
  }
  const numeros = (Array.isArray(empresa.whatsapp_numeros) ? empresa.whatsapp_numeros : [])
    .map((n) => String(n || '').replace(/\D/g, ''))
    .filter(Boolean);
  if (numeros.length === 0 && empresa.whatsapp) {
    const n = String(empresa.whatsapp).replace(/\D/g, '');
    if (n) numeros.push(n);
  }
  const hasContact = !!empresa.digisac_contact_id;
  if (!hasContact && numeros.length === 0) {
    return { ok: false, error: 'Cadastre o WhatsApp da empresa antes de enviar avisos via Digisac.' };
  }
  if (!empresa.gestor_digisac_user_id) {
    toast.warning(
      'Esta empresa não tem gestor responsável cadastrado. O aviso será enviado, mas a resposta pode cair em fila geral. Cadastre o gestor no perfil da empresa para atendimento direto.',
      { duration: 7000 },
    );
  }
  const mensagem = buildWhatsappMessage(aviso, prefix);

  // Multi-destinatário: quando houver mais de um número cadastrado, envia uma mensagem
  // por número (override explícito) para contornar a limitação de 1 ticket/contato no Digisac.
  const destinos: Array<{ number_override?: string; label: string }> = numeros.length > 1
    ? numeros.map((n) => ({ number_override: n, label: n }))
    : [{ label: numeros[0] || 'contato Digisac' }];

  const baseKey = `${aviso.id ?? 'noid'}-${tipo_aviso}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const resultados: any[] = [];
  const falhas: string[] = [];
  let algumTransferFail = false;
  let algumDuplicado = false;

  for (const d of destinos) {
    const body: any = {
      empresa_id: empresa.id,
      aviso_id: aviso.id,
      mensagem,
      tipo_aviso,
      idempotency_key: d.number_override ? `${baseKey}-${d.number_override}` : baseKey,
    };
    if (d.number_override) body.number_override = d.number_override;
    const { data, error } = await supabase.functions.invoke('avisos-digisac-send', { body });
    if (error) { falhas.push(`${d.label}: ${error.message || 'erro'}`); continue; }
    if ((data as any)?.erro) { falhas.push(`${d.label}: ${(data as any).erro}`); continue; }
    resultados.push(data);
    if ((data as any)?.duplicado) algumDuplicado = true;
    if (empresa.gestor_digisac_user_id && (data as any)?.sucesso && (data as any)?.transferOk === false && !(data as any)?.duplicado) {
      algumTransferFail = true;
    }
  }

  if (resultados.length === 0) {
    return { ok: false, error: falhas.join(' | ') || 'Falha ao enviar via Digisac.' };
  }
  if (falhas.length > 0) {
    toast.warning(`Enviado para ${resultados.length} destinatário(s); falhou em: ${falhas.join(' | ')}`, { duration: 8000 });
  } else if (destinos.length > 1) {
    toast.success(`Enviado para ${resultados.length} contatos da empresa.`);
  }
  if (algumTransferFail) {
    toast.warning('Aviso enviado, mas atribuição automática ao gestor falhou em ao menos um contato. Verifique no Digisac.', { duration: 8000 });
  }
  return { ok: true, data: { sucesso: true, resultados, duplicado: algumDuplicado && resultados.every((r) => r?.duplicado) } };
}

export async function pingDigisac() {
  const { data, error } = await supabase.functions.invoke('avisos-digisac-ping', { body: {} });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}