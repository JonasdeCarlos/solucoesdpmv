import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Copy, AlertTriangle, Loader2, Trash2, Eye, Sparkles, Search } from 'lucide-react';
import { useCCTs } from '@/hooks/useSucessoCliente';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPisosCCT } from '@/utils/sucessoCliente/pisosCCT';

(pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await (pdfjs as any).getDocument({ data: buf.slice(0) }).promise;
  } catch {
    pdf = await (pdfjs as any).getDocument({ data: buf.slice(0), disableWorker: true }).promise;
  }
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return text;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

function PdfCanvasViewer({ data }: { data: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Carregando PDF…');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;

    const renderPdf = async () => {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';
      setError('');
      setStatus('Carregando PDF…');

      try {
        loadingTask = (pdfjs as any).getDocument({ data: data.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setStatus(`Renderizando ${pdf.numPages} página(s)…`);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(320, Math.min(container.clientWidth || 920, 1120) - 24);
          const scale = Math.min(1.75, Math.max(0.7, availableWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const outputScale = Math.max(1, window.devicePixelRatio || 1);

          const wrapper = document.createElement('div');
          wrapper.className = 'mx-auto mb-4 max-w-full rounded border bg-background p-2 shadow-sm';

          const label = document.createElement('div');
          label.className = 'mb-2 text-center text-xs text-muted-foreground';
          label.textContent = `Página ${pageNumber} de ${pdf.numPages}`;

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.maxWidth = '100%';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto';

          wrapper.appendChild(label);
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          const context = canvas.getContext('2d');
          if (!context) throw new Error('Não foi possível iniciar o renderizador do PDF.');
          await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          }).promise;
        }

        if (!cancelled) setStatus('');
      } catch (e: any) {
        if (!cancelled) {
          setStatus('');
          setError(e?.message || 'Não foi possível renderizar o PDF.');
        }
      }
    };

    renderPdf();
    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch { /* noop */ }
    };
  }, [data]);

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded border bg-muted/20 p-3">
      {(status || error) && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          {status && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{error || status}</span>
        </div>
      )}
      <div ref={containerRef} className="mx-auto w-full" />
    </div>
  );
}

