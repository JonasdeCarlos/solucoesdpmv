import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBhAll, BhSettings } from '@/hooks/useBancoHorasModulo';
import { parseHHMM, formatHHMM } from '@/utils/bancoHoras/calc';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function minutesToHHMM(min: number) {
  return formatHHMM(min, false);
}

export default function BhParametrosPage() {
  const { settings, employees, loading, refetch } = useBhAll();
  const global = useMemo(() => settings.find((s) => s.scope === 'global'), [settings]);
  const [globalDaily, setGlobalDaily] = useState<string>('08:00');
  const [threshold, setThreshold] = useState<string>('60');
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('all');
  const [busca, setBusca] = useState<string>('');

  useEffect(() => {
    if (global) {
      setGlobalDaily(minutesToHHMM(global.daily_minutes));
      setThreshold(String(global.trend_threshold_minutes));
    }
  }, [global]);

  const saveGlobal = async () => {
    const min = parseHHMM(globalDaily);
    const tr = parseInt(threshold, 10);
    if (!min || min <= 0) { toast.error('Carga diária inválida'); return; }
    if (!global) {
      await supabase.from('bh_settings' as any).insert({ scope: 'global', daily_minutes: min, trend_threshold_minutes: tr } as any);
    } else {
      await supabase.from('bh_settings' as any).update({ daily_minutes: min, trend_threshold_minutes: tr } as any).eq('id', global.id);
    }
    toast.success('Parâmetros globais salvos');
    refetch();
  };

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => e.empresa_cnpj && map.set(e.empresa_cnpj, e.empresa_nome));
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [employees]);

  const empresaSettings = useMemo(() => settings.filter((s) => s.scope === 'empresa'), [settings]);
  const empSettings = useMemo(() => settings.filter((s) => s.scope === 'colaborador'), [settings]);

  const employeesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return employees.filter((e) => {
      if (empresaFiltro !== 'all' && e.empresa_cnpj !== empresaFiltro) return false;
      if (!q) return true;
      return (
        (e.nome || '').toLowerCase().includes(q) ||
        (e.codigo || '').toLowerCase().includes(q)
      );
    });
  }, [employees, empresaFiltro, busca]);

  const setEmpresaCarga = async (cnpj: string, hhmm: string) => {
    const min = parseHHMM(hhmm);
    if (!min) return;
    const existing = empresaSettings.find((s) => s.empresa_cnpj === cnpj);
    if (existing) {
      await supabase.from('bh_settings' as any).update({ daily_minutes: min } as any).eq('id', existing.id);
    } else {
      await supabase.from('bh_settings' as any).insert({ scope: 'empresa', empresa_cnpj: cnpj, daily_minutes: min } as any);
    }
    toast.success('Salvo');
    refetch();
  };

  const setEmpregadoCarga = async (employeeId: string, hhmm: string) => {
    const min = parseHHMM(hhmm);
    if (!min) return;
    const existing = empSettings.find((s) => s.employee_id === employeeId);
    if (existing) {
      await supabase.from('bh_settings' as any).update({ daily_minutes: min } as any).eq('id', existing.id);
    } else {
      await supabase.from('bh_settings' as any).insert({ scope: 'colaborador', employee_id: employeeId, daily_minutes: min } as any);
    }
    toast.success('Salvo');
    refetch();
  };

  const removerSetting = async (s: BhSettings) => {
    await supabase.from('bh_settings' as any).delete().eq('id', s.id);
    toast.success('Removido');
    refetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros globais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Carga horária diária padrão (HH:MM)</Label>
            <Input value={globalDaily} onChange={(e) => setGlobalDaily(e.target.value)} placeholder="08:00" />
          </div>
          <div>
            <Label className="text-xs">Limiar de tendência (minutos)</Label>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} type="number" />
          </div>
          <div className="flex items-end">
            <Button onClick={saveGlobal}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Carga diária por empresa (sobrepõe global)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {empresas.map((e) => {
            const cur = empresaSettings.find((s) => s.empresa_cnpj === e.cnpj);
            return (
              <EmpresaRow key={e.cnpj} cnpj={e.cnpj} nome={e.nome} current={cur?.daily_minutes} onSave={(hhmm) => setEmpresaCarga(e.cnpj, hhmm)} onRemove={cur ? () => removerSetting(cur) : undefined} />
            );
          })}
          {empresas.length === 0 && <p className="text-xs text-muted-foreground">Importe um PDF para listar empresas.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Carga diária por colaborador (sobrepõe empresa/global)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-1">
              <Label className="text-xs">Filtrar por empresa</Label>
              <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Buscar colaborador</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {employeesFiltrados.length} de {employees.length} colaboradores
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
          {employeesFiltrados.map((emp) => {
            const cur = empSettings.find((s) => s.employee_id === emp.id);
            return (
              <EmpRow key={emp.id} nome={`${emp.nome} (${emp.codigo})`} current={cur?.daily_minutes} onSave={(hhmm) => setEmpregadoCarga(emp.id, hhmm)} onRemove={cur ? () => removerSetting(cur) : undefined} />
            );
          })}
          {employeesFiltrados.length === 0 && <p className="text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmpresaRow({ cnpj, nome, current, onSave, onRemove }: { cnpj: string; nome: string; current?: number; onSave: (hhmm: string) => void; onRemove?: () => void }) {
  const [v, setV] = useState(current ? minutesToHHMM(current) : '');
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="text-sm">{nome}</div>
        <div className="text-xs text-muted-foreground">{cnpj}</div>
      </div>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="w-24" placeholder="08:00" />
      <Button size="sm" onClick={() => onSave(v)}>Salvar</Button>
      {onRemove && <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>}
    </div>
  );
}

function EmpRow({ nome, current, onSave, onRemove }: { nome: string; current?: number; onSave: (hhmm: string) => void; onRemove?: () => void }) {
  const [v, setV] = useState(current ? minutesToHHMM(current) : '');
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-sm">{nome}</div>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="w-24" placeholder="08:00" />
      <Button size="sm" onClick={() => onSave(v)}>Salvar</Button>
      {onRemove && <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>}
    </div>
  );
}
