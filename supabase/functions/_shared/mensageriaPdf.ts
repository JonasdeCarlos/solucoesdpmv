export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BASE64 = 4 * Math.ceil(MAX_PDF_BYTES / 3);

export type PdfAttachment = { name: string; mimetype: 'application/pdf'; base64: string };

export function validatePdfAttachment(value: unknown): PdfAttachment {
  if (!value || typeof value !== 'object') throw new Error('Anexo PDF inválido.');
  const file = value as Record<string, unknown>;
  if (typeof file.name !== 'string' || file.name.length > 180 || !/\.pdf$/i.test(file.name) || /[\x00-\x1f/\\]/.test(file.name)) {
    throw new Error('Nome do PDF inválido (máx. 180 caracteres).');
  }
  if (file.mimetype !== 'application/pdf' || typeof file.base64 !== 'string' || !file.base64 || file.base64.length > MAX_PDF_BASE64) {
    throw new Error('Selecione um PDF de até 5 MB.');
  }
  if (file.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) throw new Error('Conteúdo do PDF inválido.');
  const bytes = atob(file.base64);
  if (bytes.length > MAX_PDF_BYTES) throw new Error('Selecione um PDF de até 5 MB.');
  if (!bytes.startsWith('%PDF-')) throw new Error('O arquivo não é um PDF válido.');
  return { name: file.name, mimetype: 'application/pdf', base64: file.base64 };
}

export function buildMessagePayload(text: string, serviceId: string, departmentId: string, attachment?: unknown): Record<string, unknown> {
  return {
    text, serviceId, departmentId,
    ...(attachment === undefined ? {} : { file: validatePdfAttachment(attachment) }),
  };
}