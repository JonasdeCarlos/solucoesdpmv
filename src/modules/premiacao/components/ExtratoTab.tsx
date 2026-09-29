import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Trophy, MinusCircle, Medal } from 'lucide-react';
import { tbl, brl, fmtComp, shiftComp, type Apuracao, type Catalogo, type Politica } from '../hooks/usePremiacao';
import { pdfExtrato } from '../utils/pdfs';

export default function ExtratoTab({ politica, cat, competencia, empresa }: { politica: Politica; cat: Catalogo; competencia: string; empresa: string }) {
  const [colabId, setColabId] = useState('');
  const [a, setA] = useState<Apuracao | null>(null);
  const c = cat.colaboradores.find(x => x.id === colabId);

  useEffect(() => {
    if (!colabId) { setA(null); return; }
    tbl('premiacao_apuracoes').select('*').eq('politica_id', politica.id).eq('competencia', competencia).eq('colaborador_id', colabId).maybeSingle().then(({ data }: any) => setA(data));
  }, [colabId, competencia, politica.id]);

  const linha = (l: string, v: string | number, cls = '') => <div className={`flex justify-between border-b border-dotted py-1 ${cls}`}><span>{l}</span><span className="font-semibold">{v}</span></div>;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-2 items-end">
        <div><Label className="text-xs">Colaborador</Label>
          <Select value={colabId} onValueChange={setColabId}><SelectTrigger className="w-72 h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.colaboradores.map(x => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent></Select></div>
        {a && c && <Button size="sm" onClick={() => pdfExtrato({ politica, cat, apuracao: a, colaborador: c, empresa }).save(`extrato-${c.nome.replace(/\s+/g, '_')}-${competencia}.pdf`)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>}
      </div>
      {colabId && !a && <p className="text-sm text-muted-foreground">Sem apuração para {fmtComp(competencia)}. Recalcule na aba Apuração Mensal.</p>}
      {a && c && (
        <div className="max-w-2xl space-y-3">
          <div className="rounded-lg bg-muted p-3 text-sm font-medium">Pontuação de referência da sua função ({cat.funcaoDe(c)}): {a.pontuacao_referencia} pontos. Seu prêmio corresponde aos pontos acima desse valor.</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {cat.medalhas.filter(m => m.ativo).map(m => (
              <div key={m.id} className="rounded-lg p-3 text-center text-white" style={{ background: m.cor_hex }}><Medal className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">{m.nome}</div><div className="text-2xl font-bold">{a.medalhas_contagem?.[m.nome] || 0}</div></div>
            ))}
            <div className="rounded-lg p-3 text-center bg-primary text-primary-foreground"><Trophy className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Troféus</div><div className="text-2xl font-bold">{a.trofeus_conquistados.filter(t => t.atingida).length}</div></div>
            <div className="rounded-lg p-3 text-center bg-destructive text-destructive-foreground"><MinusCircle className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Desabonos</div><div className="text-2xl font-bold">−{a.pontos_desabonos}</div></div>
          </div>
          <div className="rounded-lg border p-3 text-sm">
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
        </div>
      )}
    </div>
  );
}
