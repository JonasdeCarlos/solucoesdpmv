import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import FileDropZone from '@/components/pdftools/FileDropZone';
import { extractPontoPdf, hashFile, ExtractedRow } from '@/utils/bancoHoras/pdfExtractor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SaldoChip } from '@/components/bancohoras/SaldoChip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

type DupChoice = 'substituir' | 'manter' | 'nova_versao';

export default function BhImportPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [hash, setHash] = useState<string>('');
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [duplicates, setDuplicates] = useState<{ key: string; nome: string; competencia: string }[]>([]);
  const [askDup, setAskDup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ ok: number; pendentes: number; substituidos: number; novos: number } | null>(null);

  const handleParse = async () => {
    if (!files[0]) return;
    setParsing(true);
    setRows([]);
    setDone(null);
    try {
      const f = files[0];
      const [extracted, h] = await Promise.all([extractPontoPdf(f), hashFile(f)]);
      setRows(extracted);
      setHash(h);
      setFileMeta({ name: f.name, size: f.size });
      toast.success(`${extracted.length} colaboradores encontrados`);
    } catch (e: any) {
      toast.error(`Falha na leitura do PDF: ${e?.message || e}`);
    } finally {
      setParsing(false);
    }
  };

  const checkDuplicatesAndSave = async () => {
    const okRows = rows.filter((r) => r.status === 'ok' && r.competencia);
    if (okRows.length === 0) {
      toast.error('Nenhum saldo válido para importar');
      return;
    }
    // detectar duplicatas
    const dups: { key: string; nome: string; competencia: string }[] = [];
    for (const r of okRows) {
      const { data: emp } = await supabase
        .from('bh_employees' as any)
        .select('id')
        .eq('empresa_cnpj', r.empresa_cnpj)
        .eq('codigo', r.codigo)
        .eq('nome', r.nome)
        .maybeSingle();
      if (!emp) continue;
      const { data: bal } = await supabase
        .from('bh_balances' as any)
        .select('id')
        .eq('employee_id', (emp as any).id)
        .eq('competencia', r.competencia)
        .eq('is_current', true)
        .maybeSingle();
      if (bal) dups.push({ key: `${r.codigo}|${r.competencia}`, nome: r.nome, competencia: r.competencia });
    }
    if (dups.length > 0) {
      setDuplicates(dups);
      setAskDup(true);
    } else {
      await doSave('substituir');
    }
  };

  const doSave = async (choice: DupChoice) => {
    setAskDup(false);
    setSaving(true);
    let ok = 0;
    let pendentes = 0;
    let substituidos = 0;
    let novos = 0;
    const errors: any[] = [];
    try {
      // upload do PDF
      let filePath: string | null = null;
      const f = files[0];
      if (f) {
        const path = `${new Date().toISOString().slice(0, 10)}/${hash}_${f.name}`;
        const { error: upErr } = await supabase.storage.from('ponto-pdfs').upload(path, f, { upsert: true });
        if (!upErr) filePath = path;
      }

      // import row
      const empresaSample = rows.find((r) => r.empresa_cnpj) || rows[0];
      const compSample = rows.find((r) => r.competencia) || rows[0];
      pendentes = rows.filter((r) => r.status !== 'ok').length;
      const { data: imp, error: impErr } = await supabase
        .from('bh_imports' as any)
        .insert({
          empresa_nome: empresaSample?.empresa_nome || '',
          empresa_cnpj: empresaSample?.empresa_cnpj || '',
          competencia: compSample?.competencia || null,
          file_path: filePath,
          file_name: fileMeta?.name || '',
          file_hash: hash,
          imported_by: user?.email || '',
          total_paginas: rows.length,
          total_ok: 0,
          total_pendentes: pendentes,
          errors_json: rows.filter((r) => r.status !== 'ok').map((r) => ({ page: r.page, motivo: r.motivo, nome: r.nome })),
        } as any)
        .select()
        .single();
      if (impErr) throw impErr;
      const importId = (imp as any).id;

      for (const r of rows.filter((x) => x.status === 'ok' && x.competencia)) {
        // upsert employee
        let empId: string | null = null;
        const { data: existingEmp } = await supabase
          .from('bh_employees' as any)
          .select('id')
          .eq('empresa_cnpj', r.empresa_cnpj)
          .eq('codigo', r.codigo)
          .eq('nome', r.nome)
          .maybeSingle();
        if (existingEmp) {
          empId = (existingEmp as any).id;
        } else {
          const { data: newEmp, error: eErr } = await supabase
            .from('bh_employees' as any)
            .insert({
              empresa_cnpj: r.empresa_cnpj,
              empresa_nome: r.empresa_nome,
              codigo: r.codigo,
              nome: r.nome,
            } as any)
            .select()
            .single();
          if (eErr) {
            errors.push({ page: r.page, motivo: eErr.message });
            continue;
          }
          empId = (newEmp as any).id;
        }

        // existente?
        const { data: existingBal } = await supabase
          .from('bh_balances' as any)
          .select('id, version')
          .eq('employee_id', empId)
          .eq('competencia', r.competencia)
          .eq('is_current', true)
          .maybeSingle();

        if (existingBal) {
          if (choice === 'manter') continue;
          if (choice === 'substituir') {
            await supabase.from('bh_balances' as any).delete().eq('id', (existingBal as any).id);
          } else if (choice === 'nova_versao') {
            await supabase
              .from('bh_balances' as any)
              .update({ is_current: false } as any)
              .eq('id', (existingBal as any).id);
          }
          substituidos++;
        } else {
          novos++;
        }

        const nextVersion = existingBal && choice === 'nova_versao' ? ((existingBal as any).version || 1) + 1 : 1;
        const { error: bErr } = await supabase.from('bh_balances' as any).insert({
          import_id: importId,
          employee_id: empId,
          empresa_cnpj: r.empresa_cnpj,
          competencia: r.competencia,
          balance_minutes: r.bsaldo_minutes,
          balance_hhmm: r.bsaldo,
          status: r.status,
          version: nextVersion,
          is_current: true,
        } as any);
        if (bErr) {
          errors.push({ page: r.page, motivo: bErr.message });
          continue;
        }
        ok++;
      }

      await supabase
        .from('bh_imports' as any)
        .update({ total_ok: ok, errors_json: errors } as any)
        .eq('id', importId);

      setDone({ ok, pendentes, substituidos, novos });
      toast.success(`Importação concluída: ${ok} saldos`);
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Importar PDF de Cartão Ponto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            files={files}
            setFiles={setFiles}
            multiple={false}
            accept="application/pdf"
            label="Arraste o PDF do cartão ponto ou clique para selecionar"
          />
          <div className="flex gap-2">
            <Button onClick={handleParse} disabled={!files[0] || parsing}>
              {parsing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ler PDF
            </Button>
            {rows.length > 0 && (
              <Button onClick={checkDuplicatesAndSave} disabled={saving} variant="default">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar saldos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia da extração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs mb-3 text-muted-foreground">
              Empresa: <strong>{rows[0]?.empresa_nome}</strong> • CNPJ: {rows[0]?.empresa_cnpj} • Competência:{' '}
              <strong>{rows[0]?.competencia_label}</strong> • {rows.length} colaboradores
              {rows.filter((r) => r.status !== 'ok').length > 0 && (
                <span className="ml-2 text-yellow-700">
                  • {rows.filter((r) => r.status !== 'ok').length} pendente(s)
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Pág.</th>
                    <th className="p-2 text-left">Cód.</th>
                    <th className="p-2 text-left">Colaborador</th>
                    <th className="p-2 text-left">Competência</th>
                    <th className="p-2 text-left">BSALDO</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.page} className="border-b">
                      <td className="p-2">{r.page}</td>
                      <td className="p-2 font-mono">{r.codigo || '—'}</td>
                      <td className="p-2">{r.nome}</td>
                      <td className="p-2">{r.competencia_label}</td>
                      <td className="p-2">
                        {r.status === 'ok' ? <SaldoChip minutes={r.bsaldo_minutes} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">
                        {r.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> ok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-700">
                            <AlertTriangle className="w-3 h-3" /> {r.motivo}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo da importação</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              <li>Saldos importados: <strong>{done.ok}</strong></li>
              <li>Novos: {done.novos} • Substituídos/atualizados: {done.substituidos}</li>
              <li>Pendentes (não importados): {done.pendentes}</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={askDup} onOpenChange={setAskDup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldos já existentes</AlertDialogTitle>
            <AlertDialogDescription>
              Foram detectadas <strong>{duplicates.length}</strong> entradas que já existem para esta competência. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => doSave('manter')}>Manter existentes</Button>
            <Button variant="outline" onClick={() => doSave('nova_versao')}>Criar nova versão</Button>
            <AlertDialogAction onClick={() => doSave('substituir')}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
