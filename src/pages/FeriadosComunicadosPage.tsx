import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CalendarDays, FileText, Upload, MessageSquare, Settings, History, Plus, Trash2, Copy, Download, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useHolidaysModule } from '@/hooks/useHolidaysModule';
import { useHolidayNotices } from '@/hooks/useHolidayNotices';
import { useHolidaySources, type HolidayExtractionItem, type HolidaySourceDoc } from '@/hooks/useHolidaySources';
import { useOfficeBranding } from '@/hooks/useOfficeBranding';
import { useCcts } from '@/hooks/useCcts';
import { useFeriadosMunicipais } from '@/hooks/useFeriadosMunicipais';
import { supabase } from '@/integrations/supabase/client';
import { TIPO_LABELS, TIPO_COLORS, type Holiday, type HolidayTipo, type HolidayScope, type NoticeAudienceType } from '@/utils/holidays/types';
import { buildDedupeKey } from '@/utils/holidays/dedupe';
import { defaultTemplate, renderNoticeText } from '@/utils/holidays/whatsappText';
import { generateNoticePdf, generateHolidayTablePdf } from '@/utils/holidays/noticePdf';
import { parseHolidaysCsv, normalizeDate } from '@/utils/holidays/csvImport';

function fmtBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Algoritmo de Meeus/Jones/Butcher para Páscoa (domingo) gregoriana
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function federalHolidaysFor(year: number): Array<{ data: string; nome: string; is_optional: boolean }> {
  const easter = easterSunday(year);
  return [
    { data: `${year}-01-01`, nome: 'Confraternização Universal', is_optional: false },
    { data: isoFromDate(addDays(easter, -48)), nome: 'Carnaval (segunda-feira)', is_optional: true },
    { data: isoFromDate(addDays(easter, -47)), nome: 'Carnaval (terça-feira)', is_optional: true },
    { data: isoFromDate(addDays(easter, -46)), nome: 'Quarta-feira de Cinzas', is_optional: true },
    { data: isoFromDate(addDays(easter, -2)), nome: 'Sexta-feira Santa', is_optional: false },
    { data: `${year}-04-21`, nome: 'Tiradentes', is_optional: false },
    { data: `${year}-05-01`, nome: 'Dia do Trabalho', is_optional: false },
    { data: isoFromDate(addDays(easter, 60)), nome: 'Corpus Christi', is_optional: true },
    { data: `${year}-09-07`, nome: 'Independência do Brasil', is_optional: false },
    { data: `${year}-10-12`, nome: 'Nossa Senhora Aparecida', is_optional: false },
    { data: `${year}-10-28`, nome: 'Dia do Servidor Público', is_optional: true },
    { data: `${year}-11-02`, nome: 'Finados', is_optional: false },
    { data: `${year}-11-15`, nome: 'Proclamação da República', is_optional: false },
    { data: `${year}-11-20`, nome: 'Dia da Consciência Negra', is_optional: false },
    { data: `${year}-12-25`, nome: 'Natal', is_optional: false },
  ];
}

export default function FeriadosComunicadosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Feriados e Comunicados</h1>
        <p className="text-sm text-muted-foreground">Cadastro, importação de decretos/CCT (IA) e geração de comunicados PDF + WhatsApp.</p>
      </div>
      <Tabs defaultValue="calendar">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1" />Calendário</TabsTrigger>
          <TabsTrigger value="list"><FileText className="w-4 h-4 mr-1" />Feriados</TabsTrigger>
          <TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" />Importar</TabsTrigger>
          <TabsTrigger value="notices"><MessageSquare className="w-4 h-4 mr-1" />Comunicados</TabsTrigger>
          <TabsTrigger value="branding"><Settings className="w-4 h-4 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="audit"><History className="w-4 h-4 mr-1" />Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar"><CalendarTab /></TabsContent>
        <TabsContent value="list"><ListTab /></TabsContent>
        <TabsContent value="import"><ImportTab /></TabsContent>
        <TabsContent value="notices"><NoticesTab /></TabsContent>
        <TabsContent value="branding"><BrandingTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =================== CALENDAR ====================
