
-- Tabela de parâmetros legais CPRB (editável pelo admin)
CREATE TABLE public.cprb_legal_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano INTEGER NOT NULL,
  competencia_inicio TEXT NOT NULL, -- YYYY-MM
  competencia_fim TEXT NOT NULL,    -- YYYY-MM
  setor TEXT NOT NULL DEFAULT 'construcao_civil',
  cnae TEXT,
  aliquota_cprb NUMERIC(6,4) NOT NULL, -- ex: 0.045 = 4.5%
  percentual_cprb_transicao NUMERIC(6,4) NOT NULL DEFAULT 1.0, -- % da CPRB aplicável na transição
  percentual_folha_transicao NUMERIC(6,4) NOT NULL DEFAULT 0.0, -- % da contrib sobre folha no cenário CPRB
  aliquota_patronal_folha NUMERIC(6,4) NOT NULL DEFAULT 0.20, -- 20% contribuição patronal
  regra_decimo_terceiro TEXT DEFAULT 'proporcional',
  observacoes_legais TEXT,
  fonte_legal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cprb_legal_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cprb_legal_parameters" ON public.cprb_legal_parameters FOR ALL USING (true) WITH CHECK (true);

-- Tabela de simulações salvas
CREATE TABLE public.cprb_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Simulação sem nome',
  empresa_nome TEXT,
  cnpj TEXT,
  cnae TEXT,
  regime_tributario TEXT NOT NULL DEFAULT 'Simples Nacional',
  competencia_inicial TEXT NOT NULL, -- YYYY-MM
  horizonte_meses INTEGER NOT NULL DEFAULT 12,
  tipo_analise TEXT NOT NULL DEFAULT 'consolidada', -- consolidada, por_obra, ambas
  receita_total NUMERIC(15,2) DEFAULT 0,
  folha_total NUMERIC(15,2) DEFAULT 0,
  decimo_terceiro NUMERIC(15,2) DEFAULT 0,
  pro_labore NUMERIC(15,2) DEFAULT 0,
  percentual_crescimento NUMERIC(6,4) DEFAULT 0,
  incluir_ferias BOOLEAN DEFAULT true,
  incluir_terco_ferias BOOLEAN DEFAULT true,
  incluir_decimo_terceiro BOOLEAN DEFAULT true,
  incluir_fgts BOOLEAN DEFAULT true,
  incluir_multa_fgts BOOLEAN DEFAULT false,
  percentual_multa_fgts NUMERIC(6,4) DEFAULT 0.40,
  incluir_rat_fap BOOLEAN DEFAULT false,
  aliquota_rat_fap NUMERIC(6,4) DEFAULT 0.03,
  incluir_terceiros BOOLEAN DEFAULT false,
  aliquota_terceiros NUMERIC(6,4) DEFAULT 0.058,
  percentual_rotatividade NUMERIC(6,4) DEFAULT 0,
  percentual_absenteismo NUMERIC(6,4) DEFAULT 0,
  legal_parameter_id UUID REFERENCES public.cprb_legal_parameters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cprb_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cprb_simulations" ON public.cprb_simulations FOR ALL USING (true) WITH CHECK (true);

-- Obras vinculadas a simulações
CREATE TABLE public.cprb_obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.cprb_simulations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  area_m2 NUMERIC(12,2) NOT NULL DEFAULT 0,
  receita_obra NUMERIC(15,2) DEFAULT 0,
  folha_obra NUMERIC(15,2) DEFAULT 0,
  criterio_rateio TEXT DEFAULT 'receita', -- receita, m2, folha_direta, manual
  percentual_rateio NUMERIC(6,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cprb_obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cprb_obras" ON public.cprb_obras FOR ALL USING (true) WITH CHECK (true);

-- Resultados mensais da simulação
CREATE TABLE public.cprb_simulation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.cprb_simulations(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- YYYY-MM
  mes_numero INTEGER NOT NULL,
  receita_mes NUMERIC(15,2) DEFAULT 0,
  folha_mes NUMERIC(15,2) DEFAULT 0,
  cprb_valor NUMERIC(15,2) DEFAULT 0,
  contrib_folha_transicao NUMERIC(15,2) DEFAULT 0,
  custo_cenario_cprb NUMERIC(15,2) DEFAULT 0,
  contrib_patronal_folha NUMERIC(15,2) DEFAULT 0,
  custo_cenario_folha NUMERIC(15,2) DEFAULT 0,
  diferenca_absoluta NUMERIC(15,2) DEFAULT 0,
  diferenca_percentual NUMERIC(8,4) DEFAULT 0,
  custo_mao_obra_cprb NUMERIC(15,2) DEFAULT 0,
  custo_mao_obra_folha NUMERIC(15,2) DEFAULT 0,
  custo_m2_cprb NUMERIC(12,4) DEFAULT 0,
  custo_m2_folha NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cprb_simulation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cprb_simulation_results" ON public.cprb_simulation_results FOR ALL USING (true) WITH CHECK (true);

-- Seed: Parâmetros legais de transição (Lei 14.973/2024)
INSERT INTO public.cprb_legal_parameters (ano, competencia_inicio, competencia_fim, setor, aliquota_cprb, percentual_cprb_transicao, percentual_folha_transicao, aliquota_patronal_folha, observacoes_legais, fonte_legal) VALUES
(2024, '2024-01', '2024-12', 'construcao_civil', 0.045, 1.0000, 0.0000, 0.20, 'CPRB integral sem reoneração', 'Lei 12.546/2011'),
(2025, '2025-01', '2025-12', 'construcao_civil', 0.045, 0.8000, 0.0500, 0.20, 'Reoneração gradual: 80% CPRB + 5% patronal sobre folha', 'Lei 14.973/2024 art. 7º'),
(2026, '2026-01', '2026-12', 'construcao_civil', 0.045, 0.6000, 0.1000, 0.20, 'Reoneração gradual: 60% CPRB + 10% patronal sobre folha', 'Lei 14.973/2024 art. 7º'),
(2027, '2027-01', '2027-12', 'construcao_civil', 0.045, 0.4000, 0.1500, 0.20, 'Reoneração gradual: 40% CPRB + 15% patronal sobre folha', 'Lei 14.973/2024 art. 7º'),
(2028, '2028-01', '2028-12', 'construcao_civil', 0.0000, 0.0000, 0.2000, 0.20, 'Reoneração total: 20% patronal sobre folha', 'Lei 14.973/2024 art. 7º');
