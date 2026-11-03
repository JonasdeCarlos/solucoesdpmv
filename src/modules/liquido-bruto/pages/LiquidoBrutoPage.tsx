import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, FileDown, FolderOpen, Plus, RotateCcw, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresas } from '@/modules/taxa-servico/hooks/useTaxaServico';
import MoneyInput from '../components/MoneyInput';
import { calcularBruto, parametrosVazios, ErroSimulacao, type ParametrosSimulacao, type ResultadoBruto, type TipoValor } from '../engine';
import { useTabelasLegais, tabelasDaCompetencia, salvarSimulacao, listarSimulacoes, excluirSimulacao, type LbSimulacao } from '../api';
import { exportarPdf, linhasDescontos, memoria } from '../pdf';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SEM = '__sem__';
const mesAtual = () => new Date().toISOString().slice(0, 7);

function TipoSelect({ value, onChange, labelPct = '% sobre o bruto' }: { value: TipoValor; onChange: (v: TipoValor) => void; labelPct?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TipoValor)}>
      <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="percentual">{labelPct}</SelectItem>
        <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <Input type="number" min={0} step="0.01" className="pr-8 text-right" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || 0)} placeholder="0" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  );
}

export default function LiquidoBrutoPage() {
  const empresas = useEmpresas();
  const { dados, erro: erroTabelas } = useTabelasLegais();
  const [aba, setAba] = useState('simulacao');

  const [empresaId, setEmpresaId] = useState<string>(SEM);
  const [empregado, setEmpregado] = useState('');
  const [cargo, setCargo] = useState('');
  const [competencia, setCompetencia] = useState(mesAtual());
  const [liquido, setLiquido] = useState(0);
  const [p, setP] = useState<ParametrosSimulacao>(parametrosVazios());
  const [salvando, setSalvando] = useState(false);

  const tabelas = useMemo(() => (dados ? tabelasDaCompetencia(dados, competencia) : null), [dados, competencia]);

  const { resultado, erro } = useMemo((): { resultado: ResultadoBruto | null; erro: string | null } => {
    if (!tabelas || liquido <= 0) return { resultado: null, erro: null };
    try {
      return { resultado: calcularBruto(liquido, p, tabelas), erro: null };
    } catch (e) {
      return { resultado: null, erro: e instanceof ErroSimulacao ? e.message : 'Erro no cálculo.' };
    }
  }, [tabelas, liquido, p]);

  const empresaNome = empresas.find((e) => e.id === empresaId)?.nome || '';

  const novo = () => {
    setEmpregado(''); setCargo(''); setLiquido(0); setP(parametrosVazios()); setCompetencia(mesAtual()); setEmpresaId(SEM);
  };

  const carregar = (s: LbSimulacao, duplicar: boolean) => {
    setEmpresaId(s.empresa_id || SEM);
    setEmpregado(duplicar ? '' : s.empregado || '');
    setCargo(s.cargo || '');
    setCompetencia(String(s.competencia).slice(0, 7));
    setLiquido(Number(s.liquido_alvo));
    setP({ ...parametrosVazios(), ...s.parametros });
    setAba('simulacao');
    toast.success(duplicar ? 'Simulação duplicada — ajuste e salve como nova.' : 'Simulação reaberta.');
  };

  const salvar = async () => {
    if (!resultado) return;
    setSalvando(true);
    try {
      await salvarSimulacao({
        empresa_id: empresaId === SEM ? null : empresaId,
        empregado: empregado || null,
        cargo: cargo || null,
        competencia: `${competencia}-01`,
        liquido_alvo: liquido,
        parametros: p,
        resultado,
      });
      toast.success('Simulação salva no histórico.');
    } catch {
      toast.error('Não foi possível salvar a simulação.');
    } finally {
      setSalvando(false);
    }
  };

  const pdf = async () => {
    if (!resultado) return;
    await exportarPdf({ r: resultado, p, empresa: empresaNome, empregado, cargo, competencia });
  };

  const upd = (patch: Partial<ParametrosSimulacao>) => setP((o) => ({ ...o, ...patch }));

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-bold">Líquido → Bruto</h2>
        <p className="text-sm text-muted-foreground">Informe o salário líquido desejado e os descontos; o sistema calcula o salário bruto necessário.</p>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="simulacao">Simulação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simulacao" className="space-y-4">
          {erroTabelas && <Alert variant="destructive"><AlertDescription>{erroTabelas}</AlertDescription></Alert>}
          {dados && !tabelas && (
            <Alert variant="destructive"><AlertDescription>Não há tabela de INSS/IRRF cadastrada para a competência {competencia.slice(5)}/{competencia.slice(0, 4)}.</AlertDescription></Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Identificação (opcional)</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Empresa</Label>
                    <Select value={empresaId} onValueChange={setEmpresaId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM}>— Sem empresa —</SelectItem>
                        {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Empregado</Label><Input value={empregado} onChange={(e) => setEmpregado(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Cargo</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
                  <div className="space-y-1">
                    <Label>Competência</Label>
                    <Input type="month" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} />
                  </div>
                  {tabelas && <p className="text-xs text-muted-foreground self-end pb-2">Tabelas vigentes desde {tabelas.vigencia_inicio.split('-').reverse().join('/')}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Valor desejado e descontos obrigatórios</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="liq">Salário líquido desejado *</Label><MoneyInput id="liq" value={liquido} onChange={setLiquido} /></div>
                  <div className="space-y-1">
                    <Label>Nº de dependentes (IRRF)</Label>
                    <Input type="number" min={0} step={1} value={p.dependentes} onChange={(e) => upd({ dependentes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </div>
                  <p className="sm:col-span-2 text-xs text-muted-foreground">INSS (tabela progressiva) e IRRF (tabela progressiva + redutor da Lei 15.270/2025) são sempre calculados.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Descontos opcionais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {/* Assistencial */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label>Contribuição assistencial</Label><Switch checked={p.assistencial.ativo} onCheckedChange={(v) => upd({ assistencial: { ...p.assistencial, ativo: v } })} /></div>
                    {p.assistencial.ativo && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <TipoSelect value={p.assistencial.tipo} onChange={(t) => upd({ assistencial: { ...p.assistencial, tipo: t, valor: 0 } })} labelPct="Percentual" />
                        <div className="flex-1">{p.assistencial.tipo === 'percentual'
                          ? <PctInput value={p.assistencial.valor} onChange={(v) => upd({ assistencial: { ...p.assistencial, valor: v } })} />
                          : <MoneyInput value={p.assistencial.valor} onChange={(v) => upd({ assistencial: { ...p.assistencial, valor: v } })} />}</div>
                      </div>
                    )}
                  </div>
                  {/* VT */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between"><Label>Vale-transporte</Label><Switch checked={p.vt.ativo} onCheckedChange={(v) => upd({ vt: { ...p.vt, ativo: v } })} /></div>
                    {p.vt.ativo && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Desconto automático de 6% do salário-base.</p>
                        <span className="text-xs text-muted-foreground">Custo mensal do VT (opcional — só se for menor que os 6%)</span>
                        <MoneyInput value={p.vt.custo} onChange={(v) => upd({ vt: { ...p.vt, custo: v } })} />
                        <p className="text-xs text-muted-foreground">Se informar o custo e ele for menor que 6%, desconta só o custo (Lei 7.418/85, art. 4º, p.u.).</p>
                      </div>
                    )}
                  </div>
                  {/* Pensão */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between"><Label>Pensão alimentícia judicial</Label><Switch checked={p.pensao.ativo} onCheckedChange={(v) => upd({ pensao: { ...p.pensao, ativo: v } })} /></div>
                    {p.pensao.ativo && (
                      <>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <TipoSelect value={p.pensao.tipo} onChange={(t) => upd({ pensao: { ...p.pensao, tipo: t, valor: 0 } })} />
                          <div className="flex-1">{p.pensao.tipo === 'percentual'
                            ? <PctInput value={p.pensao.valor} onChange={(v) => upd({ pensao: { ...p.pensao, valor: v } })} />
                            : <MoneyInput value={p.pensao.valor} onChange={(v) => upd({ pensao: { ...p.pensao, valor: v } })} />}</div>
                        </div>
                        <p className="text-xs text-muted-foreground">Deduz da base do IRRF somente no regime de deduções legais.</p>
                      </>
                    )}
                  </div>
                  {/* Outros */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between"><Label>Outros descontos</Label><Switch checked={p.outros.ativo} onCheckedChange={(v) => upd({ outros: { ...p.outros, ativo: v } })} /></div>
                    {p.outros.ativo && (
                      <div className="space-y-2">
                        {p.outros.itens.map((it, i) => {
                          const set = (patch: Partial<typeof it>) => upd({ outros: { ...p.outros, itens: p.outros.itens.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
                          return (
                            <div key={i} className="flex flex-col sm:flex-row gap-2">
                              <Input className="sm:flex-1" placeholder="Descrição (ex.: plano de saúde)" value={it.descricao} onChange={(e) => set({ descricao: e.target.value })} />
                              <Select value={it.tipo} onValueChange={(t) => set({ tipo: t as TipoValor, valor: 0 })}>
                                <SelectTrigger className="sm:w-24"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="percentual">%</SelectItem><SelectItem value="fixo">R$</SelectItem></SelectContent>
                              </Select>
                              <div className="sm:w-36">{it.tipo === 'percentual' ? <PctInput value={it.valor} onChange={(v) => set({ valor: v })} /> : <MoneyInput value={it.valor} onChange={(v) => set({ valor: v })} />}</div>
                              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => upd({ outros: { ...p.outros, itens: p.outros.itens.filter((_, j) => j !== i) } })}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" onClick={() => upd({ outros: { ...p.outros, itens: [...p.outros.itens, { descricao: '', tipo: 'fixo', valor: 0 }] } })}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                        <p className="text-xs text-muted-foreground">Não afetam a base de INSS nem de IRRF.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {erro && <Alert variant="destructive"><AlertTriangle className="w-4 h-4" /><AlertDescription>{erro}</AlertDescription></Alert>}
              {!resultado && !erro && (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Informe o salário líquido desejado para ver o bruto necessário.</CardContent></Card>
              )}
              {resultado && (
                <>
                  <Card className="bg-primary text-primary-foreground border-primary">
                    <CardContent className="py-5">
                      <p className="text-sm opacity-90">Salário bruto necessário</p>
                      <p className="text-3xl font-bold">{brl(resultado.bruto)}</p>
                      {resultado.diferencaArredondamento > 0 && (
                        <p className="text-xs opacity-90 mt-1">Líquido obtido: {brl(resultado.liquido)} (diferença de {brl(resultado.diferencaArredondamento)} por arredondamento)</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Demonstrativo</CardTitle></CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="text-right">Proventos</TableHead><TableHead className="text-right">Descontos</TableHead></TableRow></TableHeader>
                        <TableBody>
                          <TableRow><TableCell>Salário-base</TableCell><TableCell className="text-right">{brl(resultado.bruto)}</TableCell><TableCell /></TableRow>
                          {linhasDescontos(resultado, p).map((d, i) => (
                            <TableRow key={i}>
                              <TableCell>{d.desc}<div className="text-xs text-muted-foreground">{d.ref}</div></TableCell>
                              <TableCell />
                              <TableCell className="text-right">{brl(d.valor)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow><TableCell>Total de descontos</TableCell><TableCell /><TableCell className="text-right">{brl(resultado.totalDescontos)}</TableCell></TableRow>
                          <TableRow><TableCell className="font-bold">Líquido obtido</TableCell><TableCell /><TableCell className="text-right font-bold">{brl(resultado.liquido)}</TableCell></TableRow>
                        </TableFooter>
                      </Table>
                    </CardContent>
                  </Card>

                  <Accordion type="single" collapsible className="border rounded-lg px-4 bg-card">
                    <AccordionItem value="mem" className="border-0">
                      <AccordionTrigger>Memória de cálculo</AccordionTrigger>
                      <AccordionContent>
                        <dl className="text-sm divide-y">
                          {memoria(resultado).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-right whitespace-nowrap">{v}</dd></div>
                          ))}
                        </dl>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={salvar} disabled={!resultado || salvando}><Save className="w-4 h-4 mr-1" />Salvar simulação</Button>
                <Button variant="outline" onClick={pdf} disabled={!resultado}><FileDown className="w-4 h-4 mr-1" />Exportar PDF</Button>
                <Button variant="ghost" onClick={novo}><RotateCcw className="w-4 h-4 mr-1" />Nova simulação</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <Historico ativo={aba === 'historico'} empresas={empresas} onAbrir={carregar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Historico({ ativo, empresas, onAbrir }: { ativo: boolean; empresas: { id: string; nome: string }[]; onAbrir: (s: LbSimulacao, duplicar: boolean) => void }) {
  const [lista, setLista] = useState<LbSimulacao[]>([]);
  const [fEmpresa, setFEmpresa] = useState('__todas__');
  const [fComp, setFComp] = useState('');
  const recarregar = () => listarSimulacoes().then(setLista).catch(() => toast.error('Não foi possível carregar o histórico.'));
  useEffect(() => { if (ativo) recarregar(); }, [ativo]);

  const nomeEmp = (id: string | null) => empresas.find((e) => e.id === id)?.nome || '—';
  const filtrada = lista.filter((s) => (fEmpresa === '__todas__' || s.empresa_id === fEmpresa) && (!fComp || String(s.competencia).startsWith(fComp)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Simulações salvas</CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Select value={fEmpresa} onValueChange={setFEmpresa}>
            <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas as empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" className="sm:w-44" value={fComp} onChange={(e) => setFComp(e.target.value)} />
          {fComp && <Button variant="ghost" size="sm" onClick={() => setFComp('')}>Limpar competência</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {filtrada.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma simulação encontrada.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Empresa</TableHead><TableHead>Empregado</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filtrada.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{String(s.competencia).slice(5, 7)}/{String(s.competencia).slice(0, 4)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{nomeEmp(s.empresa_id)}</TableCell>
                  <TableCell>{s.empregado || '—'}{s.cargo && <Badge variant="secondary" className="ml-2">{s.cargo}</Badge>}</TableCell>
                  <TableCell className="text-right">{brl(Number(s.liquido_alvo))}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(s.resultado?.bruto || 0))}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => onAbrir(s, false)}><FolderOpen className="w-4 h-4 mr-1" />Reabrir</Button>
                    <Button variant="ghost" size="sm" onClick={() => onAbrir(s, true)}><Copy className="w-4 h-4 mr-1" />Duplicar</Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir" onClick={async () => {
                      if (!confirm('Excluir esta simulação?')) return;
                      try { await excluirSimulacao(s.id); recarregar(); } catch { toast.error('Não foi possível excluir.'); }
                    }}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
