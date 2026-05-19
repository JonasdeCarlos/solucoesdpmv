import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DsrVerbasTab from '@/components/dsr/DsrVerbasTab';
import DsrEntriesTab from '@/components/dsr/DsrEntriesTab';
import DsrCalendarTab from '@/components/dsr/DsrCalendarTab';
import DsrApuracaoTab from '@/components/dsr/DsrApuracaoTab';

const STORAGE_KEY = 'provisoes_dsr_filters_v1';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { empresa?: string; competencia?: string } : null;
  } catch {
    return null;
  }
}

export default function ProvisoesDsrPage() {
  const persisted = loadPersistedState();
  const [empresa, setEmpresa] = useState<string>(persisted?.empresa ?? '');
  const [competencia, setCompetencia] = useState<string>(() => {
    if (persisted?.competencia) return persisted.competencia;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ empresa, competencia }));
  }, [empresa, competencia]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provisões e Reflexos (DSR)</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de verbas, lançamentos por competência, calendário de feriados e apuração de DSR com memória de cálculo.
        </p>
      </div>

      <Tabs defaultValue="lancamentos" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="verbas">Verbas</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="apuracao">Apuração DSR</TabsTrigger>
        </TabsList>

        <TabsContent value="verbas" className="mt-4">
          <DsrVerbasTab />
        </TabsContent>
        <TabsContent value="lancamentos" className="mt-4">
          <DsrEntriesTab
            empresa={empresa}
            setEmpresa={setEmpresa}
            competencia={competencia}
            setCompetencia={setCompetencia}
          />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <DsrCalendarTab />
        </TabsContent>
        <TabsContent value="apuracao" className="mt-4">
          <DsrApuracaoTab empresa={empresa} competencia={competencia} />
        </TabsContent>
      </Tabs>
    </div>
  );
}