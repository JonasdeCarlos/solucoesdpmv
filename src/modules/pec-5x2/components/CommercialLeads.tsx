import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Download, RefreshCw, MessageCircle } from 'lucide-react';
import { buildExternalAppLink } from '@/utils/publicLinks';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type Lead = { id: string; nome: string; email: string; whatsapp: string; empresa: string; etapa: string; created_at: string };
const etapas = ['novo', 'contatado', 'qualificado', 'convertido', 'encerrado'];
export default function CommercialLeads() {
  const [leads, setLeads] = useState<Lead[]>([]), [busca, setBusca] = useState(''), [erro, setErro] = useState('');
  const url = buildExternalAppLink('/pec-comercial');
  const load = async () => {
    setErro(''); const all: Lead[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('pec_commercial_leads').select('id,nome,email,whatsapp,empresa,etapa,created_at').order('created_at', { ascending: false }).range(offset, offset + 999);
      if (error) { setErro('Não foi possível carregar os contatos.'); return; }
      all.push(...(data || [])); if ((data || []).length < 1000) break;
    }
    setLeads(all);
  };
  useEffect(() => { load(); }, []);
  const filtered = leads.filter(l => `${l.nome} ${l.empresa} ${l.email} ${l.whatsapp}`.toLowerCase().includes(busca.toLowerCase()));
  const change = async (id: string, etapa: string) => {
    const { error } = await supabase.from('pec_commercial_leads').update({ etapa }).eq('id', id);
    if (error) { toast.error('Não foi possível salvar a etapa.'); return; }
    setLeads(ls => ls.map(l => l.id === id ? { ...l, etapa } : l));
  };
  const exportar = () => {
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(l => ({ Contato: l.nome, Empresa: l.empresa, Email: l.email, WhatsApp: l.whatsapp, Etapa: l.etapa, Cadastro: new Date(l.created_at).toLocaleString('pt-BR') }))), 'Contatos'); XLSX.writeFile(wb, 'Contatos_PEC_5x2.xlsx');
  };
  return <section className="space-y-4 py-4">
    <h2 className="text-lg font-semibold">Link comercial e funil de contatos</h2>
    <div className="flex gap-2"><Input readOnly aria-label="Link comercial" value={url} /><Button variant="outline" aria-label="Copiar link comercial" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success('Link comercial copiado'); } catch { toast.error('Copie o endereço exibido.'); } }}><Copy className="h-4 w-4" /></Button></div>
    <div className="flex flex-wrap gap-2 items-center"><Input className="max-w-sm" aria-label="Buscar contatos" placeholder="Buscar contato ou empresa" value={busca} onChange={e => setBusca(e.target.value)} /><Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button><Button variant="outline" onClick={exportar} disabled={!filtered.length}><Download className="h-4 w-4 mr-2" />Exportar contatos</Button><span className="text-sm text-muted-foreground">{filtered.length} contatos</span></div>
    {erro && <p className="text-destructive">{erro}</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{['Cadastro', 'Contato', 'Empresa', 'E-mail', 'WhatsApp', 'Etapa'].map(t => <th key={t} className="p-3 whitespace-nowrap">{t}</th>)}</tr></thead><tbody>{filtered.map(l => <tr key={l.id} className="border-b"><td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td><td className="p-3 min-w-48">{l.nome}</td><td className="p-3">{l.empresa}</td><td className="p-3"><a className="text-primary underline" href={`mailto:${encodeURIComponent(l.email)}`}>{l.email}</a></td><td className="p-3 whitespace-nowrap"><a className="inline-flex gap-2 items-center text-primary" href={`https://wa.me/${l.whatsapp.length <= 11 ? '55' : ''}${l.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />{l.whatsapp}</a></td><td className="p-3"><select aria-label={`Etapa de ${l.nome}`} className="border border-input rounded-md h-9 bg-background px-2" value={l.etapa} onChange={e => change(l.id, e.target.value)}>{etapas.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}</select></td></tr>)}</tbody></table>{!filtered.length && !erro && <p className="py-8 text-muted-foreground text-sm">Nenhum contato encontrado.</p>}</div>
  </section>;
}