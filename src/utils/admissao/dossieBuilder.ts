import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { FormSchema, findField } from './formSchema';
import { buildCoverPdf, buildFormPdf } from './formPdf';
import { fileToPdfBytes, getExt } from './imageToPdf';

export interface AdmissionFileRow {
  id: string;
  request_id: string;
  field_key: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  sort_order: number;
}

export interface DossieInput {
  schema: FormSchema;
  answers: Record<string, any>;
  files: AdmissionFileRow[];
  meta: {
    companyName?: string;
    companyCnpj?: string;
    employeeName?: string;
    employeeCpf?: string;
    submittedAt?: string;
    templateName?: string;
    status?: string;
  };
}

export interface DossieResult {
  pdfBytes: Uint8Array;
  fileName: string;
}

async function downloadFile(path: string): Promise<File | null> {
  const { data, error } = await supabase.storage.from('admissao-uploads').download(path);
  if (error || !data) return null;
  const name = path.split('/').pop() || 'file';
  return new File([data], name, { type: (data as Blob).type });
}

export async function buildDossie(input: DossieInput): Promise<DossieResult> {
  const { schema, answers, files, meta } = input;

  // Group files by field_key, ordered
  const sorted = [...files].sort((a, b) => a.sort_order - b.sort_order);
  const groups = new Map<string, AdmissionFileRow[]>();
  for (const f of sorted) {
    if (!groups.has(f.field_key)) groups.set(f.field_key, []);
    groups.get(f.field_key)!.push(f);
  }

  // Pre-compute attachments index for cover (will refine after conversion)
  const attachmentsForCover: { label: string; pages: number }[] = [];

  // Convert each attachment file to PDF bytes (count pages)
  type Converted = { bytes: Uint8Array; label: string; originalName: string };
  const converted: Converted[] = [];
  for (const [fieldKey, group] of groups.entries()) {
    const field = findField(schema, fieldKey);
    const labelBase = field?.label || fieldKey;
    for (const row of group) {
      const file = await downloadFile(row.storage_path);
      if (!file) continue;
      try {
        const bytes = await fileToPdfBytes(file);
        if (!bytes) continue;
        converted.push({
          bytes,
          label: `${labelBase} — ${row.original_name}`,
          originalName: row.original_name,
        });
      } catch (e) {
        console.error('Failed to convert', row.original_name, e);
      }
    }
  }

  // Count pages per attachment via pdf-lib
  for (const att of converted) {
    try {
      const tmp = await PDFDocument.load(att.bytes, { ignoreEncryption: true });
      attachmentsForCover.push({ label: att.label, pages: tmp.getPageCount() });
    } catch {
      attachmentsForCover.push({ label: att.label, pages: 1 });
    }
  }

  // Build cover & form PDFs
  const coverBytes = buildCoverPdf({
    title: 'Dossiê de Admissão',
    companyName: meta.companyName,
    companyCnpj: meta.companyCnpj,
    employeeName: meta.employeeName,
    employeeCpf: meta.employeeCpf,
    submittedAt: meta.submittedAt,
    templateName: meta.templateName,
    status: meta.status,
    attachments: attachmentsForCover,
  });

  const formBytes = buildFormPdf(schema, answers, {
    title: meta.templateName || 'Formulário de Admissão',
    companyName: meta.companyName,
    companyCnpj: meta.companyCnpj,
    employeeName: meta.employeeName,
    submittedAt: meta.submittedAt,
  });

  // Merge all into one PDF
  const final = await PDFDocument.create();
  const sources: Uint8Array[] = [coverBytes, formBytes, ...converted.map((c) => c.bytes)];
  for (const src of sources) {
    try {
      const doc = await PDFDocument.load(src, { ignoreEncryption: true });
      const pages = await final.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => final.addPage(p));
    } catch (e) {
      console.error('Failed to merge a source PDF', e);
    }
  }

  const pdfBytes = await final.save();

  const safe = (s: string) => s.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'admissao';
  const dateStr = (meta.submittedAt || new Date().toLocaleDateString('pt-BR')).replace(/\//g, '-');
  const cpfPart = meta.employeeCpf ? safe(meta.employeeCpf) : '';
  const namePart = meta.employeeName ? safe(meta.employeeName) : 'sem-nome';
  const fileName = `ADMISSAO - ${namePart}${cpfPart ? ' - ' + cpfPart : ''} - ${dateStr}.pdf`;

  return { pdfBytes, fileName };
}

/** Try to extract employee name & cpf from answers based on common keys/labels. */
export function extractEmployeeIdentity(
  schema: FormSchema,
  answers: Record<string, any>
): { name?: string; cpf?: string } {
  let name: string | undefined;
  let cpf: string | undefined;
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      const lbl = (f.label || '').toLowerCase();
      const v = answers[f.field_key];
      if (!v || typeof v !== 'string') continue;
      if (!name && (lbl.includes('nome completo') || lbl === 'nome' || lbl.startsWith('nome '))) {
        name = v;
      }
      if (!cpf && (f.type === 'cpf' || lbl.includes('cpf'))) {
        cpf = v;
      }
    }
  }
  return { name, cpf };
}