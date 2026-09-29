import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { fmt, parseNum } from '../utils/validacoes';

export interface LinhaImportada { codigo: string; nome: string; valor: number }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaId: string;
  valorLabel?: string;
  permitirPdf?: boolean;
  onConfirm: (rows: LinhaImportada[]) => Promise<void> | void;
}

const NONE = '__none__';

export default function ImportarExtratoDialog({ open, onOpenChange, empresaId, valorLabel = 'Rendimento bruto', permitirPdf = true, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState<string[][] | null>(null);
  const [map, setMap] = useState({ codigo: NONE, nome: NONE, valor: NONE });
  const [rows, setRows] = useState<(LinhaImportada & { sel: boolean })[]>([]);

  const reset = () => { setRaw(null); setRows([]); setMap({ codigo: NONE, nome: NONE, valor: NONE }); };

  const onFile = async (file: File) => {
    reset();
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      setLoading(true);
      if (ext === 'pdf') {
        if (!permitirPdf) throw new Error('PDF não suportado aqui');
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const { data, error } = await supabase.functions.invoke('ts-extrair-extrato', { body: { pdf_base64: btoa(bin), empresa_id: empresaId } });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
        setRows((data as any[]).map((d) => ({ codigo: d.codigo, nome: d.nome, valor: Number(d.rendimento_bruto) || 0, sel: true })));
      } else {
        const wb = ext === 'xlsx' || ext === 'xls'
          ? XLSX.read(await file.arrayBuffer(), { type: 'array' })
          : XLSX.read(await file.text(), { type: 'string', FS: (await file.text()).includes(';') ? ';' : undefined } as any);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as any[][])
          .map((r) => r.map((c) => String(c ?? '').trim()))
          .filter((r) => r.some(Boolean));
        if (!data.length) throw new Error('Arquivo vazio');
        setRaw(data);
      }
    } catch (e: any) {
      toast.error('Falha ao ler arquivo: ' + (e?.message || e));
    } finally { setLoading(false); }
  };

  const aplicarMapa = () => {
    if (!raw) return;
    const ci = Number(map.codigo), ni = Number(map.nome), vi = Number(map.valor);
    if (map.codigo === NONE) return toast.error('Informe a coluna de código');
    const out = raw.slice(1).map((r) => ({
      codigo: String(r[ci] ?? '').replace(/\D/g, ''),
      nome: map.nome === NONE ? '' : r[ni] ?? '',
      valor: map.valor === NONE ? 0 : parseNum(r[vi]),
      sel: true,
    })).filter((r) => r.codigo);
    setRows(out);
  };

  const header = raw?.[0] || [];
  const confirmar = async () => {
    const sel = rows.filter((r) => r.sel).map(({ sel, ...r }) => r);
    if (!sel.length) return toast.error('Nada selecionado');
    setLoading(true);
    try { await onConfirm(sel); onOpenChange(false); reset(); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Importar extrato</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Arquivo ({permitirPdf ? 'PDF, ' : ''}XLSX, CSV ou TXT)</Label>
            <Input type="file" accept={`${permitirPdf ? '.pdf,' : ''}.xlsx,.xls,.csv,.txt`} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Processando…</div>}
          {raw && !rows.length && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              {(['codigo', 'nome', 'valor'] as const).map((k) => (
                <div key={k}>
                  <Label>{k === 'codigo' ? 'Código' : k === 'nome' ? 'Nome' : valorLabel}</Label>
                  <Select value={map[k]} onValueChange={(v) => setMap((m) => ({ ...m, [k]: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— não usar —</SelectItem>
                      {header.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button onClick={aplicarMapa}><Upload className="w-4 h-4 mr-1" /> Pré-visualizar</Button>
            </div>
          )}
          {rows.length > 0 && (
            <div className="border rounded-md max-h-[45vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0"><tr>
                  <th className="p-2 w-8"><Checkbox checked={rows.every((r) => r.sel)} onCheckedChange={(c) => setRows((rs) => rs.map((r) => ({ ...r, sel: !!c })))} /></th>
                  <th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-right">{valorLabel}</th>
                </tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2"><Checkbox checked={r.sel} onCheckedChange={(c) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, sel: !!c } : x))} /></td>
                    <td className="p-2">{r.codigo}</td><td className="p-2">{r.nome}</td><td className="p-2 text-right">{fmt(r.valor)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!rows.length || loading} onClick={confirmar}>Gravar selecionados</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
