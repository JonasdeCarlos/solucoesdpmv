import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadBranding } from '@/utils/sucessoCliente/perfilPdf';
import { toast } from 'sonner';

const TIPO_FOLHA_LABEL: Record<string, string> = {
  pro_labore: 'Pró-labore',
  folha_sem_variaveis: 'Sem variáveis',
  folha_com_variaveis: 'Com variáveis',
};

type Row = any;

export default function SucessoClienteReportsPage() {
  const nav = useNavigate();
  const [clientes, setClientes] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [ccts, setCcts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // filtros
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ativo');
  const [tipo, setTipo] = useState('todos'); // PJ/PF
  const [tipoFolha, setTipoFolha] = useState('todos');
  const [segmento, setSegmento] = useState('todos');
  const [gestor, setGestor] = useState('todos');
  const [sindicato, setSindicato] = useState('todos');
  const [previa, setPrevia] = useState('todos'); // sim/nao
  const [pontoTipo, setPontoTipo] = useState('todos'); // eletronico/manual/sem

  useEffect(() => { (async () => {
    setLoading(true);
    const [c, p, k] = await Promise.all([
      supabase.from('clientes' as any).select('*').order('nome'),
      supabase.from('client_dp_profile' as any).select('*'),
      supabase.from('client_ccts' as any).select('*').eq('is_active', true),
    ]);
    setClientes((c.data || []) as any);
    const pmap: any = {}; ((p.data as any[]) || []).forEach((r) => { pmap[r.client_id] = r; });
    setProfiles(pmap);
    const cmap: any = {}; ((k.data as any[]) || []).forEach((r) => { (cmap[r.client_id] ||= []).push(r); });
    setCcts(cmap);
    setLoading(false);
  })(); }, []);

  const opcoes = useMemo(() => {
    const seg = new Set<string>(), ges = new Set<string>(), sind = new Set<string>();
    clientes.forEach((c) => { if (c.segmento) seg.add(c.segmento); if (c.gestor_carteira) ges.add(c.gestor_carteira); });
    Object.values(ccts).flat().forEach((x: any) => { if (x.sindicato) sind.add(x.sindicato); });
    return {
      segmentos: Array.from(seg).sort((a,b)=>a.localeCompare(b,'pt-BR')),
      gestores: Array.from(ges).sort((a,b)=>a.localeCompare(b,'pt-BR')),
      sindicatos: Array.from(sind).sort((a,b)=>a.localeCompare(b,'pt-BR')),
    };
  }, [clientes, ccts]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return clientes.filter((c) => {
      const prof = profiles[c.id];
      const cct = ccts[c.id] || [];
      if (status !== 'todos' && c.status !== status) return false;
      if (tipo !== 'todos' && c.tipo !== tipo) return false;
      if (tipoFolha !== 'todos' && (c.tipo_folha || '') !== tipoFolha) return false;
      if (segmento !== 'todos' && (c.segmento || '') !== segmento) return false;
      if (gestor !== 'todos' && (c.gestor_carteira || '') !== gestor) return false;
      if (sindicato !== 'todos' && !cct.some((x: any) => x.sindicato === sindicato)) return false;
      if (previa !== 'todos') {
        const has = !!prof?.needs_preview;
        if (previa === 'sim' && !has) return false;
        if (previa === 'nao' && has) return false;
      }
      if (pontoTipo !== 'todos') {
        if (pontoTipo === 'sem') { if (prof?.has_timeclock) return false; }
        else { if (!prof?.has_timeclock || prof?.timeclock_type !== pontoTipo) return false; }
      }
      if (s) {
        const blob = `${c.nome} ${c.cnpj} ${c.cpf} ${c.codigo_cliente} ${c.nome_fantasia} ${c.municipio}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [clientes, profiles, ccts, q, status, tipo, tipoFolha, segmento, gestor, sindicato, previa, pontoTipo]);

  const filtrosResumo = useMemo(() => {
    const r: string[] = [];
    if (status !== 'todos') r.push(`Status: ${status}`);
    if (tipo !== 'todos') r.push(`Tipo: ${tipo}`);
    if (tipoFolha !== 'todos') r.push(`Folha: ${TIPO_FOLHA_LABEL[tipoFolha] || tipoFolha}`);
    if (segmento !== 'todos') r.push(`Segmento: ${segmento}`);
    if (gestor !== 'todos') r.push(`Gestor: ${gestor}`);
    if (sindicato !== 'todos') r.push(`Sindicato: ${sindicato}`);
    if (previa !== 'todos') r.push(`Prévia: ${previa}`);
    if (pontoTipo !== 'todos') r.push(`Ponto: ${pontoTipo}`);
    if (q.trim()) r.push(`Busca: ${q.trim()}`);
    return r;
  }, [status, tipo, tipoFolha, segmento, gestor, sindicato, previa, pontoTipo, q]);

  const exportPdf = async () => {
    const branding = await loadBranding();
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const W = doc.internal.pageSize.getWidth();
    const primary = branding?.primary_color || '#628E3F';
    const [pr, pg, pb] = [parseInt(primary.slice(1,3),16), parseInt(primary.slice(3,5),16), parseInt(primary.slice(5,7),16)];
    doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,60,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16);
    doc.text(branding?.office_name || 'Sucesso do Cliente — DP', 30, 28);
    doc.setFontSize(11); doc.text('Relatório de Clientes', 30, 48);
    doc.setFontSize(9); doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, W-30, 28, { align: 'right' });
    doc.text(`${filtered.length} cliente(s)`, W-30, 48, { align: 'right' });

    doc.setTextColor(0,0,0); doc.setFontSize(9);
    let y = 76;
    if (filtrosResumo.length) {
      doc.setFont('helvetica','bold'); doc.text('Filtros:', 30, y);
      doc.setFont('helvetica','normal'); doc.text(filtrosResumo.join('  •  '), 75, y, { maxWidth: W-100 });
      y += 14;
    }

    autoTable(doc, {
      startY: y + 4,
      head: [['Código','Razão Social','Tipo','CNPJ/CPF','Município/UF','Segmento','Gestor','Tipo Folha','Prévia','Ponto','Sindicato']],
      body: filtered.map((c) => {
        const prof = profiles[c.id];
        const cct = (ccts[c.id] || []).map((x: any) => x.sindicato).filter(Boolean).join('; ');
        return [
          c.codigo_cliente || '—',
          c.nome,
          c.tipo,
          c.tipo === 'PJ' ? c.cnpj : c.cpf,
          `${c.municipio || ''}${c.uf ? '/'+c.uf : ''}`,
          c.segmento || '—',
          c.gestor_carteira || '—',
          TIPO_FOLHA_LABEL[c.tipo_folha] || '—',
          prof?.needs_preview ? 'Sim' : 'Não',
          prof?.has_timeclock ? (prof.timeclock_type || 'sim') : 'Sem',
          cct || '—',
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [pr,pg,pb], textColor: 255 },
      alternateRowStyles: { fillColor: [245,247,242] },
    });
    doc.save(`relatorio-clientes-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success('PDF gerado.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={()=>nav('/sucesso-cliente')} className="mb-1"><ChevronLeft className="w-4 h-4"/>Voltar</Button>
          <h2 className="text-2xl font-bold">Relatórios — Sucesso do Cliente</h2>
          <p className="text-sm text-muted-foreground">Aplique filtros e exporte em PDF.</p>
        </div>
        <Button onClick={exportPdf} disabled={loading || filtered.length === 0}><FileDown className="w-4 h-4 mr-1"/>Imprimir PDF ({filtered.length})</Button>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Busca</Label><Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Nome, CNPJ, código…"/></div>
          <div><Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Tipo (PJ/PF)</Label>
            <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
                <SelectItem value="PF">PF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Tipo da Folha</Label>
            <Select value={tipoFolha} onValueChange={setTipoFolha}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pro_labore">Somente Pró-labore</SelectItem>
                <SelectItem value="folha_sem_variaveis">Folha sem variáveis</SelectItem>
                <SelectItem value="folha_com_variaveis">Folha com variáveis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Segmento</Label>
            <Select value={segmento} onValueChange={setSegmento}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.segmentos.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Gestor da Carteira</Label>
            <Select value={gestor} onValueChange={setGestor}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.gestores.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Sindicato</Label>
            <Select value={sindicato} onValueChange={setSindicato}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.sindicatos.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Prévia da Folha</Label>
            <Select value={previa} onValueChange={setPrevia}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sim">Necessita</SelectItem>
                <SelectItem value="nao">Não necessita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Ponto</Label>
            <Select value={pontoTipo} onValueChange={setPontoTipo}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="eletronico">Eletrônico</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="sem">Sem ponto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Código</TableHead><TableHead>Razão Social</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Segmento</TableHead><TableHead>Gestor</TableHead>
            <TableHead>Folha</TableHead><TableHead>Prévia</TableHead><TableHead>Ponto</TableHead>
            <TableHead>Sindicato</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum resultado.</TableCell></TableRow>
            : filtered.map((c) => {
              const prof = profiles[c.id];
              const cct = (ccts[c.id] || []).map((x: any) => x.sindicato).filter(Boolean).join('; ');
              return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={()=>nav(`/sucesso-cliente/${c.id}`)}>
                  <TableCell className="font-mono text-xs">{c.codigo_cliente || '—'}</TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.tipo}</TableCell>
                  <TableCell>{c.segmento || '—'}</TableCell>
                  <TableCell>{c.gestor_carteira || '—'}</TableCell>
                  <TableCell>{TIPO_FOLHA_LABEL[c.tipo_folha] || '—'}</TableCell>
                  <TableCell><Badge variant={prof?.needs_preview ? 'default' : 'secondary'}>{prof?.needs_preview ? 'Sim' : 'Não'}</Badge></TableCell>
                  <TableCell>{prof?.has_timeclock ? (prof.timeclock_type || 'sim') : 'sem'}</TableCell>
                  <TableCell className="text-xs">{cct || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}