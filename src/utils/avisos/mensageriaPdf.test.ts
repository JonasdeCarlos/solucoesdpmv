import { describe, expect, it } from 'vitest';
import { buildMessagePayload, MAX_PDF_BYTES, validatePdfAttachment } from '../../../supabase/functions/_shared/mensageriaPdf';

const pdf = { name: 'Comunicado.pdf', mimetype: 'application/pdf', base64: btoa('%PDF-1.4\nDocumento\n%%EOF') };
describe('PDF da mensageria', () => {
  it('envia PDF e texto no mesmo pedido do Digisac', () => {
    expect(buildMessagePayload('Comunicado aos clientes', 'canal', 'departamento', pdf)).toEqual({
      text: 'Comunicado aos clientes', serviceId: 'canal', departmentId: 'departamento', file: pdf,
    });
  });
  it('mantém envio sem anexo', () => {
    expect(buildMessagePayload('Aviso', 'canal', 'departamento')).not.toHaveProperty('file');
  });
  it('rejeita arquivo renomeado que não é PDF', () => {
    expect(() => validatePdfAttachment({ ...pdf, base64: btoa('outro arquivo') })).toThrow('não é um PDF');
  });
  it('rejeita PDF acima de 5 MB', () => {
    expect(() => validatePdfAttachment({ ...pdf, base64: btoa('%PDF-' + 'x'.repeat(MAX_PDF_BYTES - 4)) })).toThrow('até 5 MB');
  });
  it('rejeita nomes com caminhos e conteúdo malformado', () => {
    expect(() => validatePdfAttachment({ ...pdf, name: '../arquivo.pdf' })).toThrow('Nome');
    expect(() => validatePdfAttachment({ ...pdf, base64: '%%%%' })).toThrow('inválido');
  });
});