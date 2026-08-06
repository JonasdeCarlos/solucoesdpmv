import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CalendarRange } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TimeInput from '@/components/ponto/TimeInput';
import { type PontoDia, type PontoConfig, type DiaSemanaKey } from '@/types/ponto';

const DIAS: DiaSemanaKey[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface Props {
  config: PontoConfig;
  dias: PontoDia[];
  onImportDias: (dias: PontoDia[]) => void;
}

type Grade = Record<string, { ativo: boolean; marcacoes: string[] }>;

function gradeInicial(slots: number): Grade {
  const g: Grade = {};
  DIAS.forEach((d) => {
    g[d] = { ativo: d !== 'Dom' && d !== 'Sáb', marcacoes: Array(slots).fill('') };
  });
  return g;
}

const PontoManualBulk: React.FC<Props> = ({ config, dias, onImportDias }) => {
  const slots = config.colunasMarcacoes;
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState<Grade>(() => gradeInicial(slots));
  const [somenteVazios, setSomenteVazios] = useState(true);
  const [vaziosFolga, setVaziosFolga] = useState(false);

  const labels = useMemo(
    () => (slots === 6
      ? ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída']
      : ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída']),
    [slots]
  );

  const setMarc = useCallback((dia: string, idx: number, val: string) => {
    setGrade((prev) => {
      const next: Grade = { ...prev, [dia]: { ...prev[dia], marcacoes: [...prev[dia].marcacoes] } };
      next[dia].marcacoes[idx] = val;
      // replica para os dias ativos seguintes que estejam vazios
      const completo = next[dia].marcacoes.every((m) => /^\d{2}:\d{2}$/.test(m));
      if (completo) {
        const from = DIAS.indexOf(dia as DiaSemanaKey);
        DIAS.forEach((d, i) => {
          if (i <= from) return;
          const alvo = next[d] ?? prev[d];
          if (!alvo.ativo) return;
          if (alvo.marcacoes.some((m) => m)) return;
          next[d] = { ...alvo, marcacoes: [...next[dia].marcacoes] };
        });
      }
      return next;
    });
  }, []);

  const toggleAtivo = useCallback((dia: string) => {
    setGrade((prev) => ({ ...prev, [dia]: { ...prev[dia], ativo: !prev[dia].ativo } }));
  }, []);

  const aplicar = useCallback(() => {
    const preenchidos = DIAS.filter((d) => grade[d].ativo && grade[d].marcacoes.some((m) => /^\d{2}:\d{2}$/.test(m)));
    if (preenchidos.length === 0) {
      toast({ title: 'Nada a aplicar', description: 'Preencha ao menos um dia da grade.', variant: 'destructive' });
      return;
    }
    let aplicados = 0;
    let folgas = 0;
    const novos = dias.map((d) => {
      const modelo = grade[d.diaSemana as DiaSemanaKey];
      const marcarFolga = (dia: PontoDia) => {
        if (!vaziosFolga) return dia;
        if (dia.marcacoes.some((m) => m)) return dia;
        if (dia.tipoDia === 'feriado' || dia.tipoDia === 'folga_dsr') return dia;
        folgas++;
        return { ...dia, tipoDia: 'folga_dsr' as const };
      };
      if (!modelo || !modelo.ativo) return marcarFolga(d);
      if (!modelo.marcacoes.some((m) => /^\d{2}:\d{2}$/.test(m))) return marcarFolga(d);
      if (somenteVazios && d.marcacoes.some((m) => m)) return d;
      const marcacoes = Array(slots).fill('');
      modelo.marcacoes.forEach((m, i) => { if (i < slots && /^\d{2}:\d{2}$/.test(m)) marcacoes[i] = m; });
      aplicados++;
      return { ...d, marcacoes, tipoDia: d.tipoDia === 'folga_dsr' ? d.tipoDia : d.tipoDia };
    });
    onImportDias(novos);
    setOpen(false);
    toast({
      title: 'Ponto aplicado',
      description: `${aplicados} dia(s) preenchido(s)${folgas ? ` e ${folgas} dia(s) marcado(s) como folga/DSR` : ''}.`,
    });
  }, [grade, dias, slots, somenteVazios, vaziosFolga, onImportDias]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setGrade(gradeInicial(slots)); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarRange className="w-4 h-4" />
          Ponto manual em massa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ponto manual em massa</DialogTitle>
          <DialogDescription>
            Preencha a jornada de segunda a domingo e replique automaticamente para todos os dias do cartão.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Dia</th>
                <th className="p-2">Aplicar</th>
                {labels.slice(0, slots).map((l) => (
                  <th key={l} className="p-2 text-center text-xs">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS.map((d) => (
                <tr key={d} className={`border-t ${!grade[d].ativo ? 'opacity-50' : ''}`}>
                  <td className="p-2 font-medium">{d}</td>
                  <td className="p-2 text-center">
                    <Switch checked={grade[d].ativo} onCheckedChange={() => toggleAtivo(d)} />
                  </td>
                  {grade[d].marcacoes.map((m, i) => (
                    <td key={i} className="p-1 text-center">
                      <TimeInput value={m} onChange={(v) => setMarc(d, i, v)} disabled={!grade[d].ativo} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="somente-vazios" checked={somenteVazios} onCheckedChange={setSomenteVazios} />
          <Label htmlFor="somente-vazios" className="text-sm">
            Preencher apenas dias sem marcações (desmarque para sobrescrever tudo)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="vazios-folga" checked={vaziosFolga} onCheckedChange={setVaziosFolga} />
          <Label htmlFor="vazios-folga" className="text-sm">
            Campos vazios considerar folga automaticamente
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={aplicar}>Aplicar ao cartão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PontoManualBulk;
