import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Upload } from 'lucide-react';
import { fbDb, type FbFuncionario } from '../hooks/useBrutoAlvo';
import { parseNum } from '@/modules/taxa-servico/utils/validacoes';

const toIso = (s: any): string | null => {
  if (!s && s !== 0) return null;
  if (typeof s === 'number') { const d = XLSX.SSF.parse_date_code(s); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null; }
  const t = String(s).trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

export default function FuncionariosTab({ empresaId, funcionarios, reload }: { empresaId: string; funcionarios: FbFuncionario[]; reload: () => void }) {
  const [novo, setNovo] = useState({ codigo: '', nome: '', cpf: '', salario: '', alvo: '', admissao: '' });
  const [colar, setColar] = useState('');
  const [ordem, setOrdem] = useState<'nome' | 'codigo'>('nome');

  const upsert = async (rows: any[]) => {
    const { error } = await fbDb.from('fb_funcionarios').upsert(rows.map((r) => ({ empresa_id: empresaId, ...r })), { onConflict: 'empresa_id,codigo' });
    if (error) toast.error(error.message); else { toast.success(`${rows.length} funcionário(s) salvos`); reload(); }
  };
  const adicionar = () => {
    if (!novo.codigo || !novo.nome) return toast.error('Informe código e nome');
    upsert([{ codigo: novo.codigo.trim(), nome: novo.nome.trim(), cpf: novo.cpf || null, salario_base: parseNum(novo.salario), bruto_alvo_ref: novo.alvo.trim() ? parseNum(novo.alvo) : null, data_admissao: novo.admissao || null }]);
    setNovo({ codigo: '', nome: '', cpf: '', salario: '', alvo: '', admissao: '' });
  };
  const linhasParaRows = (linhas: any[][]) => linhas
    .filter((l) => l[0] && l[1] && /\d/.test(String(l[0])))
    .map((l) => ({ codigo: String(l[0]).trim(), nome: String(l[1]).trim(), cpf: l[2] ? String(l[2]).trim() : null, salario_base: typeof l[3] === 'number' ? l[3] : parseNum(l[3]), data_admissao: toIso(l[4]) }));
  const importarArquivo = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = linhasParaRows(XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
    if (!rows.length) return toast.error('Nenhuma linha válida (colunas: código, nome, CPF, salário, admissão)');
    upsert(rows);
  };
  const importarColado = () => {
    const rows = linhasParaRows(colar.split(/\r?\n/).map((l) => l.split(/\t|;/)));
    if (!rows.length) return toast.error('Nenhuma linha válida');
    upsert(rows); setColar('');
  };
  const atualizar = async (f: FbFuncionario, patch: Partial<FbFuncionario>) => {
    const { error } = await fbDb.from('fb_funcionarios').update(patch).eq('id', f.id);
    if (error) toast.error(error.message); else reload();
  };
  const remover = async (f: FbFuncionario) => { if (!confirm(`Excluir ${f.nome}?`)) return; await fbDb.from('fb_funcionarios').delete().eq('id', f.id); reload(); };
  const lista = [...funcionarios].sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome) : a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Importar funcionários</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Colunas na ordem: código Domínio, nome, CPF, salário, data de admissão (dd/mm/aaaa). Mesmo código atualiza o cadastro.</p>
          <label className="inline-flex"><input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importarArquivo(e.target.files[0])} />
            <span className="inline-flex items-center gap-1 px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-muted"><Upload className="w-4 h-4" />Planilha (XLSX/CSV)</span></label>
          <Textarea rows={3} value={colar} onChange={(e) => setColar(e.target.value)} placeholder={'25\tMARIA SILVA\t000.000.000-00\t1750,00\t01/03/2014'} />
          <Button variant="outline" size="sm" onClick={importarColado} disabled={!colar.trim()}>Importar texto colado</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Funcionários ({funcionarios.length})</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={ordem === 'codigo' ? 'default' : 'outline'} onClick={() => setOrdem('codigo')}>Código</Button>
            <Button size="sm" variant={ordem === 'nome' ? 'default' : 'outline'} onClick={() => setOrdem('nome')}>Ordem alfabética</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="p-1">Código</th><th className="p-1">Nome</th><th className="p-1">CPF</th><th className="p-1">Salário</th><th className="p-1">Bruto alvo (ref.)</th><th className="p-1">Admissão</th><th className="p-1">Ativo</th><th /></tr></thead>
            <tbody>
              <tr>
                <td className="p-1"><Input className="h-8 w-20" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} /></td>
                <td className="p-1"><Input className="h-8" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></td>
                <td className="p-1"><Input className="h-8 w-36" value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} /></td>
                <td className="p-1"><Input className="h-8 w-28" value={novo.salario} onChange={(e) => setNovo({ ...novo, salario: e.target.value })} /></td>
                <td className="p-1"><Input className="h-8 w-28" value={novo.alvo} onChange={(e) => setNovo({ ...novo, alvo: e.target.value })} /></td>
                <td className="p-1"><Input type="date" className="h-8 w-36" value={novo.admissao} onChange={(e) => setNovo({ ...novo, admissao: e.target.value })} /></td>
                <td /><td className="p-1"><Button size="sm" onClick={adicionar}><Plus className="w-4 h-4" /></Button></td>
              </tr>
              {lista.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="p-1">{f.codigo}</td>
                  <td className="p-1">{f.nome}</td>
                  <td className="p-1">{f.cpf}</td>
                  <td className="p-1"><Input className="h-8 w-28" defaultValue={f.salario_base.toFixed(2).replace('.', ',')} onBlur={(e) => { const v = parseNum(e.target.value); if (v !== f.salario_base) atualizar(f, { salario_base: v }); }} /></td>
                  <td className="p-1"><Input className="h-8 w-28" placeholder="—" defaultValue={f.bruto_alvo_ref != null ? f.bruto_alvo_ref.toFixed(2).replace('.', ',') : ''} onBlur={(e) => { const v = e.target.value.trim() ? parseNum(e.target.value) : null; if (v !== f.bruto_alvo_ref) atualizar(f, { bruto_alvo_ref: v }); }} /></td>
                  <td className="p-1"><Input type="date" className={`h-8 w-36 ${!f.data_admissao ? 'border-destructive' : ''}`} defaultValue={f.data_admissao || ''} onBlur={(e) => { if ((e.target.value || null) !== f.data_admissao) atualizar(f, { data_admissao: e.target.value || null }); }} /></td>
                  <td className="p-1"><input type="checkbox" checked={f.ativo} onChange={(e) => atualizar(f, { ativo: e.target.checked })} /></td>
                  <td className="p-1"><Button size="icon" variant="ghost" onClick={() => remover(f)}><Trash2 className="w-4 h-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
