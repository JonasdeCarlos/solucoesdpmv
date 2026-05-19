import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useClientes } from '@/hooks/useClientes';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatCurrencyInput, parseCurrencyToNumber } from '@/utils/formatters';
import { calculateVacationReceipt, createEmptyVacationReceiptData, type VacationHistoryItem, type VacationReceiptData, type VacationType } from '@/types/vacationReceipt';
import { generateVacationReceiptPDF } from '@/utils/vacationReceiptPdf';
import { ArrowLeft, ArrowRight, Download, FileDown, Save, Search } from 'lucide-react';

const steps = ['Dados', 'Período', 'Remuneração', 'Resultado'];
const STORAGE_KEY = 'vacation_receipt_state_v1';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { step?: number; data?: VacationReceiptData; filters?: { company: string; employee: string; date: string } } : null;
  } catch {
    return null;
  }
}

function toDate(value: string) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

function addDays(value: string, days: number) {
  const date = toDate(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function inclusiveDays(start: string, end: string) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function formatDateBR(value: string) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function moneyInput(value: number, onChange: (value: number) => void, placeholder = '0,00') {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value > 0 ? formatCurrencyInput(String(Math.round(value * 100))) : ''}
      onChange={(e) => onChange(parseCurrencyToNumber(formatCurrencyInput(e.target.value)))}
      placeholder={placeholder}
    />
  );
}

function mapCalculationRow(row: any, receipt?: any): VacationHistoryItem {
  return {
    id: row.id,
    receiptId: receipt?.id,
    fileName: receipt?.file_name,
    companyId: row.company_id || '',
    companyName: row.company_name || '',
    companyDoc: row.company_doc || '',
    employeeName: row.employee_name || '',
    employeeCpf: row.employee_cpf || '',
    role: row.role || '',
    registration: row.registration || '',
    pis: row.pis || '',
    department: row.department || '',
    acquisitionStart: row.acquisition_start,
    acquisitionEnd: row.acquisition_end,
    concessionStart: row.concession_start,
    concessionEnd: row.concession_end,
    leaveStart: row.leave_start,
    leaveEnd: row.leave_end,
    vacationDays: row.vacation_days || 0,
    returnDate: row.return_date,
    vacationType: (row.vacation_type || 'Integrais') as VacationType,
    fractionDescription: row.fraction_description || '',
    salaryBase: Number(row.salary_base) || 0,
    avgVariables: Number(row.avg_variables) || 0,
    otherPayItems: Number(row.other_pay_items) || 0,
    baseRemuneration: Number(row.base_remuneration) || 0,
    vacationValue: Number(row.vacation_value) || 0,
    oneThirdValue: Number(row.one_third_value) || 0,
    abonoEnabled: Boolean(row.abono_enabled),
    abonoDays: Number(row.abono_days) || 0,
    abonoValue: Number(row.abono_value) || 0,
    abonoOneThirdValue: Number(row.abono_one_third_value) || 0,
    discountsValue: Number(row.discounts_value) || 0,
    discountsDesc: row.discounts_desc || '',
    effectiveLeaveDays: Math.max(0, (Number(row.vacation_days) || 0) - (row.abono_enabled ? Number(row.abono_days) || 0 : 0)),
    grossTotal: Number(row.gross_total) || 0,
    netTotal: Number(row.net_total) || 0,
    payMethod: row.pay_method || 'Depósito',
    payDate: row.pay_date,
    signaturePlace: row.signature_place || 'Monte Verde',
    signatureDate: row.signature_date,
    responsibleName: row.responsible_name || '',
    responsibleCpf: row.responsible_cpf || '',
    responsibleRole: row.responsible_role || '',
    createdAt: row.created_at,
  };
}

