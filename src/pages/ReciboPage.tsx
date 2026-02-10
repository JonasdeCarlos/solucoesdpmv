import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type Client } from '@/types/client';
import { type Verba, TIPO_CALCULO_LABELS } from '@/types/verba';
import {
  type ReciboData, type ReciboLinha,
  createEmptyReciboData, createEmptyLinha,
  calcularValorLinha, calcularTotaisRecibo,
} from '@/types/recibo';
import { generateReciboPDF, generateReciboTexto } from '@/utils/reciboGenerator';
import { formatCurrency, formatCurrencyInput, parseCurrencyToNumber } from '@/utils/formatters';
import { Plus, Trash2, FileDown, Copy, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ReciboPage = () => {
  const [clientes] = useLocalStorage<Client[]>('mv_clientes', []);
  const [verbasDB] = useLocalStorage<Verba[]>('mv_verbas', []);
  const [recibo, setRecibo] = useState<ReciboData>(createEmptyReciboData());
  const { toast } = useToast();

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
    const novaLinha: ReciboLinha = {
      id: crypto.randomUUID(),
      descricao: v.nome,
      pd: v.padraoPD,
      ref: v.referenciaPadrao,
      valor: 0,
      incideFGTS: v.incideFGTS,
      tipoCalculo: v.tipoCalculo,
      quantidade: 0,
      adicionalPercent: v.tipoCalculo === 'hora_extra' ? 50 : v.tipoCalculo === 'adicional_noturno' ? 20 : 0,
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

  // Atualizar linha
  const updateLinha = (id: string, updates: Partial<ReciboLinha>) => {
    setRecibo((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  // Calcular valores automáticos
  const handleCalcular = () => {
    setRecibo((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) => {
        if (l.tipoCalculo !== 'manual') {
          const novoValor = calcularValorLinha(l, prev.salarioBase, prev.jornadaMensal, prev.divisorDiario);
          return { ...l, valor: novoValor };
        }
        return l;
      }),
    }));
    toast({ title: 'Valores calculados!' });
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
      <h2 className="text-xl font-bold">Recibo Avulso de Pagamento</h2>

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
                onChange={(e) => setRecibo((p) => ({ ...p, competencia: e.target.value }))}
                placeholder="01/2026"
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
              <Label>Salário Base (R$)</Label>
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
              />
            </div>
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
                    <TableHead className="text-card w-20">Qtd</TableHead>
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
                          onChange={(e) => updateLinha(l.id, { descricao: e.target.value })}
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
                          onChange={(e) => updateLinha(l.id, { ref: e.target.value })}
                          className="h-8 text-sm w-16"
                        />
                      </TableCell>
                      <TableCell>
                        {l.tipoCalculo !== 'manual' && (
                          <Input
                            type="number"
                            value={l.quantidade || ''}
                            onChange={(e) => updateLinha(l.id, { quantidade: Number(e.target.value) })}
                            className="h-8 text-sm w-16"
                            placeholder="0"
                          />
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

          {recibo.linhas.length > 0 && recibo.linhas.some((l) => l.tipoCalculo !== 'manual') && (
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
                {recibo.calcularFGTS && totais.fgtsValor > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">FGTS ({recibo.aliquotaFGTS}%)</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(totais.fgtsValor)}</TableCell>
                  </TableRow>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReciboPage;
