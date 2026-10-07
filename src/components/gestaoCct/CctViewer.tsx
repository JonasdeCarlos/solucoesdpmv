import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { lerPdf, textoConfiavel } from '@/modules/conversor-dominio/utils/pdfTexto';

interface Props { analysisId: string; ocrText?: string | null; originalPath?: string | null; originalName?: string | null; height?: number }

export default function CctViewer({ analysisId, ocrText, originalPath, originalName, height = 640 }: Props) {
  const [files, setFiles] = useState<{ name: string; url: string; path: string }[]>([]);
  const [sel, setSel] = useState(0);
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState(ocrText || '');
  const [extraindo, setExtraindo] = useState(false);
  const tentou = useRef(false);

  useEffect(() => { setTexto(ocrText || ''); tentou.current = false; }, [ocrText, analysisId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cct_analysis_files' as any).select('file_path,file_name').eq('cct_analysis_id', analysisId).order('order_index');
      let list = ((data || []) as any[]).map((f) => ({ path: f.file_path, name: f.file_name }));
      if (!list.length && originalPath) list = [{ path: originalPath, name: originalName || 'CCT' }];
      const out: { name: string; url: string; path: string }[] = [];
      for (const f of list) {
        const { data: s } = await supabase.storage.from('cct-docs').createSignedUrl(f.path, 3600);
        if (s?.signedUrl) out.push({ name: f.name, url: s.signedUrl, path: f.path });
      }
      setFiles(out);
    })();
  }, [analysisId, originalPath, originalName]);

  // Se ainda não há texto integral, extrai no navegador de TODOS os PDFs anexados e grava na CCT.
  useEffect(() => {
    if (texto || !files.length || tentou.current) return;
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    tentou.current = true;
    (async () => {
      setExtraindo(true);
      try {
        const partes: string[] = [];
        for (const f of pdfs) {
          try {
            const blob = await (await fetch(f.url)).blob();
            const paginas = await lerPdf(new File([blob], f.name), 200, false);
            const t = paginas.map((p) => p.texto).join('\n');
            if (textoConfiavel(t)) partes.push(`=== ARQUIVO: ${f.name} ===\n${t}`);
          } catch { /* ignora arquivo com falha */ }
        }
        const full = partes.join('\n\n').slice(0, 500000);
        if (full.length > 80) {
          setTexto(full);
          await supabase.from('cct_analyses' as any).update({ ocr_text: full } as any).eq('id', analysisId);
        }
      } finally {
        setExtraindo(false);
      }
    })();
  }, [files, texto, analysisId]);

  const partes = useMemo(() => {
    const t = texto || '';
    const b = busca.trim();
    if (!b) return [{ txt: t, hit: false }];
    const re = new RegExp(`(${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return t.split(re).map((p, i) => ({ txt: p, hit: i % 2 === 1 }));
  }, [texto, busca]);
  const hits = partes.filter((p) => p.hit).length;
  const atual = files[sel];
  const isPdf = atual && /\.pdf$/i.test(atual.name);

  return (
    <Tabs defaultValue={files.length || !texto ? 'doc' : 'texto'}>
      <TabsList>
        <TabsTrigger value="doc">Documento</TabsTrigger>
        <TabsTrigger value="texto">Texto integral</TabsTrigger>
      </TabsList>
      <TabsContent value="doc" className="space-y-2">
        {files.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p> : (
          <>
            <div className="flex flex-wrap gap-1 items-center">
              {files.map((f, i) => <Button key={i} size="sm" variant={i === sel ? 'default' : 'outline'} onClick={() => setSel(i)}>{f.name}</Button>)}
              <Button size="sm" variant="ghost" onClick={() => window.open(atual.url, '_blank')}><ExternalLink className="w-4 h-4" />Abrir em nova aba</Button>
            </div>
            {isPdf
              ? <embed key={atual.url} src={`${atual.url}#toolbar=1`} type="application/pdf" className="w-full rounded border" style={{ height }} />
              : /\.(png|jpe?g|webp)$/i.test(atual.name)
                ? <img src={atual.url} alt={atual.name} className="max-w-full rounded border" />
                : <p className="text-sm text-muted-foreground">Pré-visualização indisponível para este formato. Use "Abrir em nova aba".</p>}
          </>
        )}
      </TabsContent>
      <TabsContent value="texto" className="space-y-2">
        {extraindo ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Lendo o texto de todos os anexos…</p>
        ) : !texto ? <p className="text-sm text-muted-foreground">Texto ainda não extraído. Rode "Analisar com IA".</p> : (
          <>
            <div className="flex gap-2 items-center">
              <Input placeholder="Buscar no texto (ex.: REPIS)" value={busca} onChange={(e) => setBusca(e.target.value)} />
              {busca && <span className="text-xs text-muted-foreground whitespace-nowrap">{hits} ocorrência(s)</span>}
            </div>
            <div className="rounded border p-3 text-sm whitespace-pre-wrap overflow-y-auto" style={{ height }}>
              {partes.map((p, i) => p.hit ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p.txt}</mark> : <span key={i}>{p.txt}</span>)}
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
