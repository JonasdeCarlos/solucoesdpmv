import { MAX_PDF_BYTES, validatePdfAttachment, type PdfAttachment } from '../../../supabase/functions/_shared/mensageriaPdf';

export async function readMessagePdf(file: File): Promise<PdfAttachment> {
  if (!file.size || file.size > MAX_PDF_BYTES) throw new Error('Selecione um PDF de até 5 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o PDF.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('Não foi possível ler o PDF.'));
      resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
  return validatePdfAttachment({ name: file.name, mimetype: 'application/pdf', base64 });
}