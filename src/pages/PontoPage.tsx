import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';
import PontoHeader from '@/components/ponto/PontoHeader';
import PontoGrid from '@/components/ponto/PontoGrid';
import PontoSummary from '@/components/ponto/PontoSummary';
import PontoPrintView from '@/components/ponto/PontoPrintView';
import PontoOcrImport from '@/components/ponto/PontoOcrImport';
import {
  type PontoIdentificacao,
  type PontoConfig,
  type PontoDia,
  createDefaultConfig,
  createDefaultIdentificacao,
  gerarDiasMes,
} from '@/types/ponto';
import { calcularDia, calcularResumo } from '@/utils/pontoCalculations';

const STORAGE_KEY = 'ponto_apuracao';

const PontoPage: React.FC = () => {
  const [identificacao, setIdentificacao] = useState<PontoIdentificacao>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).identificacao;
    } catch {}
    return createDefaultIdentificacao();
  });

  const [config, setConfig] = useState<PontoConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).config;
    } catch {}
    return createDefaultConfig();
  });

  const [dias, setDias] = useState<PontoDia[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dias?.length > 0 && parsed.identificacao?.mesAno === identificacao.mesAno) {
          return parsed.dias;
        }
      }
    } catch {}
    return gerarDiasMes(identificacao.mesAno, config);
  });

  // Re-generate days when month or column count changes
  const handleIdentificacaoChange = useCallback((newId: PontoIdentificacao) => {
    setIdentificacao(prev => {
      if (newId.mesAno !== prev.mesAno) {
        setDias(gerarDiasMes(newId.mesAno, config));
      }
      return newId;
    });
  }, [config]);

  const handleConfigChange = useCallback((newCfg: PontoConfig) => {
    setConfig(prev => {
      // Update column count
      if (newCfg.colunasMarcacoes !== prev.colunasMarcacoes) {
        setDias(current =>
          current.map(d => {
            const newMarks = Array(newCfg.colunasMarcacoes).fill('');
            d.marcacoes.forEach((m, i) => {
              if (i < newCfg.colunasMarcacoes) newMarks[i] = m;
            });
            return { ...d, marcacoes: newMarks };
          })
        );
      }

      // Apply weekly schedule changes to existing days
      if (newCfg.jornadaSemanal && JSON.stringify(newCfg.jornadaSemanal) !== JSON.stringify(prev.jornadaSemanal)) {
        setDias(current =>
          current.map(d => {
            const novaJornada = newCfg.jornadaSemanal[d.diaSemana as keyof typeof newCfg.jornadaSemanal] ?? d.horasACumprir;
            const semJornada = novaJornada === '00:00' || novaJornada === '';
            return {
              ...d,
              horasACumprir: novaJornada,
              tipoDia: semJornada ? 'folga_dsr' : (d.tipoDia === 'folga_dsr' ? 'normal' : d.tipoDia),
            };
          })
        );
      }

      return newCfg;
    });
  }, []);

  const handleDiaChange = useCallback((index: number, dia: PontoDia) => {
    setDias(prev => {
      const next = [...prev];
      next[index] = dia;
      return next;
    });
  }, []);

  const handleLimparMarcacoes = useCallback(() => {
    setDias(prev => prev.map(d => ({
      ...d,
      marcacoes: Array(config.colunasMarcacoes).fill(''),
    })));
  }, [config.colunasMarcacoes]);

  const handleImportDias = useCallback((importedDias: typeof dias) => {
    setDias(importedDias);
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ identificacao, config, dias }));
  }, [identificacao, config, dias]);

  const diasCalculados = useMemo(() =>
    dias.map(d => calcularDia(d, config)),
    [dias, config]
  );

  const resumo = useMemo(() => calcularResumo(diasCalculados), [diasCalculados]);

  return (
    <div className="space-y-6">
      <PontoHeader
        identificacao={identificacao}
        config={config}
        onIdentificacaoChange={handleIdentificacaoChange}
        onConfigChange={handleConfigChange}
      />

      <div className="flex justify-between items-center">
        <PontoOcrImport
          config={config}
          dias={dias}
          mesAno={identificacao.mesAno}
          onImportDias={handleImportDias}
        />
        <Button variant="outline" size="sm" onClick={handleLimparMarcacoes} className="gap-1.5">
          <Eraser className="w-4 h-4" />
          Limpar Marcações
        </Button>
      </div>

      <PontoGrid
        dias={dias}
        diasCalculados={diasCalculados}
        config={config}
        onDiaChange={handleDiaChange}
      />

      <PontoSummary resumo={resumo} />

      <PontoPrintView
        identificacao={identificacao}
        config={config}
        diasCalculados={diasCalculados}
        resumo={resumo}
      />

      <p className="text-xs text-muted-foreground text-center pb-4">
        ⚠️ Apuração estimativa para conferência. Pode haver regras específicas por CCT, escalas e acordos.
      </p>
    </div>
  );
};

export default PontoPage;
