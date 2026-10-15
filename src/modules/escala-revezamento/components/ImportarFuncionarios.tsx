import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { lerPdf, textoConfiavel } from '@/modules/conversor-dominio/utils/pdfTexto';
import { novoFuncionario, type EscalaFuncionario } from '../motor';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const toDataUrl = (f: File) => new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = err; r.readAsDataURL(f); });

type Achado = { codigo: string; nome: string; cargo?: string };

export default function ImportarFuncionarios({ atuais, onImportar }: { atuais: EscalaFuncionario[]; onImportar: (f: EscalaFuncionario[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);

  const ler = async (files: FileList | null) => {
    if (!files?.length) return;
    setLendo(true);
    try {
      const achados: Achado[] = [];
      const outros: File[] = [];
      for (const f of Array.from(files)) {
        if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
          const wb = XLSX.read(await f.arrayBuffer());
          const aoa = (XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as any[][]).map((r) => r.map((c) => String(c ?? '').trim()));
          const hi = aoa.findIndex((r) => r.some((c) => /nome|funcion|empregad|colaborador/i.test(c)));
          if (hi < 0) { toast.error(`${f.name}: coluna de nome não encontrada.`); continue; }
          const h = aoa[hi].map(norm);
          const iN = h.findIndex((x) => /nome|funcion|empregad|colaborador/.test(x));
          const iC = h.findIndex((x) => /^(cod|matr)/.test(x));
          const iG = h.findIndex((x) => /cargo|funcao/.test(x) && !/funcionario/.test(x));
          for (const r of aoa.slice(hi + 1)) {
            const n = r[iN]; if (!n || /^total/i.test(n) || !/[a-z]/i.test(n)) continue;
            achados.push({ nome: n, codigo: iC >= 0 ? String(r[iC] || '').replace(/\D/g, '') : '', cargo: iG >= 0 ? r[iG] : '' });
          }
        } else outros.push(f);
      }
      if (outros.length) {
        const arquivos: { dataUrl: string }[] = []; const textos: string[] = [];
        for (const x of outros.slice(0, 8)) {
          if (x.size > 15 * 1024 * 1024) { toast.error(`${x.name}: acima de 15 MB.`); continue; }
          arquivos.push({ dataUrl: await toDataUrl(x) });
          if (/\.pdf$/i.test(x.name) || x.type === 'application/pdf') {
            try { for (const p of await lerPdf(x, 30, false)) if (textoConfiavel(p.texto)) textos.push(p.texto); } catch { /* segue com imagem */ }
          }
        }
        if (arquivos.length) {
          const { data, error } = await supabase.functions.invoke('conversor-extrair-tabela', { body: { arquivos, conhecidos: [], textos } });
          if (error || data?.error) throw new Error(data?.error || error?.message);
          for (const l of data?.lancamentos || []) if (l?.nome) achados.push({ nome: String(l.nome), codigo: String(l.codigo || '') });
        }
      }
      const vistos = new Set(atuais.map((f) => norm(f.nome)).filter(Boolean));
      const novos: EscalaFuncionario[] = [];
      for (const a of achados) {
        const k = norm(a.nome); if (!k || vistos.has(k)) continue; vistos.add(k);
        novos.push({ ...novoFuncionario(), nome: a.nome.trim(), codigo: a.codigo, cargo: a.cargo || '' });
      }
      if (!novos.length) return toast.info('Nenhum funcionário novo encontrado no extrato.');
      onImportar([...atuais.filter((f) => f.nome.trim()), ...novos]);
      toast.success(`${novos.length} funcionário(s) importado(s). Confira nomes, sexo e horários.`);
    } catch (e: any) { toast.error(e.message || 'Falha na leitura do extrato'); }
    finally { setLendo(false); if (ref.current) ref.current.value = ''; }
  };

  return (<>
    <input ref={ref} type="file" multiple hidden accept=".pdf,.xlsx,.xls,.csv,image/*" onChange={(e) => ler(e.target.files)} />
    <Button size="sm" variant="outline" disabled={lendo} onClick={() => ref.current?.click()}>
      {lendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileUp className="w-4 h-4 mr-1" />}Subir extrato
    </Button>
  </>);
}
