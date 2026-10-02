import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Save, ListPlus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PontoDiaCalculado, PontoIdentificacao } from '@/types/ponto';
import { minutesToHHMM } from '@/utils/pontoCalculations';
import { useEmpresas } from '@/modules/taxa-servico/hooks/useTaxaServico';
import { baixarTxt } from '@/modules/taxa-servico/utils/dominioLayout';
import { gerarConteudo, normNome, type Mapa } from '@/modules/conversor-dominio/utils/conversor';

const db = supabase as any;
const PREFIXO = '[Ponto] ';

interface Verba { id: string; label: string; minutos?: number; qtd?: number }

interface Guardado { codigo: string; nome: string; itens: { evento: string; rubrica: string; tipo: 'horas' | 'quantidade'; valor: string }[] }

interface Props { diasCalculados: PontoDiaCalculado[]; identificacao: PontoIdentificacao }

const PontoVerbasDominio: React.FC<Props> = ({ diasCalculados, identificacao }) => {
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState('');
  const [codEmpresa, setCodEmpresa] = useState('');
  const [tipoProc, setTipoProc] = useState('11');
  const [codFunc, setCodFunc] = useState('');
  const [rubricas, setRubricas] = useState<Record<string, string>>({});
  const comp = (identificacao.mesAno || '').replace('-', '');
  const lotKey = `ponto-lote-${empresaId}-${comp}`;
  const [lote, setLote] = useState<Guardado[]>([]);
  useEffect(() => {
    if (!empresaId) { setLote([]); return; }
    try { setLote(JSON.parse(localStorage.getItem(lotKey) || '[]')); } catch { setLote([]); }
  }, [lotKey]);
  const gravarLote = (l: Guardado[]) => { setLote(l); localStorage.setItem(lotKey, JSON.stringify(l)); };

  const verbas: Verba[] = useMemo(() => {
    let he50 = 0, he100 = 0, atraso = 0, faltas = 0, not = 0, intra = 0;
    for (const d of diasCalculados) {
      const especial = d.tipoDia === 'feriado' || d.tipoDia === 'folga_dsr';
      if (especial) he100 += d.trabalhoLiquido;
      else if (d.saldoMinutos > 0) he50 += d.saldoMinutos;
      if (d.tipoDia === 'falta') faltas += 1;
      else if (!especial && d.saldoMinutos < 0) atraso += -d.saldoMinutos;
      not += d.noturnoConvertido;
      intra += d.intervaloDevido;
    }
    return [
      { id: 'he50', label: 'Horas extras 50%', minutos: he50 },
      { id: 'he100', label: 'Horas extras 100% (feriados/DSR)', minutos: he100 },
      { id: 'adnot', label: 'Adicional noturno (convertido)', minutos: not },
      { id: 'intra', label: 'Intervalo intrajornada devido', minutos: intra },
      { id: 'atraso', label: 'Atrasos / saídas antecipadas', minutos: atraso },
      { id: 'faltas', label: 'Faltas (dias)', qtd: faltas },
    ];
  }, [diasCalculados]);

  // sugere empresa pelo nome digitado no cabeçalho
  useEffect(() => {
    if (empresaId || !identificacao.empresaNome || !empresas.length) return;
    const n = normNome(identificacao.empresaNome);
    const e = empresas.find((x) => normNome(x.nome) === n) || empresas.find((x) => normNome(x.nome).includes(n));
    if (e) setEmpresaId(e.id);
  }, [empresas, identificacao.empresaNome]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const [c, m] = await Promise.all([
        db.from('cl_config').select('*').eq('empresa_id', empresaId).maybeSingle(),
        db.from('cl_mapeamentos').select('evento,rubrica').eq('empresa_id', empresaId).like('evento', `${PREFIXO}%`),
      ]);
      setCodEmpresa(c.data?.codigo_empresa_dominio || '');
      setTipoProc(c.data?.tipo_processo || '11');
      const r: Record<string, string> = {};
      for (const x of m.data || []) r[x.evento.slice(PREFIXO.length)] = x.rubrica || '';
      setRubricas(r);
    })();
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || !identificacao.empregadoNome) { setCodFunc(''); return; }
    db.from('cl_funcionarios').select('codigo').eq('empresa_id', empresaId).eq('nome_norm', normNome(identificacao.empregadoNome)).maybeSingle()
      .then(({ data }: any) => setCodFunc(data?.codigo || ''));
  }, [empresaId, identificacao.empregadoNome]);

  const salvarConfig = async (silencioso = false) => {
    if (!empresaId) { toast.error('Escolha a empresa.'); return false; }
    const rows = verbas.map((v) => ({ empresa_id: empresaId, evento: PREFIXO + v.id, rubrica: rubricas[v.id] || null, tipo: v.qtd != null ? 'quantidade' : 'horas', ignorar: !rubricas[v.id] }));
    const r1 = await db.from('cl_mapeamentos').upsert(rows, { onConflict: 'empresa_id,evento' });
    const r2 = await db.from('cl_config').upsert({ empresa_id: empresaId, codigo_empresa_dominio: codEmpresa || null, tipo_processo: tipoProc || '11' }, { onConflict: 'empresa_id' });
    if (codFunc && identificacao.empregadoNome) {
      await db.from('cl_funcionarios').upsert({ empresa_id: empresaId, nome_norm: normNome(identificacao.empregadoNome), nome: identificacao.empregadoNome, codigo: codFunc }, { onConflict: 'empresa_id,nome_norm' });
    }
    const err = r1.error || r2.error;
    if (err) { toast.error(err.message); return false; }
    if (!silencioso) toast.success('Códigos salvos para esta empresa.');
    return true;
  };

  const montarAtual = async (): Promise<Guardado | null> => {
    if (!codFunc) { toast.error('Informe o código do empregado no Domínio.'); return null; }
    const usadas = verbas.filter((v) => (v.minutos ?? v.qtd ?? 0) > 0 && rubricas[v.id]);
    if (!usadas.length) { toast.error('Nenhuma verba com valor e rubrica preenchida.'); return null; }
    if (!(await salvarConfig(true))) return null;
    return { codigo: codFunc, nome: identificacao.empregadoNome || '', itens: usadas.map((v) => ({ evento: v.id, rubrica: rubricas[v.id], tipo: v.qtd != null ? 'quantidade' : 'horas', valor: v.qtd != null ? String(v.qtd) : minutesToHHMM(v.minutos!) })) };
  };

  const gerar = (lista: Guardado[], sufixo: string) => {
    const linhas: any[] = []; const mapas: Record<string, Mapa> = {};
    for (const g of lista) for (const it of g.itens) {
      const ev = `${it.evento}|${it.rubrica}|${it.tipo}`;
      mapas[ev] = { evento: ev, rubrica: it.rubrica, tipo: it.tipo, ignorar: false } as Mapa;
      linhas.push({ codigo: g.codigo, nome: g.nome, evento: ev, valor: it.valor });
    }
    const r = gerarConteudo(linhas, mapas, {}, comp, tipoProc, codEmpresa || null);
    if (r.erros.length) return toast.error(r.erros.slice(0, 3).join('\n'));
    baixarTxt(`FOLHA${comp.slice(4)}${comp.slice(0, 4)}-${codEmpresa || '0'}-PONTO-${sufixo}.txt`, r.conteudo);
    toast.success(`Arquivo gerado com ${r.linhas.length} lançamento(s).`);
  };

  const exportar = async () => { const g = await montarAtual(); if (g) gerar([g], g.codigo); };

  const guardar = async () => {
    const g = await montarAtual(); if (!g) return;
    const existe = lote.some((x) => x.codigo === g.codigo);
    gravarLote([...lote.filter((x) => x.codigo !== g.codigo), g]);
    toast.success(existe ? `Lançamentos de ${g.nome || g.codigo} atualizados no lote.` : `${g.nome || g.codigo} guardado. Agora preencha o próximo empregado.`);
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Resumo das verbas e exportação Domínio</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label>Empresa
            <select className="block border rounded h-9 px-2 bg-background max-w-xs" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">— escolha —</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select></label>
          <label>Cód. empresa Domínio<Input className="w-32" value={codEmpresa} onChange={(e) => setCodEmpresa(e.target.value.replace(/\D/g, ''))} /></label>
          <label>Tipo processo<Input className="w-20" value={tipoProc} onChange={(e) => setTipoProc(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          <label>Cód. empregado<Input className={`w-28 ${!codFunc ? 'border-destructive' : ''}`} value={codFunc} onChange={(e) => setCodFunc(e.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th>Verba</th><th className="w-28 text-right">Quantidade</th><th className="w-32 pl-3">Rubrica Domínio</th></tr></thead>
          <tbody>{verbas.map((v) => {
            const zero = (v.minutos ?? v.qtd ?? 0) <= 0;
            return (
              <tr key={v.id} className={`border-t ${zero ? 'text-muted-foreground' : ''}`}>
                <td className="py-1">{v.label}</td>
                <td className="text-right font-mono">{v.qtd != null ? v.qtd : minutesToHHMM(v.minutos!)}</td>
                <td className="pl-3"><Input className="h-8" placeholder="código" value={rubricas[v.id] || ''} onChange={(e) => setRubricas((p) => ({ ...p, [v.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} /></td>
              </tr>
            );
          })}</tbody>
        </table>
        <p className="text-xs text-muted-foreground">Os códigos ficam salvos por empresa — na próxima apuração da mesma empresa já vêm preenchidos. Verbas zeradas ou sem rubrica não entram no arquivo.</p>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => salvarConfig()}><Save className="w-4 h-4 mr-1" />Salvar códigos da empresa</Button>
          <Button variant="outline" onClick={exportar}><Download className="w-4 h-4 mr-1" />Arquivo só deste empregado</Button>
          <Button variant="secondary" onClick={guardar}><ListPlus className="w-4 h-4 mr-1" />Guardar lançamentos</Button>
        </div>
        {lote.length > 0 && (
          <div className="border rounded p-3 space-y-2">
            <p className="text-sm font-medium">Empregados guardados ({lote.length}) — {identificacao.mesAno}</p>
            {lote.map((g) => (
              <div key={g.codigo} className="flex items-center justify-between text-sm border-t pt-1">
                <span>{g.codigo} — {g.nome} <span className="text-muted-foreground">({g.itens.length} verba(s))</span></span>
                <Button size="icon" variant="ghost" onClick={() => gravarLote(lote.filter((x) => x.codigo !== g.codigo))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => gravarLote([])}>Limpar lote</Button>
              <Button onClick={() => gerar(lote, 'LOTE')}><Download className="w-4 h-4 mr-1" />Gerar arquivo único ({lote.length})</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PontoVerbasDominio;
