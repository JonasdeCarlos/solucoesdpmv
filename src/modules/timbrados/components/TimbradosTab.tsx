import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import AplicarTimbrado from './AplicarTimbrado';
import CadastroTimbrados from './CadastroTimbrados';
import { listarTimbrados, listarEmpresas, type Timbrado, type EmpresaOpt } from '../api';

interface Props {
  onEnviarMontador?: (files: File[]) => void;
}

export default function TimbradosTab({ onEnviarMontador }: Props) {
  const [timbrados, setTimbrados] = useState<Timbrado[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);

  const recarregar = () => listarTimbrados().then(setTimbrados).catch(e => toast.error(e.message));
  useEffect(() => {
    recarregar();
    listarEmpresas().then(setEmpresas).catch(() => {});
  }, []);

  return (
    <Tabs defaultValue="aplicar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="aplicar">Aplicar timbrado</TabsTrigger>
        <TabsTrigger value="cadastro">Cadastro de timbrados</TabsTrigger>
      </TabsList>
      <TabsContent value="aplicar">
        <AplicarTimbrado timbrados={timbrados} empresas={empresas} onEnviarMontador={onEnviarMontador} />
      </TabsContent>
      <TabsContent value="cadastro">
        <CadastroTimbrados empresas={empresas} onChange={recarregar} />
      </TabsContent>
    </Tabs>
  );
}
