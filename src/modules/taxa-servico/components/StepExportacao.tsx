import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { gerarArquivo, nomeArquivo, baixarTxt } from '../utils/dominioLayout';
import { competenciaAAAAMM, fmt } from '../utils/validacoes';
import { loadDistribuicao, saldoDisponivel, saveExportacao, updateCompetencia, type TsCompetencia, type TsConfig, type TsFuncionario } from '../hooks/useTaxaServico';

const PROCESSOS = [['11', 'Folha mensal'], ['41', 'Adiantamento'], ['42', '13º adiantamento'], ['51', '13º integral']];

interface Props { comp: TsCompetencia; config: TsConfig; funcionarios: TsFuncionario[]; onBack: () => void; onDone: () => void; onGoValores: () => void }

export default function StepExportacao({ comp, config, funcionarios, onBack, onDone, onGoValores }: Props) {
  const [verba, setVerba] = useState(comp.codigo_verba || config.codigo_verba_padrao || '');
  const [proc, setProc] = useState(comp.tipo_processo || '11');
  const [erros, setErros] = useState<string[]>([]);
  const custom = !PROCESSOS.some(([v]) => v === proc);

  const gerar = async () => {
    setErros([]);
    const disp = await saldoDisponivel(comp.empresa_id, comp.id);
    if (comp.saldo_utilizado > Math.max(0, disp) + 0.001) {
      setErros([`Saldo utilizado (${fmt(comp.saldo_utilizado)}) excede o disponível (${fmt(disp)}). Ajuste na etapa Valores.`]);
      return;
    }
    const dist = await loadDistribuicao(comp.id);
    const byId = new Map(funcionarios.map((f) => [f.id, f]));
    const aaaamm = competenciaAAAAMM(comp.competencia);
    const { conteudo, erros: e } = gerarArquivo(dist.filter((d) => d.pontos > 0 && byId.get(d.funcionario_id)?.gera_lancamento !== false).map((d) => ({
      codigoEmpregado: byId.get(d.funcionario_id)?.codigo || '', competencia: aaaamm, rubrica: verba, tipoProcesso: proc,
      valor: d.valor_comissao, codigoEmpresa: config.codigo_empresa_dominio,
    })));
    if (e.length) return setErros(e);
    const nome = nomeArquivo(aaaamm, config.codigo_empresa_dominio, 'original');
    baixarTxt(nome, conteudo);
    await saveExportacao(comp.id, 'original', nome, conteudo);
    await updateCompetencia(comp.id, { codigo_verba: verba, tipo_processo: proc, status: comp.status === 'ajustado' ? 'ajustado' : 'exportado' });
    toast.success('Arquivo gerado');
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Código da verba</Label><Input maxLength={4} value={verba} onChange={(e) => setVerba(e.target.value.replace(/\D/g, ''))} /></div>
        <div>
          <Label>Tipo de processo</Label>
          <div className="flex gap-2">
            <Select value={custom ? 'outro' : proc} onValueChange={(v) => setProc(v === 'outro' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCESSOS.map(([v, l]) => <SelectItem key={v} value={v}>{v} – {l}</SelectItem>)}
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {custom && <Input className="w-20" maxLength={2} value={proc} onChange={(e) => setProc(e.target.value.replace(/\D/g, ''))} />}
          </div>
        </div>
      </div>
      {erros.length > 0 && (
        <div className="text-sm text-destructive space-y-1">
          <ul className="list-disc pl-5">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
          {erros[0].includes('Saldo') && <Button size="sm" variant="outline" onClick={onGoValores}>Ir para Valores</Button>}
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={gerar}><Download className="w-4 h-4 mr-1" />Gerar arquivo Domínio</Button>
      </div>
    </div>
  );
}