function CalendarTab() {
  const { holidays } = useHolidaysModule();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [municipioFilter, setMunicipioFilter] = useState('');

  const filtered = holidays.filter((h) => {
    if (h.status !== 'ativo') return false;
    if (!h.data.startsWith(String(year))) return false;
    if (tipoFilter !== 'todos' && h.tipo !== tipoFilter) return false;
    if (municipioFilter && !(h.municipio || '').toLowerCase().includes(municipioFilter.toLowerCase())) return false;
    return true;
  });

  const byMonth = useMemo(() => {
    const map: Record<number, Holiday[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    for (const h of filtered) {
      const m = Number(h.data.slice(5, 7));
      map[m].push(h);
    }
    return map;
  }, [filtered]);

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>Calendário {year}</span>
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={() => setYear(year - 1)}>‹</Button>
            <Input className="w-24" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            <Button size="sm" variant="outline" onClick={() => setYear(year + 1)}>›</Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {(Object.keys(TIPO_LABELS) as HolidayTipo[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Filtrar por município..." value={municipioFilter} onChange={(e) => setMunicipioFilter(e.target.value)} />
          <div className="flex flex-wrap gap-2 items-center text-xs">
            {(Object.keys(TIPO_LABELS) as HolidayTipo[]).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm" style={{ background: TIPO_COLORS[t] }} />{TIPO_LABELS[t]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {monthNames.map((mn, idx) => (
            <div key={mn} className="border rounded p-2">
              <div className="font-semibold text-sm mb-1">{mn}</div>
              {byMonth[idx + 1].length === 0 ? (
                <div className="text-xs text-muted-foreground">—</div>
              ) : (
                <ul className="space-y-1">
                  {byMonth[idx + 1].map((h) => (
                    <li key={h.id} className="text-xs flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[h.tipo] }} />
                      <span className="font-mono">{h.data.slice(8, 10)}</span>
                      <span className="truncate">{h.nome}</span>
                      {h.is_optional && <Badge variant="outline" className="text-[10px] py-0">PF</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =================== LIST ====================
function ListTab() {
  const { holidays, create, update, remove, toggleStatus, reload } = useHolidaysModule();
  const { ccts } = useCcts();
  const { feriados: municipais } = useFeriadosMunicipais();
  const [openNew, setOpenNew] = useState(false);
  const [openAiSeed, setOpenAiSeed] = useState(false);
  const [filter, setFilter] = useState('');
  const [tipoF, setTipoF] = useState('todos');

  const visible = holidays.filter((h) => {
    if (tipoF !== 'todos' && h.tipo !== tipoF) return false;
    if (filter) {
      const q = filter.toLowerCase();
      const hay = `${h.nome} ${h.municipio || ''} ${h.uf || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleAiSeedMunicipio = async (uf: string, municipio: string, ano: number) => {
    if (!uf || !municipio || !ano) { toast.error('Informe UF, município e ano.'); return; }
    toast.info(`Consultando IA para feriados de ${municipio}/${uf} - ${ano}...`);
    const { data, error } = await supabase.functions.invoke('ai-municipal-holidays', {
      body: { uf, municipio, ano },
    });
    if (error) { toast.error('Falha: ' + error.message); return; }
    const items: any[] = data?.items || [];
    if (!items.length) { toast.warning('A IA não retornou itens.'); return; }
    let ok = 0, dup = 0;
    for (const it of items) {
      if (!it?.data || !it?.nome) continue;
      const tipo = (it.tipo as HolidayTipo) || 'municipal';
      const scope_type: HolidayScope = tipo === 'nacional' ? 'todos' : (tipo === 'estadual' ? 'uf' : 'municipio');
      const r = await create({
        data: it.data, nome: it.nome, tipo,
        is_holiday: it.is_holiday !== false, is_optional: !!it.is_optional,
        scope_type, uf, municipio: scope_type === 'municipio' ? municipio : null,
        source_type: 'auto', status: 'ativo', observacoes: it.observacao || '',
      } as any);
      if (r.error) dup++; else ok++;
    }
    toast.success(`${ok} cadastrados, ${dup} já existiam.`);
    setOpenAiSeed(false);
  };

  const handleSeedFederal = async () => {
    const year = new Date().getFullYear();
    const items = federalHolidaysFor(year);
    let added = 0, dup = 0;
    for (const f of items) {
      const { error } = await create({
        data: f.data, nome: f.nome, tipo: f.is_optional ? 'ponto_facultativo' : 'nacional', is_holiday: !f.is_optional, is_optional: f.is_optional,
        scope_type: 'todos', municipio: null, uf: null, source_type: 'auto', status: 'ativo', observacoes: 'Feriado nacional',
      } as any);
      if (error) dup++; else added++;
    }
    toast.success(`${added} feriados federais carregados para ${year}${dup ? ` (${dup} já existiam)` : ''}.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Lista de Feriados</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSeedFederal}>
              <RefreshCw className="w-4 h-4 mr-1" />Carregar base federal
            </Button>
            <Dialog open={openAiSeed} onOpenChange={setOpenAiSeed}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-1" />Carregar base municipal (IA)
                </Button>
              </DialogTrigger>
              <AiSeedDialog onConfirm={handleAiSeedMunicipio} />
            </Dialog>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
              </DialogTrigger>
              <HolidayDialogContent ccts={ccts} onSubmit={async (h) => { const r = await create(h); if (!r.error) { setOpenNew(false); toast.success('Feriado cadastrado.'); } else { toast.error(r.duplicated ? 'Já existe um feriado igual.' : 'Erro ao salvar.'); } }} />
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <Input placeholder="Buscar nome/município/UF..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Select value={tipoF} onValueChange={setTipoF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {(Object.keys(TIPO_LABELS) as HolidayTipo[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CsvImporter onImport={async (rows) => {
            let ok = 0, dup = 0;
            for (const r of rows) {
              const data = normalizeDate(r.data); if (!data || !r.nome) continue;
              const tipo = (r.tipo as HolidayTipo) || 'municipal';
              const scope_type = (r.escopo as HolidayScope) || (r.municipio ? 'municipio' : (r.uf ? 'uf' : 'todos'));
              const res = await create({
                data, nome: r.nome, tipo, scope_type,
                uf: r.uf || null, municipio: r.municipio || null,
                is_holiday: (r.is_holiday || 'true').toLowerCase() !== 'false',
                is_optional: (r.is_optional || 'false').toLowerCase() === 'true',
                observacoes: r.observacoes || '', status: 'ativo', source_type: 'import_csv',
              } as any);
              if (res.error) dup++; else ok++;
            }
            toast.success(`${ok} importados, ${dup} duplicados/ignorados.`);
          }} />
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>
              <th className="text-left p-2">Data</th><th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Tipo</th><th className="text-left p-2">Escopo</th>
              <th className="text-left p-2">Fonte</th><th className="text-left p-2">Status</th>
              <th className="p-2"></th>
            </tr></thead>
            <tbody>
              {visible.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="p-2 font-mono">{fmtBR(h.data)}</td>
                  <td className="p-2">{h.nome}{h.is_optional && <Badge variant="outline" className="ml-1 text-[10px]">PF</Badge>}</td>
                  <td className="p-2"><Badge style={{ background: TIPO_COLORS[h.tipo], color: 'white' }}>{TIPO_LABELS[h.tipo]}</Badge></td>
                  <td className="p-2 text-xs">{h.scope_type}{h.municipio ? `: ${h.municipio}` : ''}{h.uf ? `/${h.uf}` : ''}</td>
                  <td className="p-2 text-xs">{h.source_type}</td>
                  <td className="p-2">
                    <Checkbox checked={h.status === 'ativo'} onCheckedChange={(c) => toggleStatus(h.id, c ? 'ativo' : 'inativo')} />
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir?')) remove(h.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum feriado.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CsvImporter({ onImport }: { onImport: (rows: ReturnType<typeof parseHolidaysCsv>) => void }) {
  return (
    <div>
      <input type="file" accept=".csv,.txt" className="hidden" id="csv-holidays" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const text = await f.text();
        const rows = parseHolidaysCsv(text);
        onImport(rows);
        e.target.value = '';
      }} />
      <label htmlFor="csv-holidays">
        <Button type="button" size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" />Importar CSV</span></Button>
      </label>
    </div>
  );
}

function AiSeedDialog({ onConfirm }: { onConfirm: (uf: string, municipio: string, ano: number) => void | Promise<void> }) {
  const [uf, setUf] = useState('MG');
  const [municipio, setMunicipio] = useState('Camanducaia');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Mapear feriados via IA</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">
        A IA listará feriados nacionais, estaduais, municipais e pontos facultativos oficiais do município no ano selecionado.
        Itens já cadastrados (mesma data/escopo/nome) são ignorados.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
        <div className="col-span-2"><Label>Município</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></div>
        <div><Label>Ano</Label><Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} /></div>
      </div>
      <DialogFooter>
        <Button disabled={loading} onClick={async () => { setLoading(true); try { await onConfirm(uf, municipio, ano); } finally { setLoading(false); } }}>
          {loading ? 'Consultando IA...' : 'Mapear feriados'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function HolidayDialogContent({ ccts, onSubmit, initial }: { ccts: any[]; onSubmit: (h: Partial<Holiday>) => void; initial?: Partial<Holiday> }) {
  const [data, setData] = useState(initial?.data || '');
  const [nome, setNome] = useState(initial?.nome || '');
  const [tipo, setTipo] = useState<HolidayTipo>((initial?.tipo as HolidayTipo) || 'municipal');
  const [scope, setScope] = useState<HolidayScope>((initial?.scope_type as HolidayScope) || 'municipio');
  const [uf, setUf] = useState(initial?.uf || 'MG');
  const [municipio, setMunicipio] = useState(initial?.municipio || '');
  const [isOptional, setIsOptional] = useState(!!initial?.is_optional);
  const [obs, setObs] = useState(initial?.observacoes || '');
  const [cctId, setCctId] = useState(initial?.cct_id || '');

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo feriado / ponto facultativo</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as HolidayTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as HolidayTipo[]).map((t) => (<SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Nome do evento</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as HolidayScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="uf">UF</SelectItem>
                <SelectItem value="municipio">Município</SelectItem>
                <SelectItem value="cct">CCT</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
        </div>
        {scope === 'municipio' && (<div><Label>Município</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></div>)}
        {scope === 'cct' && (
          <div><Label>CCT</Label>
            <Select value={cctId} onValueChange={setCctId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{ccts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Checkbox id="isopt" checked={isOptional} onCheckedChange={(c) => setIsOptional(!!c)} />
          <Label htmlFor="isopt">Ponto facultativo</Label>
        </div>
        <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({
          data, nome, tipo, scope_type: scope, uf: uf || null, municipio: scope === 'municipio' ? municipio : null,
          cct_id: scope === 'cct' ? cctId : null, is_holiday: !isOptional || true, is_optional: isOptional,
          observacoes: obs, status: 'ativo', source_type: 'manual',
        } as any)}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// =================== IMPORT (Decreto/CCT) ====================
function ImportTab() {
  const { docs, reload, fetchItems } = useHolidaySources();
  const { create: createHoliday } = useHolidaysModule();
  const { ccts } = useCcts();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('decreto_municipal');
  const [uf, setUf] = useState('MG');
  const [municipio, setMunicipio] = useState('');
  const [cctId, setCctId] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<HolidayExtractionItem[]>([]);

  const handleUpload = async () => {
    if (!file) { toast.error('Selecione um arquivo.'); return; }
    setProcessing(true);
    try {
      const safeName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_');
      const path = `${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('feriados-docs').upload(path, file);
      if (upErr) throw upErr;
      const { data: docRow, error: insErr } = await (supabase.from('holiday_source_documents' as any).insert({
        doc_type: docType, uf, municipio: municipio || null, cct_id: cctId || null, ano,
        file_path: path, file_name: file.name, status: 'pendente',
      } as any).select('*').single());
      if (insErr || !docRow) throw insErr || new Error('insert failed');

      toast.info('Processando documento com IA...');
      const { data: fnResp, error: fnErr } = await supabase.functions.invoke('extract-holidays-doc', {
        body: { source_doc_id: (docRow as any).id },
      });
      if (fnErr) throw fnErr;
      toast.success(`Extração concluída: ${fnResp?.count ?? 0} itens.`);
      setFile(null);
      await reload();
    } catch (e: any) {
      toast.error('Falha: ' + (e?.message || String(e)));
    } finally {
      setProcessing(false);
    }
  };

  const openDoc = async (d: HolidaySourceDoc) => {
    if (expanded === d.id) { setExpanded(null); return; }
    setExpanded(d.id);
    const its = await fetchItems(d.id);
    setItems(its);
  };

  const confirmItem = async (it: HolidayExtractionItem) => {
    if (!it.data) { toast.error('Item sem data.'); return; }
    const res = await createHoliday({
      data: it.data, nome: it.nome, tipo: it.tipo as HolidayTipo,
      scope_type: it.scope_type as HolidayScope, uf: it.uf, municipio: it.municipio,
      cct_id: it.cct_id, is_holiday: it.is_holiday, is_optional: it.is_optional,
      observacoes: it.evidence_text, status: 'ativo',
      source_type: it.cct_id ? 'cct' : 'decreto', source_doc_id: it.source_doc_id,
    } as any);
    if (res.error && !res.duplicated) { toast.error('Erro.'); return; }
    const newStatus = res.duplicated ? 'duplicado' : 'confirmado';
    await supabase.from('holiday_extraction_items' as any).update({ status: newStatus } as any).eq('id', it.id);
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, status: newStatus } : x));
    toast.success(res.duplicated ? 'Marcado como duplicado.' : 'Confirmado e cadastrado.');
  };
  const ignoreItem = async (it: HolidayExtractionItem) => {
    await supabase.from('holiday_extraction_items' as any).update({ status: 'ignorado' } as any).eq('id', it.id);
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, status: 'ignorado' } : x));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Importar Decreto / CCT</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><Label>Tipo do documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="decreto_municipal">Decreto Municipal</SelectItem>
                  <SelectItem value="decreto_estadual">Decreto Estadual</SelectItem>
                  <SelectItem value="cct">CCT / Acordo Coletivo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ano de referência</Label><Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} /></div>
            <div><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
            <div><Label>Município</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></div>
            {docType === 'cct' && (
              <div className="md:col-span-2"><Label>CCT</Label>
                <Select value={cctId} onValueChange={setCctId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{ccts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={handleUpload} disabled={!file || processing}>
            {processing ? 'Processando...' : 'Processar e Extrair'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documentos importados</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento importado ainda.</p>}
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="border rounded">
                <button className="w-full p-2 text-left flex items-center justify-between" onClick={() => openDoc(d)}>
                  <div className="flex items-center gap-2">
                    {expanded === d.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium">{d.file_name}</span>
                    <Badge variant="outline">{d.doc_type}</Badge>
                    <span className="text-xs text-muted-foreground">{d.municipio || d.uf} • {d.ano}</span>
                  </div>
                  <span className="text-xs">{d.total_extracted} extraídos</span>
                </button>
                {expanded === d.id && (
                  <div className="border-t p-2 space-y-1">
                    {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item.</p>}
                    {items.map((it) => (
                      <div key={it.id} className="border rounded p-2 text-sm">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-mono">{it.data ? fmtBR(it.data) : '—'}</span>
                            {' '}<span className="font-semibold">{it.nome}</span>
                            {it.is_optional && <Badge variant="outline" className="ml-1">PF</Badge>}
                            <span className="ml-2 text-xs">confiança {(it.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant={it.status === 'pendente' ? 'secondary' : 'outline'}>{it.status}</Badge>
                            {it.status === 'pendente' && (
                              <>
                                <Button size="sm" onClick={() => confirmItem(it)}>Confirmar</Button>
                                <Button size="sm" variant="outline" onClick={() => ignoreItem(it)}>Ignorar</Button>
                              </>
                            )}
                          </div>
                        </div>
                        {it.evidence_text && <p className="text-xs text-muted-foreground mt-1 italic">"{it.evidence_text}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =================== NOTICES ====================
function NoticesTab() {
  const { holidays } = useHolidaysModule();
  const { notices, create, update, remove } = useHolidayNotices();
  const { branding } = useOfficeBranding();
  const { ccts } = useCcts();
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState({ audience: 'todos', tipo: 'todos', status: 'todos' });

  const visible = notices.filter((n) => {
    if (filter.audience !== 'todos' && n.audience?.type !== filter.audience) return false;
    if (filter.status !== 'todos' && n.status !== filter.status) return false;
    return true;
  });

  const handleCopy = async (n: any) => {
    const hs = holidays.filter((h) => (n.holiday_ids || []).includes(h.id));
    const txt = renderNoticeText(n.body_template || defaultTemplate(), hs, branding);
    await navigator.clipboard.writeText(txt);
    toast.success('Texto copiado.');
  };

  const handlePdf = async (n: any) => {
    const hs = holidays.filter((h) => (n.holiday_ids || []).includes(h.id));
    const body = renderNoticeText(n.body_template || defaultTemplate(), hs, branding);
    const blob = await generateNoticePdf({ title: n.title, body, holidays: hs, branding });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${n.title || 'comunicado'}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Comunicados</span>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo comunicado</Button></DialogTrigger>
            <NoticeDialog holidays={holidays} ccts={ccts} onSubmit={async (n) => { const r = await create(n); if (!r.error) { setOpenNew(false); toast.success('Comunicado criado.'); } }} />
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <Select value={filter.audience} onValueChange={(v) => setFilter({ ...filter, audience: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Público: todos</SelectItem>
              <SelectItem value="uf">UF</SelectItem>
              <SelectItem value="municipio">Município</SelectItem>
              <SelectItem value="cct">CCT</SelectItem>
              <SelectItem value="empresa">Empresa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {visible.map((n: any) => (
            <div key={n.id} className="border rounded p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Público: {n.audience?.type || 'todos'}
                    {n.audience?.municipio ? ` · ${n.audience.municipio}` : ''}
                    {n.audience?.uf ? ` · ${n.audience.uf}` : ''} · Status: {n.status} · {n.holiday_ids?.length || 0} feriado(s)
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(n)}><Copy className="w-4 h-4 mr-1" />WhatsApp</Button>
                  <Button size="sm" variant="outline" onClick={() => handlePdf(n)}><Download className="w-4 h-4 mr-1" />PDF</Button>
                  <Select value={n.status} onValueChange={(v) => update(n.id, { status: v } as any)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="publicado">Publicado</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir?')) remove(n.id); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          {!visible.length && <p className="text-sm text-muted-foreground">Nenhum comunicado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function NoticeDialog({ holidays, ccts, onSubmit }: { holidays: Holiday[]; ccts: any[]; onSubmit: (n: any) => void }) {
  const [title, setTitle] = useState('Comunicado de Feriado');
  const [body, setBody] = useState(defaultTemplate());
  const [selected, setSelected] = useState<string[]>([]);
  const [audType, setAudType] = useState<NoticeAudienceType>('todos');
  const [audUf, setAudUf] = useState('');
  const [audMun, setAudMun] = useState('');
  const [audCct, setAudCct] = useState('');

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Novo comunicado</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[70vh] overflow-auto">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Texto (placeholders: {'{{data}}'}, {'{{nome_evento}}'}, {'{{municipio}}'}, {'{{uf}}'}, {'{{dia_semana}}'}, {'{{tipo_evento}}'}, {'{{nome_escritorio}}'})</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
        </div>
        <div>
          <Label>Público-alvo</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={audType} onValueChange={(v) => setAudType(v as NoticeAudienceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="uf">UF</SelectItem>
                <SelectItem value="municipio">Município</SelectItem>
                <SelectItem value="cct">CCT</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
            {audType === 'uf' && <Input placeholder="UF" value={audUf} onChange={(e) => setAudUf(e.target.value.toUpperCase().slice(0, 2))} />}
            {audType === 'municipio' && <Input placeholder="Município" value={audMun} onChange={(e) => setAudMun(e.target.value)} />}
            {audType === 'cct' && (
              <Select value={audCct} onValueChange={setAudCct}>
                <SelectTrigger><SelectValue placeholder="CCT..." /></SelectTrigger>
                <SelectContent>{ccts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div>
          <Label>Feriados relacionados</Label>
          <div className="border rounded p-2 max-h-48 overflow-auto space-y-1">
            {holidays.filter((h) => h.status === 'ativo').map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selected.includes(h.id)} onCheckedChange={() => toggle(h.id)} />
                <span className="font-mono">{fmtBR(h.data)}</span>
                <span>{h.nome}</span>
                <span className="text-xs text-muted-foreground">({h.municipio || h.uf || '—'})</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({
          title, body_template: body, holiday_ids: selected,
          audience: { type: audType, uf: audUf || undefined, municipio: audMun || undefined, cct_id: audCct || undefined },
          status: 'rascunho',
        })}>Criar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// =================== BRANDING ====================
function BrandingTab() {
  const { branding, save, reload } = useOfficeBranding();
  const [logoUploading, setLogoUploading] = useState(false);

  if (!branding) return <Card><CardContent className="p-6">Carregando...</CardContent></Card>;

  const handleLogo = async (f: File) => {
    setLogoUploading(true);
    try {
      const path = `logo-${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from('office-assets').upload(path, f, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('office-assets').getPublicUrl(path);
      await save({ logo_url: data.publicUrl } as any);
      toast.success('Logo atualizada.');
    } catch (e: any) { toast.error(e.message); }
    finally { setLogoUploading(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Branding do Escritório</CardTitle></CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div><Label>Nome do escritório</Label>
          <Input defaultValue={branding.office_name} onBlur={(e) => save({ office_name: e.target.value } as any)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Cor primária</Label><Input type="color" defaultValue={branding.primary_color} onBlur={(e) => save({ primary_color: e.target.value } as any)} /></div>
          <div><Label>Cor secundária</Label><Input type="color" defaultValue={branding.secondary_color} onBlur={(e) => save({ secondary_color: e.target.value } as any)} /></div>
          <div><Label>Cor do texto</Label><Input type="color" defaultValue={branding.text_color} onBlur={(e) => save({ text_color: e.target.value } as any)} /></div>
        </div>
        <div><Label>Logo</Label>
          {branding.logo_url && <img src={branding.logo_url} alt="logo" className="h-16 mb-2" />}
          <Input type="file" accept="image/*" disabled={logoUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f); }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Telefone</Label><Input defaultValue={branding.contacts?.phone || ''} onBlur={(e) => save({ contacts: { ...branding.contacts, phone: e.target.value } } as any)} /></div>
          <div><Label>E-mail</Label><Input defaultValue={branding.contacts?.email || ''} onBlur={(e) => save({ contacts: { ...branding.contacts, email: e.target.value } } as any)} /></div>
          <div><Label>Site</Label><Input defaultValue={branding.contacts?.site || ''} onBlur={(e) => save({ contacts: { ...branding.contacts, site: e.target.value } } as any)} /></div>
          <div><Label>Endereço</Label><Input defaultValue={branding.contacts?.address || ''} onBlur={(e) => save({ contacts: { ...branding.contacts, address: e.target.value } } as any)} /></div>
        </div>

        <div className="pt-2">
          <Label>Pré-visualização do cabeçalho</Label>
          <div className="rounded overflow-hidden border">
            <div className="h-16 flex items-center justify-between px-4" style={{ background: branding.primary_color }}>
              {branding.logo_url ? <img src={branding.logo_url} alt="" className="h-10" /> : <span />}
              <span className="text-white font-bold">{branding.office_name}</span>
            </div>
            <div className="h-2" style={{ background: branding.secondary_color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =================== AUDIT ====================
function AuditTab() {
  const { docs } = useHolidaySources();
  return (
    <Card>
      <CardHeader><CardTitle>Logs de importação</CardTitle></CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            <th className="text-left p-2">Arquivo</th><th className="text-left p-2">Tipo</th>
            <th className="text-left p-2">Importado em</th>
            <th className="text-right p-2">Extraídos</th><th className="text-right p-2">Confirmados</th>
            <th className="text-right p-2">Ignorados</th><th className="text-right p-2">Duplicados</th>
            <th className="text-left p-2">Status</th>
          </tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="p-2">{d.file_name}</td>
                <td className="p-2">{d.doc_type}</td>
                <td className="p-2">{new Date(d.imported_at).toLocaleString('pt-BR')}</td>
                <td className="p-2 text-right">{d.total_extracted}</td>
                <td className="p-2 text-right">{d.total_confirmed}</td>
                <td className="p-2 text-right">{d.total_ignored}</td>
                <td className="p-2 text-right">{d.total_duplicated}</td>
                <td className="p-2"><Badge variant="outline">{d.status}</Badge></td>
              </tr>
            ))}
            {!docs.length && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhuma importação.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}