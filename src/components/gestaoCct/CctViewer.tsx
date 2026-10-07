import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface Props { analysisId: string; ocrText?: string | null; originalPath?: string | null; originalName?: string | null; height?: number }

export default function CctViewer({ analysisId, ocrText, originalPath, originalName, height = 640 }: Props) {
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [sel, setSel] = useState(0);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cct_analysis_files' as any).select('file_path,file_name').eq('cct_analysis_id', analysisId).order('order_index');
      let list = ((data || []) as any[]).map((f) => ({ path: f.file_path, name: f.file_name }));
      if (!list.length && originalPath) list = [{ path: originalPath, name: originalName || 'CCT' }];
      const out: { name: string; url: string }[] = [];
      for (const f of list) {
        const { data: s } = await supabase.storage.from('cct-docs').createSignedUrl(f.path, 3600);
        if (s?.signedUrl) out.push({ name: f.name, url: s.signedUrl });
      }
      setFiles(out);
    })();
  }, [analysisId, originalPath, originalName]);

  const partes = useMemo(() => {
    const t = ocrText || '';
    const b = busca.trim();
    if (!b) return [{ txt: t, hit: false }];
    const re = new RegExp(`(${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return t.split(re).map((p, i) => ({ txt: p, hit: i % 2 === 1 }));
  }, [ocrText, busca]);
  const hits = partes.filter((p) => p.hit).length;
  const atual = files[sel];
  const isPdf = atual && /\.pdf$/i.test(atual.name);

  return (
    <Tabs defaultValue={files.length || !ocrText ? 'doc' : 'texto'}>
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
        {!ocrText ? <p className="text-sm text-muted-foreground">Texto ainda não extraído. Rode "Analisar com IA".</p> : (
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
