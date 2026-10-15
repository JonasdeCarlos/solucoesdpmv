// Fonte única das regras: o mesmo arquivo roda na edge escala-publica.
export * from '../../../supabase/functions/_shared/escalaMotor';
export { carregarEscala, salvarEscala, paramsDe, PARAM_KEYS } from '../../../supabase/functions/_shared/escalaStore';
import type { EscalaFuncionario } from '../../../supabase/functions/_shared/escalaMotor';
import { safeUuid } from '@/utils/safeUuid';

export function novoFuncionario(): EscalaFuncionario {
  return {
    id: safeUuid(), codigo: '', nome: '', cargo: '', setor: '', sexo: 'M', art386_ativo: false, art386_justificativa_desativacao: '',
    ultima_folga_anterior: null, ultimo_domingo_folga_anterior: null, hora_entrada: '', hora_saida: '', dias: {},
  };
}

export const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', em_revisao: 'Em revisão', aprovada: 'Aprovada', devolvida: 'Devolvida',
};