export function VacationReceiptModule() {
  const { clientes } = useClientes();
  const { toast } = useToast();
  const persisted = loadPersistedState();
  const [step, setStep] = useState(persisted?.step ?? 0);
  const [data, setData] = useState<VacationReceiptData>(persisted?.data ?? createEmptyVacationReceiptData());
  const [history, setHistory] = useState<VacationHistoryItem[]>([]);
  const [filters, setFilters] = useState(persisted?.filters ?? { company: '', employee: '', date: '' });
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => calculateVacationReceipt(data), [data]);
  const maxAbonoDays = Math.floor(data.vacationDays / 3);

  const update = (patch: Partial<VacationReceiptData>) => setData((prev) => ({ ...prev, ...patch }));

  const loadHistory = async () => {
    const { data: rows, error } = await supabase
      .from('vacation_calculations' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return;
    const ids = (rows || []).map((row: any) => row.id);
    const { data: receipts } = ids.length
      ? await supabase.from('vacation_receipts' as any).select('*').in('calculation_id', ids)
      : { data: [] as any[] };
    setHistory((rows || []).map((row: any) => mapCalculationRow(row, (receipts || []).find((r: any) => r.calculation_id === row.id))));
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data, filters }));
  }, [step, data, filters]);

  useEffect(() => {
    const days = inclusiveDays(data.leaveStart, data.leaveEnd);
    if (days > 0) update({ vacationDays: days, returnDate: addDays(data.leaveEnd, 1), payDate: addDays(data.leaveStart, -2) });
  }, [data.leaveStart, data.leaveEnd]);

  useEffect(() => {
    if (data.abonoEnabled && data.abonoDays > maxAbonoDays) update({ abonoDays: maxAbonoDays });
  }, [data.abonoEnabled, data.abonoDays, maxAbonoDays]);

  const warnings = useMemo(() => {
    const items: string[] = [];
    const pairs = [
      ['Período aquisitivo', data.acquisitionStart, data.acquisitionEnd],
      ['Período de gozo', data.leaveStart, data.leaveEnd],
    ];
    pairs.forEach(([label, start, end]) => {
      if (start && end && toDate(end) && toDate(start) && toDate(end)! < toDate(start)!) items.push(`${label}: fim anterior ao início.`);
    });
    if (data.abonoEnabled && data.abonoDays > maxAbonoDays) items.push(`Dias vendidos não podem exceder ${maxAbonoDays} dia(s).`);
    return items;
  }, [data, maxAbonoDays]);

  const validateStep = (target = step) => {
    if (target === 0 && (!data.companyName || !data.employeeName.trim() || !data.employeeCpf.trim())) return 'Selecione empresa e informe nome/CPF do empregado.';
    if (target === 1 && (!data.acquisitionStart || !data.acquisitionEnd || !data.leaveStart || !data.leaveEnd || data.vacationDays <= 0 || !data.returnDate)) return 'Preencha todos os períodos obrigatórios com datas válidas.';
    if (target === 1 && warnings.length) return warnings[0];
    if (target === 2 && (data.salaryBase <= 0 || data.avgVariables < 0 || data.otherPayItems < 0 || data.discountsValue < 0)) return 'Informe remuneração positiva e não use valores negativos.';
    if (target === 2 && data.abonoEnabled && (data.abonoDays <= 0 || data.abonoDays > maxAbonoDays)) return `Informe dias vendidos entre 1 e ${maxAbonoDays}.`;
    return '';
  };

  const nextStep = () => {
    const error = validateStep();
    if (error) {
      toast({ title: error, variant: 'destructive' });
      return;
    }
    setStep((prev) => Math.min(3, prev + 1));
  };

  const selectCompany = (id: string) => {
    const company = clientes.find((c) => c.id === id);
    if (!company) return;
    update({ companyId: company.id, companyName: company.nome, companyDoc: company.tipo === 'PJ' ? company.cnpj : company.cpf });
  };

  const buildRow = () => ({
    company_id: data.companyId || null,
    company_name: data.companyName,
    company_doc: data.companyDoc,
    employee_name: data.employeeName.trim(),
    employee_cpf: data.employeeCpf.trim(),
    role: data.role,
    registration: data.registration,
    pis: data.pis,
    department: data.department,
    acquisition_start: data.acquisitionStart,
    acquisition_end: data.acquisitionEnd,
    concession_start: null,
    concession_end: null,
    leave_start: data.leaveStart,
    leave_end: data.leaveEnd,
    vacation_days: data.vacationDays,
    return_date: data.returnDate,
    vacation_type: data.vacationType,
    fraction_description: data.fractionDescription,
    salary_base: data.salaryBase,
    avg_variables: data.avgVariables,
    other_pay_items: data.otherPayItems,
    base_remuneration: result.baseRemuneration,
    vacation_value: result.vacationValue,
    one_third_value: result.oneThirdValue,
    abono_enabled: data.abonoEnabled,
    abono_days: data.abonoEnabled ? data.abonoDays : 0,
    abono_value: result.abonoValue,
    abono_one_third_value: result.abonoOneThirdValue,
    discounts_value: data.discountsValue,
    discounts_desc: data.discountsDesc,
    gross_total: result.grossTotal,
    net_total: result.netTotal,
    pay_method: data.payMethod,
    pay_date: data.payDate,
    signature_place: data.signaturePlace,
    signature_date: data.signatureDate,
    responsible_name: data.responsibleName,
    responsible_cpf: data.responsibleCpf,
    responsible_role: data.responsibleRole,
    created_by: 'Monte Verde Contabilidade',
  });

  const saveReceipt = async (alsoPdf = false) => {
    const finalError = [0, 1, 2].map(validateStep).find(Boolean);
    if (finalError) {
      toast({ title: finalError, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const fileInfo = generateVacationReceiptPDF(data, result, alsoPdf ? 'save' : 'blob') as any;
    const { data: saved, error } = await supabase.from('vacation_calculations' as any).insert(buildRow()).select('id').single();
    const savedCalculation = saved as any;
    if (!error && savedCalculation?.id) {
      await supabase.from('vacation_receipts' as any).insert({
        calculation_id: savedCalculation.id,
        template_version: 'recibo-ferias-v1',
        pdf_data: { ...data, ...result },
        file_name: fileInfo.fileName || '',
      });
      toast({ title: alsoPdf ? 'Recibo salvo e PDF gerado!' : 'Recibo salvo no histórico!' });
      await loadHistory();
    } else {
      toast({ title: 'Não foi possível salvar o recibo', variant: 'destructive' });
    }
    setSaving(false);
  };

  const filteredHistory = history.filter((item) => {
    const companyOk = !filters.company || item.companyName.toLowerCase().includes(filters.company.toLowerCase());
    const employeeOk = !filters.employee || item.employeeName.toLowerCase().includes(filters.employee.toLowerCase());
    const dateOk = !filters.date || item.leaveStart.includes(filters.date) || item.leaveEnd.includes(filters.date) || item.payDate.includes(filters.date);
    return companyOk && employeeOk && dateOk;
  });

  const renderStep = () => {
    if (step === 0) return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Label>Empresa *</Label><Select value={data.companyId} onValueChange={selectCompany}><SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger><SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.tipo === 'PJ' ? c.cnpj : c.cpf})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Nome do empregado *</Label><Input value={data.employeeName} onChange={(e) => update({ employeeName: e.target.value })} /></div>
        <div><Label>CPF do empregado *</Label><Input value={data.employeeCpf} onChange={(e) => update({ employeeCpf: e.target.value })} placeholder="000.000.000-00" /></div>
        <div><Label>Cargo/Função</Label><Input value={data.role} onChange={(e) => update({ role: e.target.value })} /></div>
        <div><Label>Matrícula</Label><Input value={data.registration} onChange={(e) => update({ registration: e.target.value })} /></div>
        <div><Label>PIS</Label><Input value={data.pis} onChange={(e) => update({ pis: e.target.value })} /></div>
        <div><Label>Setor</Label><Input value={data.department} onChange={(e) => update({ department: e.target.value })} /></div>
      </div>
    );

    if (step === 1) return (
      <div className="space-y-4">
        {warnings.length > 0 && <Alert variant="destructive"><AlertDescription>{warnings.join(' ')}</AlertDescription></Alert>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Aquisitivo início *</Label><Input type="date" value={data.acquisitionStart} onChange={(e) => update({ acquisitionStart: e.target.value })} /></div>
          <div><Label>Aquisitivo fim *</Label><Input type="date" value={data.acquisitionEnd} onChange={(e) => update({ acquisitionEnd: e.target.value })} /></div>
          <div><Label>Tipo</Label><Select value={data.vacationType} onValueChange={(v) => update({ vacationType: v as VacationType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Integrais">Integrais</SelectItem><SelectItem value="Proporcionais">Proporcionais</SelectItem><SelectItem value="Fracionadas">Fracionadas</SelectItem></SelectContent></Select></div>
          <div><Label>Dias de férias *</Label><Input type="number" min={1} value={data.vacationDays || ''} onChange={(e) => update({ vacationDays: Number(e.target.value) || 0 })} /></div>
          <div><Label>Gozo início *</Label><Input type="date" value={data.leaveStart} onChange={(e) => update({ leaveStart: e.target.value })} /></div>
          <div><Label>Gozo fim *</Label><Input type="date" value={data.leaveEnd} onChange={(e) => update({ leaveEnd: e.target.value })} /></div>
          <div><Label>Data de retorno *</Label><Input type="date" value={data.returnDate} onChange={(e) => update({ returnDate: e.target.value })} /></div>
        </div>
        {data.vacationType === 'Fracionadas' && <div><Label>Descrição do fracionamento</Label><Input value={data.fractionDescription} onChange={(e) => update({ fractionDescription: e.target.value })} /></div>}
      </div>
    );

    if (step === 2) return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Salário base mensal *</Label>{moneyInput(data.salaryBase, (v) => update({ salaryBase: v }))}</div>
          <div><Label>Médias de variáveis</Label>{moneyInput(data.avgVariables, (v) => update({ avgVariables: v }))}</div>
          <div><Label>Outras verbas incorporáveis</Label>{moneyInput(data.otherPayItems, (v) => update({ otherPayItems: v }))}</div>
        </div>
        <div className="rounded-md border p-3 text-sm"><span className="text-muted-foreground">Remuneração base para férias:</span> <strong>{formatCurrency(result.baseRemuneration)}</strong></div>
        <div className="flex items-center gap-3"><Switch checked={data.abonoEnabled} onCheckedChange={(v) => update({ abonoEnabled: v, abonoDays: v ? data.abonoDays : 0 })} /><Label>Houve abono pecuniário?</Label></div>
        {data.abonoEnabled && <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><Label>Dias vendidos (máx. {maxAbonoDays}) *</Label><Input type="number" min={1} max={maxAbonoDays} value={data.abonoDays || ''} onChange={(e) => update({ abonoDays: Number(e.target.value) || 0 })} /></div><div className="rounded-md border p-3"><Label>Valor do abono</Label><p className="font-semibold">{formatCurrency(result.abonoValue)}</p></div><div className="rounded-md border p-3"><Label>1/3 sobre abono</Label><p className="font-semibold">{formatCurrency(result.abonoOneThirdValue)}</p></div></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label>Descontos</Label>{moneyInput(data.discountsValue, (v) => update({ discountsValue: v }))}</div><div><Label>Descrição dos descontos</Label><Input value={data.discountsDesc} onChange={(e) => update({ discountsDesc: e.target.value })} /></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label>Forma de pagamento</Label><Select value={data.payMethod} onValueChange={(v) => update({ payMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Depósito">Depósito</SelectItem><SelectItem value="PIX">PIX</SelectItem><SelectItem value="Dinheiro">Dinheiro</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent></Select></div><div><Label>Data de pagamento</Label><Input type="date" value={data.payDate} onChange={(e) => update({ payDate: e.target.value })} /></div></div>
      </div>
    );

    return (
      <div className="space-y-4">
        <Table><TableBody>
          {[['Remuneração base para férias', result.baseRemuneration], ['Valor das férias', result.vacationValue], ['1/3 constitucional', result.oneThirdValue], ...(data.abonoEnabled ? [['Abono', result.abonoValue], ['1/3 sobre abono', result.abonoOneThirdValue]] : []), ...(data.discountsValue > 0 ? [['Descontos', -data.discountsValue]] : []), ['Total bruto', result.grossTotal], ['Valor líquido', result.netTotal]].filter(([, value]) => Number(value) !== 0).map(([label, value]) => <TableRow key={String(label)}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(Number(value))}</TableCell></TableRow>)}
        </TableBody></Table>
        <Card><CardContent className="pt-4 text-sm space-y-1"><p><strong>Memória:</strong></p><p>RB = {formatCurrency(data.salaryBase)} + {formatCurrency(data.avgVariables)} + {formatCurrency(data.otherPayItems)} = {formatCurrency(result.baseRemuneration)}</p><p>VF = RB ÷ 30 × {data.vacationDays} = {formatCurrency(result.vacationValue)}</p><p>T = VF ÷ 3 = {formatCurrency(result.oneThirdValue)}</p>{data.abonoEnabled && <p>VA = RB ÷ 30 × {data.abonoDays} = {formatCurrency(result.abonoValue)}; TA = VA ÷ 3 = {formatCurrency(result.abonoOneThirdValue)}</p>}<p>Líquido = {formatCurrency(result.grossTotal)} - {formatCurrency(data.discountsValue)} = {formatCurrency(result.netTotal)}</p></CardContent></Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><Label>Local da assinatura</Label><Input value={data.signaturePlace} onChange={(e) => update({ signaturePlace: e.target.value })} /></div><div><Label>Data da assinatura</Label><Input type="date" value={data.signatureDate} onChange={(e) => update({ signatureDate: e.target.value })} /></div><div><Label>Responsável/cargo</Label><Input value={data.responsibleName} onChange={(e) => update({ responsibleName: e.target.value })} placeholder="Nome do responsável" /></div></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => generateVacationReceiptPDF(data, result)}><FileDown className="w-4 h-4 mr-1" /> Gerar Recibo (PDF)</Button><Button variant="outline" disabled={saving} onClick={() => saveReceipt(false)}><Save className="w-4 h-4 mr-1" /> Salvar Recibo</Button><Button variant="outline" onClick={() => setStep(0)}>Editar dados</Button></div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Cálculo de Férias + Emissão de Recibo</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">{steps.map((label, index) => <Badge key={label} variant={index === step ? 'default' : 'outline'}>{index + 1}. {label}</Badge>)}</div>
          {renderStep()}
          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            {step < 3 && <Button onClick={nextStep}>Avançar <ArrowRight className="w-4 h-4 ml-1" /></Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recibos de Férias Emitidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><Label>Empresa</Label><Input value={filters.company} onChange={(e) => setFilters((p) => ({ ...p, company: e.target.value }))} /></div><div><Label>Empregado</Label><Input value={filters.employee} onChange={(e) => setFilters((p) => ({ ...p, employee: e.target.value }))} /></div><div><Label>Data/competência</Label><Input value={filters.date} onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} placeholder="2026-01" /></div></div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Empregado</TableHead><TableHead>Empresa</TableHead><TableHead>Gozo</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead className="w-28"><Search className="w-4 h-4" /></TableHead></TableRow></TableHeader><TableBody>{filteredHistory.map((item) => <TableRow key={item.id}><TableCell>{item.employeeName}</TableCell><TableCell>{item.companyName}</TableCell><TableCell>{formatDateBR(item.leaveStart)} a {formatDateBR(item.leaveEnd)}</TableCell><TableCell>{formatDateBR(item.payDate)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.netTotal)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => generateVacationReceiptPDF(item, item)}><Download className="w-4 h-4 mr-1" /> PDF</Button></TableCell></TableRow>)}{filteredHistory.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum recibo de férias emitido.</TableCell></TableRow>}</TableBody></Table></div>
        </CardContent>
      </Card>
    </div>
  );
}
