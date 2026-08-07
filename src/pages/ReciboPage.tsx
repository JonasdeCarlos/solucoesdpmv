import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClientes } from '@/hooks/useClientes';
import { useVerbas } from '@/hooks/useVerbas';
import { useFeriadosMunicipais } from '@/hooks/useFeriadosMunicipais';
import { VacationReceiptModule } from '@/components/recibo/VacationReceiptModule';
import VerbasPage from '@/pages/VerbasPage';
import {
  type ReciboData, type ReciboLinha,
  createEmptyReciboData, createEmptyLinha,
  calcularValorLinha, calcularTotaisRecibo,
} from '@/types/recibo';
import { generateReciboPDF, generateReciboTexto } from '@/utils/reciboGenerator';
import { formatCurrency, formatCurrencyInput, parseCurrencyToNumber } from '@/utils/formatters';
import { quintoDiaUtilSubsequente, contarDiasUteisMes } from '@/utils/feriados';
import { Plus, Trash2, FileDown, Copy, Calculator, CalendarDays, Save, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  RECIBO_HISTORY_KEY,
  type SavedRecibo,
  loadReciboHistory,
  upsertRecibo,
  deleteRecibo,
} from '@/utils/reciboHistory';

const STORAGE_KEY = 'recibo_avulso_state_v1';
const LOTE_KEY = 'recibo_avulso_lote_v1';

function extrairPercentualDoNome(nome: string): number | null {
  const m = nome.match(/(\d{1,3})\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return isNaN(n) ? null : Math.min(200, Math.max(0, n));
}

function loadPersistedRecibo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ReciboData : createEmptyReciboData();
  } catch {
    return createEmptyReciboData();
  }
}

