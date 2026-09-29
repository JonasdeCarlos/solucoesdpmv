import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilePlus, Save, Send, FileDown, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { tbl, shiftComp, competenciaAtual, type Catalogo, type Politica } from '../hooks/usePremiacao';
import { textoRegulamento, tituloRegulamento, fmtData } from '../utils/textos';
import { pdfRegulamento } from '../utils/pdfs';

export default function RegulamentoTab({ politica, cat, empresa, razaoSocial }: { politica: Politica; cat: Catalogo; empresa: string; razaoSocial: string }) {
  const [selId, setSelId] = useState('');
  const sel = cat.versoes.find(v => v.id === selId) || cat.versoes[0] || null;
  const [texto, setTexto] = useState('');
  const [vig, setVig] = useState('');
  useEffect(() => { if (sel) { setTexto(sel.texto); setVig(sel.vigencia_inicio); } }, [sel?.id]);

  const nova = async () => {
    const versao = (cat.versoes[0]?.versao || 0) + 1;
    // efeitos só a partir da competência seguinte à publicação
    const vigencia = `${shiftComp(competenciaAtual(), 1)}-01`;
    const { data, error } = await tbl('premiacao_regulamento_versoes').insert({ politica_id: politica.id, versao, texto: textoRegulamento(razaoSocial || 'empresa', politica), vigencia_inicio: vigencia }).select('*').single();
    if (error) return toast.error(error.message);
    await cat.reload(); setSelId(data.id); toast.success(`Versão ${versao} criada com os catálogos vigentes.`);
  };
  const salvar = async () => {
    const { error } = await tbl('premiacao_regulamento_versoes').update({ texto, vigencia_inicio: vig }).eq('id', sel!.id);
    if (error) toast.error(error.message); else { toast.success('Salvo.'); cat.reload(); }
  };
  const publicar = async () => {
    if (!confirm(`Publicar a versão ${sel!.versao}? Vigência a partir de ${fmtData(vig)}.`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await tbl('premiacao_regulamento_versoes').update({ texto, vigencia_inicio: vig, publicado_em: new Date().toISOString(), publicado_por: user?.id || null }).eq('id', sel!.id);
    if (error) toast.error(error.message); else { toast.success('Regulamento publicado.'); cat.reload(); }
  };
  const pdf = (colabId?: string) => {
    const c = colabId ? cat.colaboradores.find(x => x.id === colabId) : undefined;
    pdfRegulamento({ politica, cat, versao: { ...sel!, texto, vigencia_inicio: vig }, empresa, colaborador: c }).save(`regulamento-v${sel!.versao}${c ? '-' + c.nome.replace(/\s+/g, '_') : ''}.pdf`);
  };
  const registrar = async (colaborador_id: string, forma: 'aceite_digital' | 'assinatura_fisica', file?: File) => {
    let anexo: string | null = null;
    if (file) {
      const path = `premiacao/${politica.id}/ciencias/${sel!.id}/${colaborador_id}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('cliente-dp-uploads').upload(path, file, { upsert: true });
      if (up.error) return toast.error(up.error.message);
      anexo = path;
    }
    const { error } = await tbl('premiacao_ciencias').upsert({ colaborador_id, versao_regulamento_id: sel!.id, forma, anexo_url: anexo, data_ciencia: new Date().toISOString().slice(0, 10) }, { onConflict: 'colaborador_id,versao_regulamento_id' });
    if (error) toast.error(error.message); else { toast.success('Ciência registrada.'); cat.reload(); }
  };
  const abrir = async (p: string) => { const { data } = await supabase.storage.from('cliente-dp-uploads').createSignedUrl(p, 300); if (data?.signedUrl) window.open(data.signedUrl, '_blank'); };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-2 items-end flex-wrap">
        {cat.versoes.length > 0 && (
          <Select value={sel?.id || ''} onValueChange={setSelId}><SelectTrigger className="w-64 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{cat.versoes.map(v => <SelectItem key={v.id} value={v.id}>Versão {v.versao} {v.publicado_em ? '(publicada)' : '(rascunho)'}</SelectItem>)}</SelectContent></Select>
        )}
        <Button size="sm" variant="outline" onClick={nova}><FilePlus className="w-3 h-3 mr-1" />Gerar nova versão</Button>
      </div>
      {sel && (
        <>
          <p className="text-sm font-semibold">{tituloRegulamento(sel.versao, vig || sel.vigencia_inicio)}</p>
          <div className="flex gap-2 items-end">
            <div><Label className="text-xs">Vigência a partir de</Label><Input type="date" className="h-8" value={vig} onChange={e => setVig(e.target.value)} disabled={!!sel.publicado_em} /></div>
            {sel.publicado_em && <Badge>Publicada em {fmtData(sel.publicado_em)}</Badge>}
          </div>
          <Textarea rows={16} className="text-sm" value={texto} onChange={e => setTexto(e.target.value)} disabled={!!sel.publicado_em} />
          <p className="text-xs text-muted-foreground">No PDF, após o texto entram os quadros de referências por função, medalhas, metas e desabonos vigentes e o termo de ciência.</p>
          <div className="flex gap-2">
            {!sel.publicado_em && <Button size="sm" variant="outline" onClick={salvar}><Save className="w-3 h-3 mr-1" />Salvar</Button>}
            {!sel.publicado_em && <Button size="sm" onClick={publicar}><Send className="w-3 h-3 mr-1" />Publicar</Button>}
            <Button size="sm" variant="outline" onClick={() => pdf()}><FileDown className="w-3 h-3 mr-1" />PDF para assinatura</Button>
          </div>
          {sel.publicado_em && (
            <>
              <h4 className="font-semibold text-sm pt-2">Ciência dos colaboradores — versão {sel.versao}</h4>
              <Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Função</TableHead><TableHead>Ciência</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                <TableBody>{cat.colaboradores.filter(c => c.ativo).map(c => {
                  const ci = cat.ciencias.find(x => x.colaborador_id === c.id && x.versao_regulamento_id === sel.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.nome}</TableCell><TableCell>{cat.funcaoDe(c)}</TableCell>
                      <TableCell>{ci ? <span className="text-sm"><Check className="w-4 h-4 inline text-primary" /> {fmtData(ci.data_ciencia)} — {ci.forma === 'aceite_digital' ? 'aceite digital' : 'assinatura física'}{ci.anexo_url && <button className="underline ml-1" onClick={() => abrir(ci.anexo_url!)}>ver</button>}</span> : <Badge variant="outline" className="text-amber-700 border-amber-400">Pendente</Badge>}</TableCell>
                      <TableCell className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => pdf(c.id)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
                        <Button size="sm" variant="ghost" onClick={() => registrar(c.id, 'aceite_digital')}><Check className="w-3 h-3 mr-1" />Aceite digital</Button>
                        <label className="inline-flex items-center text-xs cursor-pointer px-2 hover:underline"><Upload className="w-3 h-3 mr-1" />Assinado
                          <input type="file" hidden accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && registrar(c.id, 'assinatura_fisica', e.target.files[0])} /></label>
                      </TableCell>
                    </TableRow>);
                })}</TableBody></Table>
            </>
          )}
        </>
      )}
      {!cat.versoes.length && <p className="text-sm text-muted-foreground">Nenhuma versão ainda. Clique em "Gerar nova versão".</p>}
    </div>
  );
}
