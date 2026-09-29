import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { TsConfig } from '../hooks/useTaxaServico';

interface Props {
  empresas: { id: string; nome: string }[];
  empresaId: string | null;
  onEmpresa: (id: string) => void;
  config: TsConfig | null;
  saveConfig: (c: TsConfig) => Promise<any>;
  onNext: () => void;
}

export default function StepEmpresa({ empresas, empresaId, onEmpresa, config, saveConfig, onNext }: Props) {
  const [c, setC] = useState<TsConfig | null>(config);
  useEffect(() => setC(config), [config]);

  const salvar = async () => {
    if (!c) return;
    if (c.codigo_empresa_dominio && !/^\d{1,10}$/.test(c.codigo_empresa_dominio)) return toast.error('Código da empresa: somente dígitos, até 10.');
    if (c.codigo_verba_padrao && !/^\d{1,4}$/.test(c.codigo_verba_padrao)) return toast.error('Código de verba: somente dígitos, até 4.');
    const err = await saveConfig(c);
    if (err) return toast.error(err.message);
    toast.success('Configuração salva');
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Empresa</Label>
        <Select value={empresaId || ''} onValueChange={onEmpresa}>
          <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
          <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">Para cadastrar uma nova empresa, use a aba Clientes.</p>
      </div>
      {c && empresaId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Regime tributário</Label>
            <Select value={c.regime_tributario} onValueChange={(v: any) => setC({ ...c, regime_tributario: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples Nacional (teto 20%)</SelectItem>
                <SelectItem value="demais">Demais regimes (teto 33%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Código da empresa no Domínio</Label>
            <Input maxLength={10} value={c.codigo_empresa_dominio || ''} onChange={(e) => setC({ ...c, codigo_empresa_dominio: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div>
            <Label>Código de verba padrão</Label>
            <Input maxLength={4} value={c.codigo_verba_padrao || ''} onChange={(e) => setC({ ...c, codigo_verba_padrao: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
      )}
      <div className="flex justify-end"><Button disabled={!empresaId} onClick={salvar}>Salvar e avançar</Button></div>
    </div>
  );
}
