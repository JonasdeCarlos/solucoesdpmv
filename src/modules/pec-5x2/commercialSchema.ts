import { z } from 'zod';

export const commercialLeadSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do contato.').max(120),
  email: z.string().trim().email('Informe um e-mail válido.').max(254).transform(v => v.toLowerCase()),
  whatsapp: z.string().max(30).transform(v => v.replace(/\D/g, '')).refine(v => /^\d{10,15}$/.test(v), 'Informe o WhatsApp com DDD.'),
  empresa: z.string().trim().max(160).default(''),
  consentimento: z.literal(true, { errorMap: () => ({ message: 'Autorize o contato comercial para continuar.' }) }),
  website: z.string().max(0).optional(),
});