import { supabase } from '@/integrations/supabase/client';
import { buildAvisoDedupeKey, categorizarMotivo, makeUniqueHash, normalizeCnpj, parseEmissionDate, parseVencimento } from './normalize';

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

/** Tenta uma operação até 3 vezes em caso de falha de rede transitória. */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      console.warn(`[importer] ${label} tentativa ${i + 1} falhou:`, e?.message || e);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
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

  // 1. Cria registro de import
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

  // 2. Bulk upsert empresas (1 roundtrip)
  const empresasPayload = parsed.empresas.map((e) => ({
    code: e.code,
    name: e.name,
    cnpj: normalizeCnpj(e.cnpj),
  }));

  let empresasMap = new Map<string, { id: string; responsavel: string }>();
  try {
    const { error: upErr } = await withRetry('upsert empresas', async () => {
      return await supabase
        .from('aviso_empresas' as any)
        .upsert(empresasPayload as any, { onConflict: 'code,cnpj', ignoreDuplicates: false });
    });
    if (upErr) errors.push({ stage: 'upsert_empresas', msg: upErr.message });

    // Busca ids + responsavel atual
    const codes = empresasPayload.map((e) => e.code);
    const { data: empresas, error: selErr } = await withRetry('select empresas', async () =>
      await supabase.from('aviso_empresas' as any).select('id, code, cnpj, responsavel').in('code', codes)
    );
    if (selErr) errors.push({ stage: 'select_empresas', msg: selErr.message });
    for (const e of (empresas || []) as any[]) {
      empresasMap.set(`${e.code}|${e.cnpj}`, { id: e.id, responsavel: e.responsavel || '' });
    }
  } catch (e: any) {
    errors.push({ stage: 'empresas', msg: e?.message });
  }

  // 3. Monta payload de avisos com hash
  const linhasFlat: Array<{ row: any; empresa: typeof parsed.empresas[number] }> = [];
  for (const emp of parsed.empresas) {
    for (const l of emp.linhas) linhasFlat.push({ row: l, empresa: emp });
  }
  const totalRows = linhasFlat.length;

  const avisosPayload: any[] = [];
  for (const { row, empresa } of linhasFlat) {
    try {
      const cnpjNorm = normalizeCnpj(empresa.cnpj);
      const motivo = categorizarMotivo(row.motivo);
      const { due, limit } = parseVencimento(row.vencimento_raw);
      const hash = await makeUniqueHash({
        cnpj: cnpjNorm,
        empresaCode: empresa.code,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        motivo, due, limit,
      });
      const dedupeKey = buildAvisoDedupeKey({
        empresaCode: empresa.code,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        motivo, due, limit,
      });
      const empInfo = empresasMap.get(`${empresa.code}|${cnpjNorm}`);
      avisosPayload.push({
        empresa_id: empInfo?.id ?? null,
        empresa_code: empresa.code,
        empresa_name: empresa.name,
        empresa_cnpj: cnpjNorm,
        employee_code: row.employee_code,
        employee_name: row.employee_name,
        motivo,
        motivo_original: row.motivo,
        due_date: due,
        limit_date: limit,
        source_emission_date: emissionIso,
        import_id: importId,
        unique_hash: hash,
        dedupe_key: dedupeKey,
        status: 'aberto',
        responsavel: empInfo?.responsavel ?? '',
      });
    } catch (e: any) {
      errors.push({ linha: row, msg: e?.message });
    }
  }

  // 4. Bulk insert avisos em chunks, ignorando duplicados pela chave estável
  let novos = 0;
  const CHUNK = 100;
  for (let i = 0; i < avisosPayload.length; i += CHUNK) {
    const chunk = avisosPayload.slice(i, i + CHUNK);
    try {
      const { data, error } = await withRetry(`insert avisos ${i}`, async () =>
        await supabase
          .from('avisos' as any)
          .upsert(chunk as any, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('id')
      );
      if (error) {
        errors.push({ stage: `insert_avisos_${i}`, msg: error.message });
      } else {
        novos += (data?.length ?? 0);
      }
    } catch (e: any) {
      errors.push({ stage: `insert_avisos_${i}`, msg: e?.message });
    }
  }
  const ignorados = Math.max(0, totalRows - novos - errors.filter((e) => e.linha).length);

  await withRetry('update import', async () =>
    await supabase.from('aviso_imports' as any).update({
      total_rows: totalRows, novos, ignorados, errors_json: errors,
    } as any).eq('id', importId)
  ).catch((e) => console.error('[importer] falha ao atualizar import row:', e));

  return { importId, totalEmpresas: parsed.empresas.length, totalRows, novos, ignorados, errors };
}
