import { supabase } from '@/integrations/supabase/client';
import { categorizarMotivo, makeUniqueHash, normalizeCnpj, parseEmissionDate, parseVencimento } from './normalize';

export interface ParsedPdf {
  emission_date?: string;
  emission_time?: string;
  empresas: Array<{
    code: string; name: string; cnpj: string;
    linhas: Array<{ employee_code: string; employee_name: string; motivo: string; vencimento_raw: string }>;
  }>;
}

export interface ImportSummary {
  importId: string;
  totalEmpresas: number;
  totalRows: number;
  novos: number;
  ignorados: number;
  errors: any[];
}

export async function processarImportacao(opts: {
  parsed: ParsedPdf;
  fileName: string;
  filePath: string;
  importedBy: string;
}): Promise<ImportSummary> {
  const { parsed, fileName, filePath, importedBy } = opts;
  const errors: any[] = [];
  const emissionIso = parseEmissionDate(parsed.emission_date);
  let totalRows = 0;
  let novos = 0;
  let ignorados = 0;

  // Cria registro de import
  const { data: importRow, error: impErr } = await supabase
    .from('aviso_imports' as any)
    .insert({
      file_name: fileName,
      file_path: filePath,
      emission_date: emissionIso,
      emission_time: parsed.emission_time || null,
      total_empresas: parsed.empresas.length,
      total_rows: 0,
      novos: 0,
      ignorados: 0,
      errors_json: [],
      imported_by: importedBy,
    } as any)
    .select()
    .single();
  if (impErr || !importRow) throw new Error(impErr?.message || 'Falha ao criar import');
  const importId = (importRow as any).id;

  for (const emp of parsed.empresas) {
    // Upsert empresa
    const cnpjNorm = normalizeCnpj(emp.cnpj);
    let empresaId: string | null = null;
    let empresaResponsavel = '';
    try {
      const { data: existing } = await supabase
        .from('aviso_empresas' as any)
        .select('id, responsavel')
        .eq('code', emp.code)
        .eq('cnpj', cnpjNorm)
        .maybeSingle();
      if (existing) {
        empresaId = (existing as any).id;
        empresaResponsavel = (existing as any).responsavel || '';
        await supabase.from('aviso_empresas' as any).update({ name: emp.name }).eq('id', empresaId);
      } else {
        const { data: ins } = await supabase
          .from('aviso_empresas' as any)
          .insert({ code: emp.code, name: emp.name, cnpj: cnpjNorm } as any)
          .select('id').single();
        empresaId = (ins as any)?.id ?? null;
      }
    } catch (e: any) {
      errors.push({ empresa: emp.code, msg: e?.message });
    }

    for (const linha of emp.linhas) {
      totalRows++;
      try {
        const motivo = categorizarMotivo(linha.motivo);
        const { due, limit } = parseVencimento(linha.vencimento_raw);
        const hash = await makeUniqueHash({
          cnpj: cnpjNorm,
          empresaCode: emp.code,
          employeeCode: linha.employee_code,
          employeeName: linha.employee_name,
          motivo,
          due, limit,
        });

        // Verifica existência
        const { data: existing } = await supabase
          .from('avisos' as any)
          .select('id, status')
          .eq('unique_hash', hash)
          .maybeSingle();

        if (existing) {
          ignorados++;
          continue;
        }

        const { error } = await supabase.from('avisos' as any).insert({
          empresa_id: empresaId,
          empresa_code: emp.code,
          empresa_name: emp.name,
          empresa_cnpj: cnpjNorm,
          employee_code: linha.employee_code,
          employee_name: linha.employee_name,
          motivo,
          motivo_original: linha.motivo,
          due_date: due,
          limit_date: limit,
          source_emission_date: emissionIso,
          import_id: importId,
          unique_hash: hash,
          status: 'aberto',
          responsavel: empresaResponsavel,
        } as any);
        if (error) {
          if (error.code === '23505') ignorados++;
          else { errors.push({ linha, msg: error.message }); }
        } else {
          novos++;
        }
      } catch (e: any) {
        errors.push({ linha, msg: e?.message });
      }
    }
  }

  await supabase.from('aviso_imports' as any).update({
    total_rows: totalRows, novos, ignorados, errors_json: errors,
  } as any).eq('id', importId);

  return { importId, totalEmpresas: parsed.empresas.length, totalRows, novos, ignorados, errors };
}
