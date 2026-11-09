import { describe, expect, it } from 'vitest';
import { commercialLeadSchema } from '../commercialSchema';

const contato = { nome: 'Contato Teste', email: 'contato@example.com', whatsapp: '(35) 99999-1234', empresa: '', consentimento: true };
describe('Cadastro comercial PEC 5x2', () => {
  it('exige nome de contato antes do acesso', () => expect(commercialLeadSchema.safeParse({ ...contato, nome: '' }).success).toBe(false));
  it('exige e-mail válido antes do acesso', () => expect(commercialLeadSchema.safeParse({ ...contato, email: 'sem-email' }).success).toBe(false));
  it('exige WhatsApp com DDD antes do acesso', () => expect(commercialLeadSchema.safeParse({ ...contato, whatsapp: '' }).success).toBe(false));
  it('normaliza o WhatsApp informado', () => expect(commercialLeadSchema.parse(contato).whatsapp).toBe('35999991234'));
  it('exige consentimento comercial', () => expect(commercialLeadSchema.safeParse({ ...contato, consentimento: false }).success).toBe(false));
});