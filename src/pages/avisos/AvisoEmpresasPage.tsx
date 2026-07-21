import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { useDigisacUsers } from '@/hooks/useDigisacUsers';
import { formatCnpj } from '@/utils/avisos/normalize';
import { pingDigisac } from '@/utils/avisos/digisac';
import { Save, Loader2, X, Wrench, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCnpj } from '@/utils/avisos/normalize';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const AvisoEmpresasPage = () => {
  const { empresas, loading, setResponsavelAndPropagate, updateEmpresa } = useAvisoEmpresas();
  const { users: digisacUsers, loading: loadingUsers, error: usersError } = useDigisacUsers();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [editingWa, setEditingWa] = useState<Record<string, string[]>>({});
  const [editingGestor, setEditingGestor] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<Record<string, string>>({});
  const [newNumByEmp, setNewNumByEmp] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState({ name: '', code: '', cnpj: '', whatsapp: '', responsavel: '' });
  const [savingNova, setSavingNova] = useState(false);
  const filt = useMemo(() => empresas.filter((e) =>
    !q || `${e.code} ${e.name} ${e.cnpj} ${e.responsavel} ${(e.whatsapp_numeros || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  ), [empresas, q]);

  const responsaveisUnicos = useMemo(() => {
    const set = new Set<string>();
    empresas.forEach((e) => { const r = (e.responsavel || '').trim(); if (r) set.add(r); });
    Object.values(editing).forEach((r) => { const v = (r || '').trim(); if (v) set.add(v); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [empresas, editing]);

  const dirtyIds = useMemo(() => {
    return Object.entries(editing)
      .filter(([id, v]) => {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) return false;
        return (v ?? '').trim() !== (emp.responsavel || '');
      })
      .map(([id]) => id);
  }, [editing, empresas]);

  const dirtyWaIds = useMemo(() => {
    return Object.entries(editingWa)
      .filter(([id, arr]) => {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) return false;
        const cur = (emp.whatsapp_numeros || []).map((n) => String(n).replace(/\D/g, '')).filter(Boolean);
        const next = (arr || []).map((n) => String(n).replace(/\D/g, '')).filter(Boolean);
        return cur.join(',') !== next.join(',');
      })
      .map(([id]) => id);
  }, [editingWa, empresas]);

  const dirtyGestorIds = useMemo(() => {
    return Object.entries(editingGestor)
      .filter(([id, v]) => {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) return false;
        return (v ?? '') !== (emp.gestor_digisac_user_id || '');
      })
      .map(([id]) => id);
  }, [editingGestor, empresas]);

  const dirtyNameIds = useMemo(() => {
    return Object.entries(editingName)
      .filter(([id, v]) => {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) return false;
        return (v ?? '').trim() !== (emp.name || '');
      })
      .map(([id]) => id);
  }, [editingName, empresas]);

  const aplicarEmTodosFiltrados = (valor: string) => {
    const next: Record<string, string> = { ...editing };
    filt.forEach((e) => { next[e.id] = valor; });
    setEditing(next);
  };

  const saveAll = async () => {
    if (dirtyIds.length === 0 && dirtyWaIds.length === 0 && dirtyGestorIds.length === 0 && dirtyNameIds.length === 0) {
      toast.info('Nenhuma alteração pendente.');
      return;
    }
    setSaving(true);
    try {
      let ok = 0;
      for (const id of dirtyIds) {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) continue;
        const novo = (editing[id] ?? '').trim();
        const { error } = await setResponsavelAndPropagate(emp, novo);
        if (!error) ok++;
      }
      for (const id of dirtyWaIds) {
        const emp = empresas.find((e) => e.id === id);
        if (!emp) continue;
        const nums = (editingWa[id] ?? []).map((n) => String(n).replace(/\D/g, '')).filter(Boolean);
        // Reseta o contact_id aprendido para evitar que o Digisac continue enviando
        // ao contato antigo mesmo após a edição/remoção de números.
        const { error } = await updateEmpresa(id, { whatsapp_numeros: nums, whatsapp: nums[0] || '', digisac_contact_id: null } as any);
        if (!error) ok++;
      }
      for (const id of dirtyGestorIds) {
        const val = (editingGestor[id] ?? '').trim();
        const { error } = await updateEmpresa(id, { gestor_digisac_user_id: val || null } as any);
        if (!error) ok++;
      }
      for (const id of dirtyNameIds) {
        const novoNome = (editingName[id] ?? '').trim();
        if (!novoNome) continue;
        const { error } = await updateEmpresa(id, { name: novoNome } as any);
        if (!error) ok++;
      }
      setEditing({});
      setEditingWa({});
      setEditingGestor({});
      setEditingName({});
      setNewNumByEmp({});
      toast.success(`${ok} empresa(s) atualizadas.`);
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || 'erro'));
    } finally {
      setSaving(false);
    }
  };

  const descartar = () => { setEditing({}); setEditingWa({}); setEditingGestor({}); setEditingName({}); setNewNumByEmp({}); };

  const normName = (s: string) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  const criarEmpresa = async () => {
    const name = nova.name.trim();
    if (!name) { toast.error('Informe a razão social.'); return; }
    const cnpjN = normalizeCnpj(nova.cnpj);
    const codeT = nova.code.trim();
    const nameN = normName(name);

    // Cruzamento: CNPJ → código → razão social
    const dup = empresas.find((e) =>
      (cnpjN && normalizeCnpj(e.cnpj) === cnpjN) ||
      (codeT && String(e.code).trim() === codeT) ||
      (nameN && normName(e.name) === nameN)
    );
    if (dup) {
      toast.error(`Já existe empresa equivalente: ${dup.code} — ${dup.name}`);
      return;
    }

    setSavingNova(true);
    try {
      const codigoFinal = codeT || `MAN-${Date.now().toString(36).toUpperCase()}`;
      const wa = (nova.whatsapp || '').replace(/\D/g, '');
      const { error } = await supabase.from('aviso_empresas' as any).insert({
        code: codigoFinal,
        name,
        cnpj: cnpjN,
        responsavel: nova.responsavel.trim(),
        whatsapp: wa,
        whatsapp_numeros: wa ? [wa] : [],
      } as any);
      if (error) throw error;
      toast.success('Empresa cadastrada.');
      setNovaOpen(false);
      setNova({ name: '', code: '', cnpj: '', whatsapp: '', responsavel: '' });
    } catch (e: any) {
      toast.error('Falha ao cadastrar: ' + (e?.message || 'erro'));
    } finally {
      setSavingNova(false);
    }
  };

  const numsOf = (e: any): string[] =>
    editingWa[e.id] !== undefined ? editingWa[e.id] : (e.whatsapp_numeros || []);

  const addNumber = (empId: string, currentList: string[]) => {
    const raw = (newNumByEmp[empId] || '').replace(/\D/g, '');
    if (!raw) return;
    if (currentList.includes(raw)) { toast.info('Número já cadastrado.'); return; }
    setEditingWa((s) => ({ ...s, [empId]: [...currentList, raw] }));
    setNewNumByEmp((s) => ({ ...s, [empId]: '' }));
  };

  const removeNumber = (empId: string, currentList: string[], idx: number) => {
    const next = currentList.filter((_, i) => i !== idx);
    setEditingWa((s) => ({ ...s, [empId]: next }));
  };

  const testarConexao = async () => {
    setPinging(true);
    const r = await pingDigisac();
    setPinging(false);
    if (!r.ok) { toast.error('Falha no ping: ' + (r as any).error); return; }
    const d: any = r.data || {};
    const dig = d.digisac || {};
    const dep = d.departamento || {};
    const linhaDig = dig.ok
      ? `✅ Conexão Digisac: OK (serviço ativo)`
      : `❌ Conexão Digisac: status ${dig.status ?? 'erro'}`;
    const linhaDep = dep.ok
      ? `✅ Departamento Pessoal: OK${dep.nome ? ` (${dep.nome})` : ''}`
      : `❌ Departamento Pessoal: ${dep.status === 404 ? 'ID não encontrado (verifique o Secret DIGISAC_DEPARTMENT_ID_PESSOAL)' : `status ${dep.status ?? 'erro'}`}`;
    const msg = `${linhaDig}\n${linhaDep}`;
    if (dig.ok && dep.ok) toast.success(msg, { duration: 6000 });
    else toast.error(msg, { duration: 8000 });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default">
                <Plus className="w-3 h-3 mr-1" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar empresa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Razão social *</label>
                  <Input value={nova.name} onChange={(e) => setNova((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">Código</label>
                    <Input
                      value={nova.code}
                      onChange={(e) => setNova((s) => ({ ...s, code: e.target.value }))}
                      placeholder="(opcional — auto)"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">CNPJ</label>
                    <Input
                      value={nova.cnpj}
                      onChange={(e) => setNova((s) => ({ ...s, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">WhatsApp</label>
                    <Input
                      value={nova.whatsapp}
                      onChange={(e) => setNova((s) => ({ ...s, whatsapp: e.target.value }))}
                      placeholder="55DDDNUMERO"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Responsável</label>
                    <Input
                      value={nova.responsavel}
                      onChange={(e) => setNova((s) => ({ ...s, responsavel: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O cadastro é cruzado por CNPJ → Código → Razão Social. Empresas equivalentes serão reaproveitadas na próxima importação.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNovaOpen(false)} disabled={savingNova}>Cancelar</Button>
                <Button onClick={criarEmpresa} disabled={savingNova}>
                  {savingNova ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={testarConexao} disabled={pinging}>
            {pinging ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wrench className="w-3 h-3 mr-1" />}
            Testar conexão Digisac
          </Button>
          {(dirtyIds.length + dirtyWaIds.length + dirtyGestorIds.length + dirtyNameIds.length) > 0 && (
            <>
              <span className="text-xs text-amber-700 font-medium">{dirtyIds.length + dirtyWaIds.length + dirtyGestorIds.length + dirtyNameIds.length} alteração(ões) não salvas</span>
              <Button variant="ghost" size="sm" onClick={descartar} disabled={saving}>
                <X className="w-3 h-3 mr-1" /> Descartar
              </Button>
              <Button size="sm" onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Salvar todos
              </Button>
            </>
          )}
          <Link to="/avisos"><Button variant="outline">← Avisos</Button></Link>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <Input placeholder="Buscar por código / nome / CNPJ / responsável" value={q} onChange={(e) => setQ(e.target.value)} className="md:flex-1" />
        {responsaveisUnicos.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Aplicar a {filt.length} filtrada(s):</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              defaultValue=""
              onChange={(ev) => { if (ev.target.value) { aplicarEmTodosFiltrados(ev.target.value); ev.target.value = ''; } }}
            >
              <option value="" disabled>Atribuir responsável...</option>
              {responsaveisUnicos.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
      </div>
      <datalist id="responsaveis-list">
        {responsaveisUnicos.map((r) => <option key={r} value={r} />)}
      </datalist>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p> :
          filt.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma empresa.</p> :
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-2">Código</th><th className="text-left p-2">Nome</th><th className="text-left p-2">CNPJ</th><th className="text-left p-2">WhatsApp</th><th className="text-left p-2">Responsável</th><th className="text-left p-2" title="Atendente do Digisac que receberá os tickets desta empresa">Gestor (Digisac)</th><th></th></tr></thead>
            <tbody>
              {filt.map((e) => {
                const editVal = editing[e.id];
                const isDirty = editVal !== undefined && (editVal ?? '').trim() !== (e.responsavel || '');
                const nums = numsOf(e);
                const baseline = (e.whatsapp_numeros || []).map((n: string) => String(n).replace(/\D/g, '')).filter(Boolean).join(',');
                const editedJoin = nums.map((n) => String(n).replace(/\D/g, '')).filter(Boolean).join(',');
                const isWaDirty = editingWa[e.id] !== undefined && baseline !== editedJoin;
                const curGestor = editingGestor[e.id] !== undefined ? editingGestor[e.id] : (e.gestor_digisac_user_id || '');
                const isGestorDirty = editingGestor[e.id] !== undefined && (editingGestor[e.id] ?? '') !== (e.gestor_digisac_user_id || '');
                const curName = editingName[e.id] !== undefined ? editingName[e.id] : (e.name || '');
                const isNameDirty = editingName[e.id] !== undefined && (editingName[e.id] ?? '').trim() !== (e.name || '');
                return (
                <tr key={e.id} className={`border-t hover:bg-muted/30 ${(isDirty || isWaDirty || isGestorDirty || isNameDirty) ? 'bg-amber-500/5' : ''}`}>
                  <td className="p-2 font-mono">{e.code}</td>
                  <td className="p-2 min-w-[220px]">
                    <Input
                      className="h-8 text-xs"
                      value={curName}
                      onChange={(ev) => setEditingName((s) => ({ ...s, [e.id]: ev.target.value }))}
                    />
                  </td>
                  <td className="p-2 font-mono text-xs">{formatCnpj(e.cnpj)}</td>
                  <td className="p-2 min-w-[260px]">
                    <div className="flex flex-col gap-1">
                      {nums.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Nenhum número cadastrado</span>
                      )}
                      {nums.map((n, i) => (
                        <div key={`${n}-${i}`} className="flex items-center gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-muted text-xs font-mono">{n}</span>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeNumber(e.id, nums, i)} title="Remover">
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-xs font-mono"
                          placeholder="55DDDNUMERO"
                          inputMode="numeric"
                          value={newNumByEmp[e.id] ?? ''}
                          onChange={(ev) => setNewNumByEmp((s) => ({ ...s, [e.id]: ev.target.value.replace(/\D/g, '') }))}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addNumber(e.id, nums); } }}
                        />
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addNumber(e.id, nums)} title="Adicionar número">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      list="responsaveis-list"
                      placeholder="Atribuir responsável"
                      value={editVal ?? e.responsavel ?? ''}
                      onChange={(ev) => setEditing((s) => ({ ...s, [e.id]: ev.target.value }))}
                    />
                  </td>
                  <td className="p-2 min-w-[200px]">
                    {usersError ? (
                      <span className="text-[11px] text-destructive">Erro ao carregar gestores</span>
                    ) : (
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={curGestor}
                        disabled={loadingUsers}
                        onChange={(ev) => setEditingGestor((s) => ({ ...s, [e.id]: ev.target.value }))}
                        title="Os avisos serão abertos já atribuídos a este atendente do Digisac. A resposta do cliente cai direto na conversa do gestor."
                      >
                        <option value="">{loadingUsers ? 'Carregando...' : '— Nenhum —'}</option>
                        {digisacUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                        {curGestor && !digisacUsers.find((u) => u.id === curGestor) && (
                          <option value={curGestor}>(ID {curGestor.slice(0, 8)}…)</option>
                        )}
                      </select>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <Link to={`/avisos?empresa=${encodeURIComponent(e.code)}`}>
                      <Button size="sm" variant="outline">Ver avisos</Button>
                    </Link>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>}
      </Card>
      <p className="text-xs text-muted-foreground">
        Edite quantos responsáveis quiser — nada é salvo até clicar em <b>Salvar todos</b>. Use a lista suspensa para reutilizar nomes já cadastrados. Próximas importações já virão preenchidas com o último responsável atribuído à empresa.
      </p>
    </div>
  );
};
export default AvisoEmpresasPage;
