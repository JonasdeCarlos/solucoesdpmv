import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { formatCnpj } from '@/utils/avisos/normalize';
import { Save, Loader2, X } from 'lucide-react';

const AvisoEmpresasPage = () => {
  const { empresas, loading, setResponsavelAndPropagate } = useAvisoEmpresas();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const filt = useMemo(() => empresas.filter((e) =>
    !q || `${e.code} ${e.name} ${e.cnpj} ${e.responsavel}`.toLowerCase().includes(q.toLowerCase())
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

  const aplicarEmTodosFiltrados = (valor: string) => {
    const next: Record<string, string> = { ...editing };
    filt.forEach((e) => { next[e.id] = valor; });
    setEditing(next);
  };

  const saveAll = async () => {
    if (dirtyIds.length === 0) {
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
      setEditing({});
      toast.success(`${ok} empresa(s) atualizadas.`);
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || 'erro'));
    } finally {
      setSaving(false);
    }
  };

  const descartar = () => setEditing({});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <div className="flex items-center gap-2">
          {dirtyIds.length > 0 && (
            <>
              <span className="text-xs text-amber-700 font-medium">{dirtyIds.length} alteração(ões) não salvas</span>
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
            <thead className="bg-muted/50"><tr><th className="text-left p-2">Código</th><th className="text-left p-2">Nome</th><th className="text-left p-2">CNPJ</th><th className="text-left p-2">Responsável</th><th></th></tr></thead>
            <tbody>
              {filt.map((e) => {
                const editVal = editing[e.id];
                const isDirty = editVal !== undefined && (editVal ?? '').trim() !== (e.responsavel || '');
                return (
                <tr key={e.id} className={`border-t hover:bg-muted/30 ${isDirty ? 'bg-amber-500/5' : ''}`}>
                  <td className="p-2 font-mono">{e.code}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2 font-mono text-xs">{formatCnpj(e.cnpj)}</td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      list="responsaveis-list"
                      placeholder="Atribuir responsável"
                      value={editVal ?? e.responsavel ?? ''}
                      onChange={(ev) => setEditing((s) => ({ ...s, [e.id]: ev.target.value }))}
                    />
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