export default function CCTTab({ client_id }: { client_id: string }) {
  const { items, reload } = useCCTs(client_id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [replicaOpen, setReplicaOpen] = useState(false);
  const [origemList, setOrigemList] = useState<any[]>([]);
  const [view, setView] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteResponsible, setDeleteResponsible] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pdfView, setPdfView] = useState<{ url: string; name: string; data: ArrayBuffer } | null>(null);
  const [pdfLoadingPath, setPdfLoadingPath] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  // Busca inteligente IA
  const [aiQuery, setAiQuery] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStage, setAiStage] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const textCacheRef = useRef<Map<string, string>>(new Map());

  const runAiSearch = async () => {
    const q = aiQuery.trim();
    if (q.length < 3) { toast.error('Descreva o tema (mín. 3 caracteres).'); return; }
    const ativos = items.filter((c: any) => !c.deleted_at && c.doc_path);
    if (ativos.length === 0) { toast.error('Nenhuma CCT disponível para busca.'); return; }
    setAiBusy(true);
    setAiResult(null);
    try {
      const docs: { id: string; sindicato: string; text: string }[] = [];
      for (let i = 0; i < ativos.length; i++) {
        const c: any = ativos[i];
        setAiStage(`Lendo CCT ${i + 1}/${ativos.length}…`);
        let text = textCacheRef.current.get(c.id) || '';
        if (!text) {
          try {
            const { data, error } = await supabase.storage.from('cliente-dp-uploads').download(c.doc_path);
            if (error || !data) throw error || new Error('download falhou');
            const name = String(c.doc_name || c.doc_path).toLowerCase();
            if (name.endsWith('.pdf')) {
              const buf = await data.arrayBuffer();
              let pdf;
              try { pdf = await (pdfjs as any).getDocument({ data: buf.slice(0) }).promise; }
              catch { pdf = await (pdfjs as any).getDocument({ data: buf.slice(0), disableWorker: true }).promise; }
              let acc = '';
              for (let p = 1; p <= pdf.numPages; p++) {
                const page = await pdf.getPage(p);
                const tc = await page.getTextContent();
                acc += tc.items.map((it: any) => it.str).join(' ') + '\n';
              }
              text = acc;
            } else {
              text = await data.text();
            }
          } catch (e) {
            text = '';
          }
          // fallback: complementa com resumo + cláusulas já extraídas
          if (text.trim().length < 200) {
            const clauses = Array.isArray(c.ai_clauses) ? c.ai_clauses.map((cl: any) => `${cl.titulo}: ${cl.descricao}\nTrecho: ${cl.trecho_base || ''}`).join('\n\n') : '';
            text = `${text}\n\nRESUMO: ${c.ai_summary || ''}\n\nCLÁUSULAS EXTRAÍDAS:\n${clauses}`;
          }
          textCacheRef.current.set(c.id, text);
        }
        docs.push({ id: c.id, sindicato: c.sindicato || 'CCT', text });
      }
      setAiStage('Analisando com IA…');
      const { data, error } = await supabase.functions.invoke('ai-buscar-cct', { body: { question: q, docs } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiResult(data);
    } catch (e: any) {
      toast.error('Falha na busca IA: ' + errorMessage(e));
    } finally {
      setAiBusy(false);
      setAiStage('');
    }
  };

  const pisosCCT = useMemo(() => extractPisosCCT(items as any[]), [items]);

  const errorMessage = (e: any) => {
    const contextError = e?.context?.error;
    return contextError || e?.message || e?.error_description || e?.details || String(e || 'erro desconhecido');
  };

  const handleUpload = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setStage('Lendo arquivo…');
    try {
      let text = '';
      let pdf_base64: string | undefined;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try { text = await extractPdfText(file); } catch { text = ''; }
        const letters = (text.match(/[a-zA-ZÀ-ú]/g) || []).length;
        if (text.trim().length < 500 || letters < 100) {
          setStage('PDF sem texto — preparando OCR…');
          pdf_base64 = await fileToBase64(file);
        }
      } else {
        text = await file.text();
      }
      if (!text.trim() && !pdf_base64) throw new Error('Não foi possível ler o arquivo. Envie um PDF ou TXT válido.');
      const safeName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_');
      const path = `${client_id}/cct/${Date.now()}_${safeName}`;
      setStage('Enviando arquivo…');
      const { error: uploadError } = await supabase.storage.from('cliente-dp-uploads').upload(path, file);
      if (uploadError) throw uploadError;
      setStage(pdf_base64 ? 'OCR + resumo IA…' : 'Gerando resumo IA…');
      const { data, error } = await supabase.functions.invoke('ai-resumo-cct', { body: { text, pdf_base64 } });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      if (!r?.summary || !Array.isArray(r?.clauses) || r.clauses.length === 0) {
        throw new Error('A IA não encontrou informações comprovadas da CCT neste arquivo.');
      }
      setStage('Salvando CCT…');
      const lab = r.sindicato_laboral || {};
      const pat = r.sindicato_patronal || {};
      const { error: insertError } = await supabase.from('client_ccts' as any).insert({
        client_id, union_base: r.union_base || '', sindicato: r.sindicato || '', uf: r.uf || '',
        data_base: r.data_base || '', validity_start: r.validity_start || null, validity_end: r.validity_end || null,
        doc_path: path, doc_name: file.name, ai_summary: r.summary || '', ai_clauses: r.clauses || [],
        version: items.length + 1, is_active: true, codigo_sindicato_dominio: '',
        instrumento_tipo: r.instrumento_tipo || '',
        numero_registro_mte: r.numero_registro_mte || '',
        abrangencia_territorial: r.abrangencia_territorial || '',
        categoria_abrangida: r.categoria_abrangida || '',
        sindicato_laboral_nome: lab.nome || '',
        sindicato_laboral_cnpj: lab.cnpj || '',
        sindicato_laboral_endereco: lab.endereco || '',
        sindicato_laboral_representante: lab.representante || '',
        sindicato_patronal_nome: pat.nome || '',
        sindicato_patronal_cnpj: pat.cnpj || '',
        sindicato_patronal_endereco: pat.endereco || '',
        sindicato_patronal_representante: pat.representante || '',
      } as any);
      if (insertError) throw insertError;
      toast.success('CCT processada pela IA.');
      reload();
    } catch (e: any) {
      toast.error('Erro ao enviar CCT: ' + errorMessage(e));
    } finally {
      setBusy(false);
      setStage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 5) { toast.error('Justificativa obrigatória (mín. 5 caracteres).'); return; }
    if (deleteResponsible.trim().length < 3) { toast.error('Informe o responsável pela exclusão.'); return; }
    setDeleting(true);
    const { error } = await supabase.from('client_ccts' as any).update({
      deleted_at: new Date().toISOString(),
      deleted_by: deleteResponsible.trim(),
      deletion_reason: deleteReason.trim(),
      is_active: false,
    } as any).eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    toast.success('CCT excluída com registro de justificativa.');
    setDeleteTarget(null); setDeleteReason(''); setDeleteResponsible('');
    reload();
  };

  const openReplica = async (sindicato: string) => {
    const { data } = await supabase.from('client_ccts' as any).select('*, clientes:client_id(nome)').eq('sindicato', sindicato).neq('client_id', client_id).order('created_at', { ascending: false });
    setOrigemList((data || []) as any);
    setReplicaOpen(true);
  };

  const openReplicaAll = async () => {
    const { data } = await supabase
      .from('client_ccts' as any)
      .select('*, clientes:client_id(nome)')
      .neq('client_id', client_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setOrigemList((data || []) as any);
    setReplicaOpen(true);
  };

  const replicar = async (origem: any) => {
    await supabase.from('client_ccts' as any).insert({
      client_id, union_base: origem.union_base, sindicato: origem.sindicato, uf: origem.uf,
      data_base: origem.data_base, validity_start: origem.validity_start, validity_end: origem.validity_end,
      doc_path: origem.doc_path, doc_name: origem.doc_name + ' (replicada)', ai_summary: origem.ai_summary,
      ai_clauses: origem.ai_clauses, version: items.length + 1, is_active: true,
      codigo_sindicato_dominio: origem.codigo_sindicato_dominio || '',
    } as any);
    toast.success('CCT replicada.');
    setReplicaOpen(false); reload();
  };

  const updateCodigo = async (id: string, codigo: string) => {
    const { error } = await supabase.from('client_ccts' as any).update({ codigo_sindicato_dominio: codigo } as any).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    reload();
  };

  const daysToEnd = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  const openPdf = async (c: any) => {
    if (!c.doc_path) { toast.error('Arquivo original não disponível.'); return; }
    if (!String(c.doc_name || c.doc_path).toLowerCase().endsWith('.pdf')) {
      toast.error('A visualização integrada está disponível apenas para arquivos PDF.');
      return;
    }
    try {
      setPdfLoadingPath(c.doc_path);
      const { data, error } = await supabase.storage
        .from('cliente-dp-uploads')
        .download(c.doc_path);
      if (error || !data) throw error || new Error('arquivo não encontrado');
      if (pdfView?.url) URL.revokeObjectURL(pdfView.url);
      const pdfBlob = data.type === 'application/pdf' ? data : new Blob([data], { type: 'application/pdf' });
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const url = URL.createObjectURL(pdfBlob);
      setPdfView({ url, name: c.doc_name || 'CCT.pdf', data: arrayBuffer });
    } catch (e: any) {
      toast.error('Erro ao carregar PDF: ' + (e?.message || 'desconhecido'));
    } finally {
      setPdfLoadingPath(null);
    }
  };

  const notificarVencimentos = async () => {
    setNotifyBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('cct-aviso-vencimento', { body: { client_id } });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      toast.success(r?.message || `Aviso enviado para ${r?.enviados || 0} destinatário(s).`);
    } catch (e: any) {
      toast.error('Falha ao notificar: ' + (e?.message || 'erro'));
    } finally { setNotifyBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-end gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e)=>e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Upload className="w-4 h-4 mr-1"/>}
          {busy ? 'Processando…' : 'Enviar CCT (IA resume)'}
        </Button>
        {stage && <span className="text-sm text-muted-foreground">{stage}</span>}
        {items[0]?.sindicato && <Button variant="outline" onClick={()=>openReplica(items[0].sindicato)}><Copy className="w-4 h-4 mr-1"/>Replicar de outro cliente</Button>}
        <Button type="button" variant="outline" onClick={openReplicaAll}>
          <Copy className="w-4 h-4 mr-1"/>Usar CCT de outra empresa
        </Button>
        <Button type="button" variant="outline" onClick={notificarVencimentos} disabled={notifyBusy}>
          {notifyBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <AlertTriangle className="w-4 h-4 mr-1"/>}
          Avisar vencimento por e-mail
        </Button>
      </CardContent></Card>

      {pisosCCT.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm">Pisos por cargo evidenciados na CCT ({pisosCCT.length})</div>
              <span className="text-[11px] text-muted-foreground">Reaproveitados automaticamente na aba Cargos &amp; Salários.</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs border">
                <thead className="bg-muted"><tr>
                  <th className="p-2 text-left">Cargo / Função</th>
                  <th className="p-2 text-left">Grupo</th>
                  <th className="p-2 text-right">Piso (R$)</th>
                  <th className="p-2 text-left">Referência</th>
                </tr></thead>
                <tbody>
                  {pisosCCT.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{p.funcao || '—'}</td>
                      <td className="p-2">{p.grupo || '—'}</td>
                      <td className="p-2 text-right">{p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-muted-foreground">{p.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.filter((c: any) => !c.deleted_at).map(c => {
          const d = daysToEnd(c.validity_end);
          const alert = d !== null && d <= 90;
          return (
            <Card key={c.id} className={alert ? 'border-amber-500' : ''}><CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold flex items-center gap-2"><FileText className="w-4 h-4"/>{c.sindicato || 'Sindicato'}</div>
                  <div className="text-xs text-muted-foreground">{c.union_base} {c.uf && '• ' + c.uf} • Data-base: {c.data_base || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.validity_end && <Badge variant={alert ? 'destructive' : 'outline'}>Vence: {new Date(c.validity_end).toLocaleDateString('pt-BR')}{d!==null && ` (${d}d)`}</Badge>}
                  {alert && <AlertTriangle className="w-4 h-4 text-amber-500"/>}
                  <Button size="sm" variant="outline" onClick={()=>setView(c)}>Ver resumo</Button>
                  <Button size="sm" variant="outline" onClick={()=>openPdf(c)} disabled={pdfLoadingPath === c.doc_path}>
                    {pdfLoadingPath === c.doc_path ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Eye className="w-4 h-4 mr-1"/>}
                    Ver PDF
                  </Button>
                  <Button size="sm" variant="destructive" onClick={()=>setDeleteTarget(c)}><Trash2 className="w-4 h-4"/></Button>
                </div>
              </div>
              <div className="flex items-end gap-2 pt-2 border-t">
                <div className="flex-1 max-w-xs">
                  <Label className="text-xs">Código do Sindicato na Domínio</Label>
                  <Input
                    defaultValue={(c as any).codigo_sindicato_dominio || ''}
                    placeholder="ex.: 12345"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== ((c as any).codigo_sindicato_dominio || '')) updateCodigo(c.id, v);
                    }}
                  />
                </div>
              </div>
            </CardContent></Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma CCT cadastrada.</p>}
      </div>

      <Dialog open={!!view} onOpenChange={()=>setView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>{view?.sindicato} — Resumo IA</DialogTitle></DialogHeader>
          {view && <div className="space-y-3">
            <div className="border rounded p-3 bg-muted/30 space-y-3 text-sm">
              <div>
                <h4 className="font-bold mb-1">Preâmbulo — Cadastro</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div><span className="text-muted-foreground">Instrumento:</span> {view.instrumento_tipo || '—'}</div>
                  <div><span className="text-muted-foreground">Nº registro MTE:</span> {view.numero_registro_mte || '—'}</div>
                  <div><span className="text-muted-foreground">Data-base:</span> {view.data_base || '—'}</div>
                  <div><span className="text-muted-foreground">UF:</span> {view.uf || '—'}</div>
                  <div><span className="text-muted-foreground">Vigência:</span> {view.validity_start ? new Date(view.validity_start).toLocaleDateString('pt-BR') : '—'} a {view.validity_end ? new Date(view.validity_end).toLocaleDateString('pt-BR') : '—'}</div>
                  <div><span className="text-muted-foreground">Abrangência:</span> {view.abrangencia_territorial || view.union_base || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Categoria abrangida:</span> {view.categoria_abrangida || '—'}</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="border rounded p-2 bg-background">
                  <h4 className="font-bold mb-1">Sindicato Laboral (Trabalhadores)</h4>
                  <div className="space-y-0.5">
                    <div><span className="text-muted-foreground">Nome:</span> {view.sindicato_laboral_nome || view.sindicato || '—'}</div>
                    <div><span className="text-muted-foreground">CNPJ:</span> {view.sindicato_laboral_cnpj || '—'}</div>
                    <div><span className="text-muted-foreground">Endereço:</span> {view.sindicato_laboral_endereco || '—'}</div>
                    <div><span className="text-muted-foreground">Representante:</span> {view.sindicato_laboral_representante || '—'}</div>
                  </div>
                </div>
                <div className="border rounded p-2 bg-background">
                  <h4 className="font-bold mb-1">Sindicato Patronal (Empregador)</h4>
                  <div className="space-y-0.5">
                    <div><span className="text-muted-foreground">Nome:</span> {view.sindicato_patronal_nome || '—'}</div>
                    <div><span className="text-muted-foreground">CNPJ:</span> {view.sindicato_patronal_cnpj || '—'}</div>
                    <div><span className="text-muted-foreground">Endereço:</span> {view.sindicato_patronal_endereco || '—'}</div>
                    <div><span className="text-muted-foreground">Representante:</span> {view.sindicato_patronal_representante || '—'}</div>
                  </div>
                </div>
              </div>
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={()=>openPdf(view)} disabled={pdfLoadingPath === view.doc_path}>
                  {pdfLoadingPath === view.doc_path ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Eye className="w-4 h-4 mr-1"/>}
                  Abrir CCT na íntegra (PDF)
                </Button>
              </div>
            </div>
            <h4 className="font-bold text-sm">Resumo</h4>
            <p className="text-sm whitespace-pre-wrap">{view.ai_summary}</p>
            <h4 className="font-bold text-sm">Cláusulas-chave</h4>
            <ul className="space-y-2">
              {(view.ai_clauses || []).map((cl: any, i: number) => (
                <li key={i} className="border-l-2 border-primary pl-3 text-sm">
                  <strong>{cl.titulo}:</strong> {cl.descricao}
                </li>
              ))}
            </ul>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={replicaOpen} onOpenChange={setReplicaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Replicar CCT</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {origemList.map((o: any) => (
              <Card key={o.id}><CardContent className="p-3 flex justify-between items-center">
                <div><div className="font-medium text-sm">{(o.clientes as any)?.nome}</div><div className="text-xs text-muted-foreground">{o.sindicato} • {new Date(o.created_at).toLocaleDateString('pt-BR')}</div></div>
                <Button size="sm" onClick={()=>replicar(o)}>Replicar</Button>
              </CardContent></Card>
            ))}
            {origemList.length === 0 && <p className="text-sm text-muted-foreground">Sem CCTs disponíveis da mesma base sindical.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o)=>{ if(!o){ setDeleteTarget(null); setDeleteReason(''); setDeleteResponsible(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir CCT — {deleteTarget?.sindicato}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Esta ação fica registrada com justificativa e responsável. Os dois campos são obrigatórios.</p>
            <div>
              <Label>Responsável pela exclusão *</Label>
              <Input value={deleteResponsible} onChange={(e)=>setDeleteResponsible(e.target.value)} placeholder="Nome completo"/>
            </div>
            <div>
              <Label>Justificativa *</Label>
              <Textarea value={deleteReason} onChange={(e)=>setDeleteReason(e.target.value)} placeholder="Motivo da exclusão" rows={4}/>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin"/>}Confirmar exclusão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdfView} onOpenChange={(o)=>{ if(!o && pdfView){ URL.revokeObjectURL(pdfView.url); setPdfView(null); } }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{pdfView?.name}</span>
              {pdfView && (
                <a
                  href={pdfView.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-primary shrink-0"
                >
                  Abrir em nova aba
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {pdfView && (
            <PdfCanvasViewer data={pdfView.data} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}