const ReciboPage = () => {
  const { clientes } = useClientes();
  const { verbas: verbasDB } = useVerbas();
  const { feriados: feriadosMunicipais, addFeriado, deleteFeriado } = useFeriadosMunicipais();
  const [recibo, setRecibo] = useState<ReciboData>(loadPersistedRecibo);
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [novoFeriado, setNovoFeriado] = useState({ nome: '', dia: '', mes: '' });
  const [currentReciboId, setCurrentReciboId] = useState<string | null>(null);
  const [savedRecibos, setSavedRecibos] = useState<SavedRecibo[]>(() => loadReciboHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lote, setLote] = useState<ReciboData[]>(() => {
    try {
      const raw = localStorage.getItem(LOTE_KEY);
      return raw ? (JSON.parse(raw) as ReciboData[]) : [];
    } catch {
      return [];
    }
  });
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recibo));
  }, [recibo]);

  useEffect(() => {
    localStorage.setItem(LOTE_KEY, JSON.stringify(lote));
  }, [lote]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECIBO_HISTORY_KEY) setSavedRecibos(loadReciboHistory());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleSalvarRecibo = () => {
    if (!recibo.recebedorNome.trim() && !recibo.clienteNome.trim()) {
      toast({ title: 'Preencha ao menos o recebedor ou cliente antes de salvar', variant: 'destructive' });
      return;
    }
    const saved = upsertRecibo(currentReciboId, recibo);
    setCurrentReciboId(saved.id);
    setSavedRecibos(loadReciboHistory());
    toast({ title: 'Recibo salvo!' });
  };

  const handleNovoRecibo = () => {
    setCurrentReciboId(null);
    setRecibo(createEmptyReciboData());
    toast({ title: 'Novo recibo iniciado' });
  };

  const handleCarregarRecibo = (item: SavedRecibo) => {
    setRecibo(item.data);
    setCurrentReciboId(item.id);
    toast({ title: `Recibo "${item.label}" carregado` });
  };

  const handleExcluirRecibo = (id: string) => {
    deleteRecibo(id);
    setSavedRecibos(loadReciboHistory());
    if (currentReciboId === id) setCurrentReciboId(null);
    toast({ title: 'Recibo removido' });
  };

  // Ao alterar competência, preencher data de emissão e dias úteis/não úteis
  const handleCompetenciaChange = useCallback((comp: string) => {
    setRecibo((p) => {
      const updates: Partial<ReciboData> = { competencia: comp };
      const parts = comp.split('/');
      if (parts.length === 2) {
        const mes = Number(parts[0]);
        const ano = Number(parts[1]);
        if (mes >= 1 && mes <= 12 && ano >= 2000) {
          const dataEmissao = quintoDiaUtilSubsequente(comp, feriadosMunicipais);
          if (dataEmissao) updates.dataEmissao = dataEmissao;
          const { uteis, naoUteis } = contarDiasUteisMes(ano, mes, feriadosMunicipais);
          updates.diasUteis = uteis;
          updates.diasNaoUteis = naoUteis;
        }
      }
      return { ...p, ...updates };
    });
  }, [feriadosMunicipais]);

  const handleAddFeriado = async () => {
    const dia = Number(novoFeriado.dia);
    const mes = Number(novoFeriado.mes);
    if (!novoFeriado.nome.trim() || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
      toast({ title: 'Preencha nome, dia e mês corretamente', variant: 'destructive' });
      return;
    }
    await addFeriado({ nome: novoFeriado.nome.trim(), dia, mes });
    setNovoFeriado({ nome: '', dia: '', mes: '' });
    toast({ title: 'Feriado municipal adicionado!' });
  };

  // Selecionar cliente
  const handleClienteSelect = (clienteId: string) => {
    const c = clientes.find((cl) => cl.id === clienteId);
    if (c) {
      setRecibo((prev) => ({
        ...prev,
        clienteId: c.id,
        clienteNome: c.nome,
        clienteDoc: c.tipo === 'PJ' ? c.cnpj : c.cpf,
        clienteTipo: c.tipo,
      }));
    }
  };

  // Adicionar verba do cadastro
  const handleAddVerbaFromDB = (verbaId: string) => {
    const v = verbasDB.find((vb) => vb.id === verbaId);
    if (!v) return;
    const linhaId = crypto.randomUUID();
    const percentNome = extrairPercentualDoNome(v.nome);
    const percentDefault =
      percentNome ?? (v.tipoCalculo === 'hora_extra' ? 50 : v.tipoCalculo === 'adicional_noturno' ? 20 : 0);
    const novaLinha: ReciboLinha = {
      id: linhaId,
      descricao: v.nome,
      pd: v.padraoPD,
      ref: v.referenciaPadrao,
      valor: 0,
      incideFGTS: v.incideFGTS,
      tipoCalculo: v.tipoCalculo,
      quantidade: 0,
      adicionalPercent: percentDefault,
      geraDSR: v.calculaDSR,
    };

    setRecibo((prev) => ({ ...prev, linhas: [...prev.linhas, novaLinha] }));
  };

  // Adicionar linha manual
  const handleAddManual = () => {
    setRecibo((prev) => ({ ...prev, linhas: [...prev.linhas, createEmptyLinha()] }));
  };

  // Remover linha
  const handleRemoveLinha = (id: string) => {
    setRecibo((prev) => ({ ...prev, linhas: prev.linhas.filter((l) => l.id !== id) }));
  };

  // Atualizar linha (e recalcular DSR vinculado se houver)
  const updateLinha = (id: string, updates: Partial<ReciboLinha>) => {
    setRecibo((prev) => {
      let linhas = prev.linhas.map((l) => (l.id === id ? { ...l, ...updates } : l));
      // Se alterou valor de uma linha que tem DSR filho, recalcular DSR
      if ('valor' in updates) {
        const parentValor = updates.valor ?? 0;
        linhas = linhas.map((l) => {
          if (l.isDSR && l.dsrParentId === id && prev.diasUteis > 0) {
            return { ...l, valor: Math.round((parentValor / prev.diasUteis) * prev.diasNaoUteis * 100) / 100 };
          }
          return l;
        });
      }
      // Se alterou o percentual (hora extra / adicional noturno), sincronizar descrição do DSR filho
      // (Descrição do DSR segue apenas o nome da verba — o percentual já
      // está embutido no nome quando cadastrado pelo usuário.)
      return { ...prev, linhas };
    });
  };

  // Calcular valores automáticos
  const handleCalcular = () => {
    setRecibo((prev) => {
      // First pass: calculate non-manual, non-DSR lines
      let linhas = prev.linhas.map((l) => {
        if (l.tipoCalculo !== 'manual' && !l.isDSR) {
          const novoValor = calcularValorLinha(l, prev.salarioBase, prev.jornadaMensal, prev.divisorDiario, !!prev.horista);
          return { ...l, valor: novoValor };
        }
        return l;
      });
      // Second pass: gerar automaticamente as linhas de DSR das verbas marcadas
      const resultado: ReciboLinha[] = [];
      for (const l of linhas) {
        if (l.isDSR) {
          const parent = linhas.find((p) => p.id === l.dsrParentId);
          if (!parent || !parent.geraDSR) continue; // remove DSR órfão
          continue; // será recriado logo após o pai
        }
        resultado.push(l);
        if (l.geraDSR) {
          const existente = linhas.find((d) => d.isDSR && d.dsrParentId === l.id);
          const dsrValor =
            prev.diasUteis > 0
              ? Math.round((l.valor / prev.diasUteis) * prev.diasNaoUteis * 100) / 100
              : 0;
          resultado.push({
            id: existente?.id ?? crypto.randomUUID(),
            descricao: `DSR ${l.descricao}`,
            pd: l.pd,
            ref: String(prev.diasNaoUteis || ''),
            valor: dsrValor,
            incideFGTS: l.incideFGTS,
            tipoCalculo: 'manual',
            isDSR: true,
            dsrParentId: l.id,
          });
        }
      }
      linhas = resultado;
      linhas = linhas.map((l) => {
        if (l.isDSR && l.dsrParentId) {
          const parent = linhas.find((p) => p.id === l.dsrParentId);
          if (parent && prev.diasUteis > 0) {
            const dsrValor = Math.round((parent.valor / prev.diasUteis) * prev.diasNaoUteis * 100) / 100;
            return { ...l, valor: dsrValor };
          }
        }
        return l;
      });
      return { ...prev, linhas };
    });
    toast({ title: 'Valores calculados!' });
  };

  // Lote de recibos
  const handleIncluirNoLote = () => {
    if (!recibo.recebedorNome.trim()) {
      toast({ title: 'Informe o nome do recebedor antes de incluir', variant: 'destructive' });
      return;
    }
    setLote((prev) => [...prev, JSON.parse(JSON.stringify(recibo)) as ReciboData]);
    toast({ title: 'Recibo incluído no lote' });
  };

  const handleRemoverDoLote = (idx: number) => {
    setLote((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEmitirLote = () => {
    if (lote.length === 0) return;
    lote.forEach((r, i) => setTimeout(() => generateReciboPDF(r), i * 350));
    toast({ title: `Emitindo ${lote.length} recibo(s)...` });
  };

  // Totais
  const totais = useMemo(
    () => calcularTotaisRecibo(recibo.linhas, recibo.calcularFGTS, recibo.aliquotaFGTS),
    [recibo.linhas, recibo.calcularFGTS, recibo.aliquotaFGTS]
  );

  const handleGerarPDF = () => {
    if (!recibo.recebedorNome.trim()) {
      toast({ title: 'Nome do recebedor é obrigatório', variant: 'destructive' });
      return;
    }
    generateReciboPDF(recibo);
    toast({ title: 'PDF gerado!' });
  };

  const handleCopiarTexto = () => {
    const texto = generateReciboTexto(recibo);
    navigator.clipboard.writeText(texto);
    toast({ title: 'Texto copiado!' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Recibo Avulso de Pagamento</h2>
        <Button variant="outline" size="sm" onClick={() => setFeriadoDialogOpen(true)}>
          <CalendarDays className="w-4 h-4 mr-1" /> Feriados Municipais
        </Button>
      </div>

      <Tabs defaultValue="recibo-avulso" className="space-y-6">
        <TabsList className="flex w-full max-w-2xl justify-start">
          <TabsTrigger value="recibo-avulso">Recibo Avulso</TabsTrigger>
          <TabsTrigger value="ferias">Cálculo de Férias + Emissão de Recibo</TabsTrigger>
          <TabsTrigger value="verbas">Verbas</TabsTrigger>
        </TabsList>

        <TabsContent value="recibo-avulso" className="space-y-6">

      {/* Recibos salvos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Save className="h-4 w-4" />
            Recibos salvos ({savedRecibos.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleNovoRecibo}>
              <Plus className="h-4 w-4 mr-1" /> Novo recibo
            </Button>
            <Button size="sm" onClick={handleSalvarRecibo}>
              <Save className="h-4 w-4 mr-1" /> {currentReciboId ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((o) => !o)}>
              {historyOpen ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </CardHeader>
        {historyOpen && (
          <CardContent className="pt-0">
            {savedRecibos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum recibo salvo. Clique em "Salvar" para guardar o recibo atual.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {savedRecibos
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((item) => {
                    const isCurrent = item.id === currentReciboId;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                          isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.label}
                            {isCurrent && (
                              <span className="ml-2 text-xs text-primary">(em edição)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total {formatCurrency(item.total)} •{' '}
                            {new Date(item.updatedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCarregarRecibo(item)}
                          title="Carregar para edição"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExcluirRecibo(item.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Bloco 1 — Identificação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Emitido por</Label>
            <Input
              value={recibo.emitidoPor}
              onChange={(e) => setRecibo((p) => ({ ...p, emitidoPor: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente (Empregador) *</Label>
              <Select value={recibo.clienteId} onValueChange={handleClienteSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum cliente cadastrado</SelectItem>
                  ) : (
                    clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} ({c.tipo === 'PJ' ? c.cnpj : c.cpf})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Competência (MM/AAAA) *</Label>
              <Input
                value={recibo.competencia}
                onChange={(e) => handleCompetenciaChange(e.target.value)}
                placeholder="01/2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Dias Úteis</Label>
              <Input
                type="number"
                min={0}
                max={31}
                value={recibo.diasUteis || ''}
                onChange={(e) => setRecibo((p) => ({ ...p, diasUteis: Number(e.target.value) || 0 }))}
                placeholder="22"
              />
            </div>
            <div>
              <Label>Dias Não Úteis</Label>
              <Input
                type="number"
                min={0}
                max={31}
                value={recibo.diasNaoUteis || ''}
                onChange={(e) => setRecibo((p) => ({ ...p, diasNaoUteis: Number(e.target.value) || 0 }))}
                placeholder="8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Recebedor (Empregado) *</Label>
              <Input
                value={recibo.recebedorNome}
                onChange={(e) => setRecibo((p) => ({ ...p, recebedorNome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>CPF do Recebedor</Label>
              <Input
                value={recibo.recebedorCPF}
                onChange={(e) => setRecibo((p) => ({ ...p, recebedorCPF: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Cidade/UF *</Label>
              <Input
                value={recibo.cidadeUF}
                onChange={(e) => setRecibo((p) => ({ ...p, cidadeUF: e.target.value }))}
                placeholder="Monte Verde"
              />
            </div>
            <div>
              <Label>Data de Emissão *</Label>
              <Input
                type="date"
                value={recibo.dataEmissao}
                onChange={(e) => setRecibo((p) => ({ ...p, dataEmissao: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Parâmetros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parâmetros para Cálculo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{recibo.horista ? 'Valor da Hora (R$)' : 'Salário Base (R$)'}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={recibo.salarioBase > 0 ? formatCurrencyInput(String(Math.round(recibo.salarioBase * 100))) : ''}
                onChange={(e) => {
                  const val = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                  setRecibo((p) => ({ ...p, salarioBase: val }));
                }}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Jornada Mensal (horas)</Label>
              <Select
                value={String(recibo.jornadaMensal)}
                onValueChange={(v) => setRecibo((p) => ({ ...p, jornadaMensal: Number(v) }))}
                disabled={!!recibo.horista}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="220">220h</SelectItem>
                  <SelectItem value="200">200h</SelectItem>
                  <SelectItem value="180">180h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Divisor Diário</Label>
              <Input
                type="number"
                value={recibo.divisorDiario}
                onChange={(e) => setRecibo((p) => ({ ...p, divisorDiario: Number(e.target.value) || 30 }))}
                disabled={!!recibo.horista}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="horista"
              checked={!!recibo.horista}
              onCheckedChange={(v) => setRecibo((p) => ({ ...p, horista: v }))}
            />
            <Label htmlFor="horista" className="cursor-pointer">
              Funcionário horista (o salário informado é o valor-hora; "Horas Trabalhadas" será multiplicada diretamente pelo valor-hora)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Lançamento de Verbas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lançamento de Verbas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={handleAddVerbaFromDB}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Adicionar verba cadastrada" />
              </SelectTrigger>
              <SelectContent>
                {verbasDB.length === 0 ? (
                  <SelectItem value="__none" disabled>Nenhuma verba cadastrada</SelectItem>
                ) : (
                  verbasDB.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleAddManual} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Linha Manual
            </Button>
          </div>

          {recibo.linhas.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="results-table-header">
                    <TableHead className="text-card">Descrição</TableHead>
                    <TableHead className="text-card w-16">P/D</TableHead>
                    <TableHead className="text-card w-20">REF.</TableHead>
                    <TableHead className="text-card w-20">%</TableHead>
                    <TableHead className="text-card w-28">Valor (R$)</TableHead>
                    <TableHead className="text-card w-16">FGTS</TableHead>
                    <TableHead className="text-card w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recibo.linhas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Input
                          value={l.descricao}
                          onChange={(e) => {
                            const nome = e.target.value;
                            const updates: Partial<ReciboLinha> = { descricao: nome };
                            if (l.tipoCalculo === 'hora_extra' || l.tipoCalculo === 'adicional_noturno') {
                              const p = extrairPercentualDoNome(nome);
                              if (p !== null) updates.adicionalPercent = p;
                            }
                            updateLinha(l.id, updates);
                          }}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={l.pd}
                          onValueChange={(v) => updateLinha(l.id, { pd: v as 'P' | 'D' })}
                        >
                          <SelectTrigger className="h-8 w-14">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="P">P</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={l.ref}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const updates: Partial<ReciboLinha> = { ref: raw };
                            // Para verbas de horas, converter automaticamente o valor
                            // digitado na REF para a quantidade (centesimal) usada no cálculo.
                            if (
                              l.tipoCalculo === 'horas' ||
                              l.tipoCalculo === 'hora_extra' ||
                              l.tipoCalculo === 'adicional_noturno'
                            ) {
                              if (raw.includes(':')) {
                                const [h, m] = raw.split(':');
                                const hours = Number(h) || 0;
                                const mins = Number(m) || 0;
                                updates.quantidade = Math.round((hours + mins / 60) * 100) / 100;
                                (updates as any)._horaInput = raw;
                              } else if (raw.trim() !== '') {
                                const n = Number(raw.replace(',', '.'));
                                if (!isNaN(n)) {
                                  updates.quantidade = n;
                                  (updates as any)._horaInput = raw;
                                }
                              }
                            } else if (l.tipoCalculo === 'dias') {
                              const n = Number(raw.replace(',', '.'));
                              if (!isNaN(n)) updates.quantidade = n;
                            }
                            updateLinha(l.id, updates);
                          }}
                          className="h-8 text-sm w-16"
                          placeholder={
                            l.tipoCalculo === 'hora_extra' ||
                            l.tipoCalculo === 'horas' ||
                            l.tipoCalculo === 'adicional_noturno'
                              ? '5:30'
                              : ''
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {(l.tipoCalculo === 'hora_extra' || l.tipoCalculo === 'adicional_noturno') && (
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number"
                              min={0}
                              max={200}
                              value={l.adicionalPercent ?? (l.tipoCalculo === 'hora_extra' ? 50 : 20)}
                              onChange={(e) => updateLinha(l.id, { adicionalPercent: Math.min(200, Math.max(0, Number(e.target.value))) })}
                              className="h-8 text-sm w-[4.5rem]"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={l.valor > 0 ? formatCurrencyInput(String(Math.round(l.valor * 100))) : ''}
                          onChange={(e) => {
                            const val = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                            updateLinha(l.id, { valor: val });
                          }}
                          className="h-8 text-sm w-24"
                          placeholder="0,00"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={l.incideFGTS}
                          onCheckedChange={(v) => updateLinha(l.id, { incideFGTS: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveLinha(l.id)} className="h-8 w-8">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {recibo.linhas.length > 0 && recibo.linhas.some((l) => l.tipoCalculo !== 'manual' || l.isDSR) && (
            <Button onClick={handleCalcular} variant="outline" size="sm">
              <Calculator className="w-4 h-4 mr-1" /> Calcular Valores
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bloco 4 — FGTS e Totalização */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">FGTS e Totalização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="calc-fgts">Calcular FGTS neste recibo?</Label>
              <Switch
                id="calc-fgts"
                checked={recibo.calcularFGTS}
                onCheckedChange={(v) => setRecibo((p) => ({ ...p, calcularFGTS: v }))}
              />
            </div>
            {recibo.calcularFGTS && (
              <div className="flex items-center gap-2">
                <Label>Alíquota:</Label>
                <Input
                  type="number"
                  value={recibo.aliquotaFGTS}
                  onChange={(e) => setRecibo((p) => ({ ...p, aliquotaFGTS: Number(e.target.value) || 8 }))}
                  className="h-8 w-16"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Total Proventos</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(totais.proventos)}</TableCell>
                </TableRow>
                {recibo.calcularFGTS && (
                  <>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs">
                        Base FGTS (proventos c/ incidência − descontos c/ incidência)
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">{formatCurrency(totais.baseFGTS)}</TableCell>
                    </TableRow>
                    {totais.fgtsValor > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">FGTS ({recibo.aliquotaFGTS}%)</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(totais.fgtsValor)}</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
                <TableRow>
                  <TableCell className="font-medium">Total Descontos</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {totais.descontos > 0 ? `- ${formatCurrency(totais.descontos)}` : formatCurrency(0)}
                  </TableCell>
                </TableRow>
                <TableRow className="results-table-total">
                  <TableCell className="font-bold text-base">TOTAL LÍQUIDO</TableCell>
                  <TableCell className="text-right font-bold text-base">{formatCurrency(totais.totalLiquido)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleGerarPDF}>
              <FileDown className="w-4 h-4 mr-1" /> Gerar Recibo (PDF)
            </Button>
            <Button variant="outline" onClick={handleCopiarTexto}>
              <Copy className="w-4 h-4 mr-1" /> Copiar Recibo (Texto)
            </Button>
            <Button variant="outline" onClick={handleIncluirNoLote}>
              <Plus className="w-4 h-4 mr-1" /> Incluir Recibo (lote)
            </Button>
          </div>

          {lote.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Recibos no lote ({lote.length})</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEmitirLote}>
                    <FileDown className="w-4 h-4 mr-1" /> Emitir todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLote([])}>
                    Limpar lote
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {lote.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
                    <span className="truncate">
                      {r.recebedorNome || 'Sem nome'} • {r.competencia || 's/ competência'} •{' '}
                      {formatCurrency(calcularTotaisRecibo(r.linhas, r.calcularFGTS, r.aliquotaFGTS).totalLiquido)}
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setRecibo(r)} title="Carregar">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoverDoLote(idx)} title="Remover">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="ferias">
          <VacationReceiptModule />
        </TabsContent>

        <TabsContent value="verbas">
          <VerbasPage />
        </TabsContent>
      </Tabs>

      {/* Dialog Feriados Municipais */}
      <Dialog open={feriadoDialogOpen} onOpenChange={setFeriadoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Feriados Municipais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input
                  value={novoFeriado.nome}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Padroeiro"
                />
              </div>
              <div>
                <Label>Dia</Label>
                <Input
                  type="number" min={1} max={31}
                  value={novoFeriado.dia}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, dia: e.target.value }))}
                  placeholder="15"
                />
              </div>
              <div>
                <Label>Mês</Label>
                <Input
                  type="number" min={1} max={12}
                  value={novoFeriado.mes}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, mes: e.target.value }))}
                  placeholder="8"
                />
              </div>
              <Button size="sm" onClick={handleAddFeriado}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {feriadosMunicipais.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriadosMunicipais.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.nome}</TableCell>
                      <TableCell>{String(f.dia).padStart(2, '0')}/{String(f.mes).padStart(2, '0')}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => deleteFeriado(f.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {feriadosMunicipais.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum feriado municipal cadastrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReciboPage;
