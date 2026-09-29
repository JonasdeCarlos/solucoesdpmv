import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown, Trophy, MinusCircle, Medal, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { toBlob } from 'html-to-image';
import { tbl, brl, fmtComp, shiftComp, efetivoPontos, type Apuracao, type Catalogo, type Lancamento, type Politica } from '../hooks/usePremiacao';
import { pdfExtrato } from '../utils/pdfs';

export default function ExtratoTab({ politica, cat, competencia, empresa }: { politica: Politica; cat: Catalogo; competencia: string; empresa: string }) {
  const [colabId, setColabId] = useState('');
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [manuais, setManuais] = useState<Set<string>>(new Set());
  const [oficial, setOficial] = useState<Apuracao | null>(null);
  const [verRel, setVerRel] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = cat.colaboradores.find(x => x.id === colabId);

  const load = async () => {
    if (!colabId) { setLancs([]); setOficial(null); return; }
    const [l, ant, mm, ap] = await Promise.all([
      tbl('premiacao_lancamentos').select('*').eq('politica_id', politica.id).eq('competencia', competencia).eq('colaborador_id', colabId).order('data_ocorrencia'),
      tbl('premiacao_apuracoes').select('saldo_transportado,saldo_apurado').eq('politica_id', politica.id).eq('colaborador_id', colabId).eq('status', 'fechada').lt('competencia', competencia).order('competencia', { ascending: false }).limit(1),
      tbl('premiacao_metas_manuais').select('meta_id').eq('colaborador_id', colabId).eq('competencia', competencia),
      tbl('premiacao_apuracoes').select('*').eq('politica_id', politica.id).eq('competencia', competencia).eq('colaborador_id', colabId).maybeSingle(),
    ]);
    setLancs(l.data || []);
    setSaldoInicial(ant.data?.[0]?.saldo_transportado ?? ant.data?.[0]?.saldo_apurado ?? 0);
    setManuais(new Set((mm.data || []).map((x: any) => x.meta_id)));
    setOficial(ap.data || null);
  };
  useEffect(() => { load(); }, [colabId, competencia, politica.id]);

  // Prévia em tempo real: recalcula a partir dos lançamentos, sem depender da apuração oficial
  const a: Apuracao | null = useMemo(() => {
    if (!c || !colabId) return null;
    const medalhasContagem: Record<string, number> = {};
    let pontosMedalhas = 0, pontosDesabonos = 0;
    lancs.forEach(l => {
      if (l.tipo === 'desabono') { pontosDesabonos += l.pontos_total; return; }
      if (l.tipo === 'servico' && l.gera_pontos) {
        const s = cat.servicos.find(x => x.id === l.servico_id);
        const md = cat.medalhas.find(m => m.id === s?.medalha_id);
        if (md) medalhasContagem[md.nome] = (medalhasContagem[md.nome] || 0) + l.quantidade;
        pontosMedalhas += l.pontos_total;
      } else if (l.tipo === 'ajuste' && l.gera_pontos) pontosMedalhas += l.pontos_total;
    });
    const trofeus = cat.metas.filter(m => m.ativo).map(m => {
      let realizado: number | null = null;
      if (m.modo_apuracao === 'automatico') {
        const links = cat.metasServicos.filter(ms => ms.meta_id === m.id);
        realizado = links.reduce((s, lk) => s + lancs.filter(l => l.servico_id === lk.servico_id).reduce((q, l) => q + l.quantidade, 0) * lk.peso_contagem, 0);
      }
      const atingida = m.modo_apuracao === 'manual' ? manuais.has(m.id) : (realizado ?? 0) >= m.quantidade_alvo;
      return { meta_id: m.id, nome: m.nome, realizado, alvo: m.quantidade_alvo, unidade: m.unidade, atingida, pontos: atingida ? m.pontos_trofeu : 0 };
    });
    let pontosTrofeus = trofeus.reduce((s, t) => s + t.pontos, 0);
    if (politica.teto_mensal_pontos && pontosMedalhas + pontosTrofeus > politica.teto_mensal_pontos)
      pontosTrofeus = Math.max(0, politica.teto_mensal_pontos - pontosMedalhas);
    const saldo = saldoInicial + pontosMedalhas + pontosTrofeus - pontosDesabonos;
    const referencia = cat.refDe(c);
    const premiaveis = Math.max(0, saldo - referencia);
    return {
      id: oficial?.id || '', colaborador_id: colabId, competencia, saldo_inicial: saldoInicial,
      pontos_medalhas: pontosMedalhas, medalhas_contagem: medalhasContagem, pontos_trofeus: pontosTrofeus,
      trofeus_conquistados: trofeus, pontos_desabonos: pontosDesabonos, saldo_apurado: saldo,
      pontuacao_referencia: referencia, pontos_premiaveis: premiaveis, valor_ponto: politica.valor_ponto,
      valor_bonificacao: Math.round(premiaveis * politica.valor_ponto * 100) / 100,
      saldo_transportado: saldo < 0 ? saldo : 0, status: oficial?.status || 'aberta',
    };
  }, [c, colabId, lancs, manuais, saldoInicial, oficial, cat, politica, competencia]);

  const linha = (l: string, v: string | number, cls = '') => <div className={`flex justify-between border-b border-dotted py-1 ${cls}`}><span>{l}</span><span className="font-semibold">{v}</span></div>;

  const copiar = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('falha');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Imagem copiada — cole no WhatsApp');
      } catch {
        const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `extrato-${competencia}.png`; a2.click();
        toast.info('Não foi possível copiar; a imagem foi baixada.');
      }
    } catch { toast.error('Não foi possível gerar a imagem.'); } finally { setBusy(false); }
  };

  const quadro = a && (
    <div className="rounded-lg border p-3 text-sm bg-background">
      {linha(`Saldo inicial (transportado de ${fmtComp(shiftComp(competencia, -1))})`, a.saldo_inicial)}
      {linha('(+) Medalhas', a.pontos_medalhas)}
      {linha('(+) Troféus', a.pontos_trofeus)}
      {linha('(−) Desabonos', a.pontos_desabonos)}
      {linha('(=) Saldo do mês', a.saldo_apurado)}
      {a.saldo_apurado >= 0 ? (<>
        {linha('(−) Pontuação de referência', a.pontuacao_referencia)}
        {linha('(=) Pontos premiados', a.pontos_premiaveis)}
        <div className="flex justify-between mt-2 rounded bg-primary text-primary-foreground px-2 py-1.5 font-bold"><span>Prêmio</span><span>{brl(a.valor_bonificacao)}</span></div>
      </>) : (
        <p className="text-destructive font-semibold mt-2">Saldo negativo de {a.saldo_apurado} pontos transportado para {fmtComp(shiftComp(competencia, 1))}. Não há desconto em folha.</p>
      )}
    </div>
  );

  const cards = a && (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {cat.medalhas.filter(m => m.ativo).map(m => (
        <div key={m.id} className="rounded-lg p-3 text-center text-white" style={{ background: m.cor_hex }}><Medal className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">{m.nome}</div><div className="text-2xl font-bold">{a.medalhas_contagem?.[m.nome] || 0}</div></div>
      ))}
      <div className="rounded-lg p-3 text-center bg-primary text-primary-foreground"><Trophy className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Troféus</div><div className="text-2xl font-bold">{a.trofeus_conquistados.filter(t => t.atingida).length}</div></div>
      <div className="rounded-lg p-3 text-center bg-destructive text-destructive-foreground"><MinusCircle className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Desabonos</div><div className="text-2xl font-bold">−{a.pontos_desabonos}</div></div>
    </div>
  );

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">Colaborador</Label>
          <Select value={colabId} onValueChange={setColabId}><SelectTrigger className="w-72 h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.colaboradores.map(x => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent></Select></div>
        {colabId && <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Atualizar</Button>}
        {a && c && <>
          <Button size="sm" variant="outline" onClick={() => setVerRel(true)}><Copy className="w-3 h-3 mr-1" />Relatório / imagem</Button>
          <Button size="sm" onClick={() => pdfExtrato({ politica, cat, apuracao: a, colaborador: c, empresa }).save(`extrato-${c.nome.replace(/\s+/g, '_')}-${competencia}.pdf`)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
        </>}
      </div>
      {a && c && (
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={oficial ? 'default' : 'outline'}>{oficial ? 'Apuração oficial + lançamentos' : 'Prévia em tempo real (apuração ainda não calculada)'}</Badge>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm font-medium">Pontuação de referência da sua função ({cat.funcaoDe(c)}): {a.pontuacao_referencia} pontos. Seu prêmio corresponde aos pontos acima desse valor.</div>
          {cards}
          {quadro}
        </div>
      )}

      <Dialog open={verRel} onOpenChange={setVerRel}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-auto">
          <DialogHeader><DialogTitle>Extrato do colaborador — {fmtComp(competencia)}</DialogTitle></DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={busy} onClick={copiar}><Copy className="w-4 h-4 mr-1" />Copiar imagem</Button>
            {a && c && <Button onClick={() => pdfExtrato({ politica, cat, apuracao: a, colaborador: c, empresa }).save(`extrato-${c.nome.replace(/\s+/g, '_')}-${competencia}.pdf`)}><FileDown className="w-4 h-4 mr-1" />Gerar PDF</Button>}
          </div>
          {a && c && (
            <div ref={ref} className="bg-background text-foreground p-5 rounded-md border space-y-3">
              <div className="h-1 bg-primary rounded" />
              <h3 className="font-bold text-lg">{politica.nome} — Extrato de {c.nome}</h3>
              <p className="text-sm text-muted-foreground">{empresa} · {fmtComp(competencia)}</p>
              <div className="rounded-lg bg-muted p-3 text-sm font-medium">Pontuação de referência da função ({cat.funcaoDe(c)}): {a.pontuacao_referencia} pontos.</div>
              {cards}
              {quadro}
              {lancs.length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="bg-primary text-primary-foreground"><th className="p-1.5 text-left">Data</th><th className="p-1.5 text-left">Código</th><th className="p-1.5 text-left">Descrição</th><th className="p-1.5 text-right">Qtd</th><th className="p-1.5 text-right">Pontos</th></tr></thead>
                  <tbody>{lancs.map((l, i) => (
                    <tr key={l.id} className={i % 2 ? 'bg-muted/40' : ''}>
                      <td className="p-1.5">{l.data_ocorrencia.split('-').reverse().join('/')}</td>
                      <td className="p-1.5 font-mono">{l.codigo}</td><td className="p-1.5">{l.descricao}</td>
                      <td className="p-1.5 text-right">{l.quantidade}</td>
                      <td className="p-1.5 text-right">{l.tipo === 'desabono' ? `−${l.pontos_total}` : l.gera_pontos ? l.pontos_total : '—'}</td>
                    </tr>))}</tbody>
                </table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
