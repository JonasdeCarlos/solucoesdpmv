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
  fileHash?: string;
}): Promise<ImportSummary> {
  const { parsed, fileName, filePath, importedBy, fileHash } = opts;
  const errors: any[] = [];
  const emissionIso = parseEmissionDate(parsed.emission_date);

  // 1. Cria registro de import (com fallback de reimportação após exclusão)
  const insertImportRow = async () =>
    await supabase
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
        file_hash: fileHash || null,
      } as any)
      .select()
      .single();

  let { data: importRow, error: impErr } = await insertImportRow();
  if ((impErr || !importRow) && fileHash && (impErr as any)?.code === '23505') {
    const { data: existing } = await supabase
      .from('aviso_imports' as any)
      .select('id,total_empresas,total_rows,errors_json')
      .eq('file_hash', fileHash)
      .maybeSingle();
    if (existing) {
      const existingRow = existing as any;
      // Se já existem avisos vinculados, manter comportamento antigo (skip).
      const { count } = await supabase
        .from('avisos' as any)
        .select('id', { count: 'exact', head: true })
        .eq('import_id', existingRow.id);
      if (count && count > 0) {
        return {
          importId: existingRow.id,
          totalEmpresas: existingRow.total_empresas ?? parsed.empresas.length,
          totalRows: existingRow.total_rows ?? 0,
          novos: 0,
          ignorados: existingRow.total_rows ?? 0,
          errors: [...(existingRow.errors_json || []), { stage: 'duplicate_file', msg: 'Arquivo PDF já importado anteriormente.' }],
        };
      }
      // Sem avisos remanescentes → admin excluiu tudo. Removemos o import
      // antigo (que carrega o file_hash) e reinserimos para liberar a chave única.
      await supabase.from('aviso_imports' as any).delete().eq('id', existingRow.id);
      const retry = await insertImportRow();
      importRow = retry.data as any;
      impErr = retry.error as any;
    }
  }
  if (impErr || !importRow) {
    throw new Error((impErr as any)?.message || 'Falha ao criar import');
  }
  const importId = (importRow as any).id;

  // 2. Cruza com cadastro existente por CNPJ → CÓDIGO → RAZÃO SOCIAL (evita duplicar
  //    empresas cadastradas manualmente ou com pequenas divergências).
  const normName = (s: string) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();

  let empresasMap = new Map<string, { id: string; responsavel: string }>();
  try {
    const { data: existentes, error: selAllErr } = await withRetry('select all empresas', async () =>
      await supabase.from('aviso_empresas' as any).select('id, code, cnpj, name, responsavel')
    );
    if (selAllErr) errors.push({ stage: 'select_all_empresas', msg: selAllErr.message });
    const byCnpj = new Map<string, any>();
    const byCode = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const r of (existentes || []) as any[]) {
      const c = normalizeCnpj(r.cnpj || '');
      if (c) byCnpj.set(c, r);
      const cd = String(r.code || '').trim();
      if (cd) byCode.set(cd, r);
      const nm = normName(r.name || '');
      if (nm) byName.set(nm, r);
    }

    const toInsert: any[] = [];
    for (const e of parsed.empresas) {
      const cnpjN = normalizeCnpj(e.cnpj);
      const codeT = String(e.code || '').trim();
      const nameN = normName(e.name);
      let existing =
        (cnpjN && byCnpj.get(cnpjN)) ||
        (codeT && byCode.get(codeT)) ||
        (nameN && byName.get(nameN));

      if (existing) {
        // Preenche campos identificadores ausentes na linha já cadastrada
        const patch: any = {};
        if ((!existing.code || existing.code === '') && codeT) patch.code = codeT;
        if ((!existing.cnpj || existing.cnpj === '') && cnpjN) patch.cnpj = cnpjN;
        if ((!existing.name || existing.name === '') && e.name) patch.name = e.name;
        if (Object.keys(patch).length) {
          const { error: upErr } = await supabase
            .from('aviso_empresas' as any).update(patch as any).eq('id', existing.id);
          if (upErr) errors.push({ stage: 'patch_empresa', msg: upErr.message });
          Object.assign(existing, patch);
          if (patch.cnpj) byCnpj.set(cnpjN, existing);
          if (patch.code) byCode.set(codeT, existing);
        }
        empresasMap.set(`${codeT}|${cnpjN}`, { id: existing.id, responsavel: existing.responsavel || '' });
      } else {
        toInsert.push({ code: codeT, name: e.name, cnpj: cnpjN });
      }
    }

    if (toInsert.length) {
      const { data: inseridas, error: insErr } = await withRetry('insert empresas novas', async () =>
        await supabase.from('aviso_empresas' as any).insert(toInsert as any).select('id, code, cnpj, responsavel')
      );
      if (insErr) errors.push({ stage: 'insert_empresas', msg: insErr.message });
      for (const r of (inseridas || []) as any[]) {
        empresasMap.set(`${r.code}|${r.cnpj}`, { id: r.id, responsavel: r.responsavel || '' });
      }
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
        employeeName: row.employee_name,
        motivo, due,
      });
      const dedupeKey = buildAvisoDedupeKey({
        employeeName: row.employee_name,
        motivo, due,
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
