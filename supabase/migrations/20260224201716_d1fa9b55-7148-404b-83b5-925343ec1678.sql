
-- ========================================
-- Tabela: das_anexos_faixas
-- Faixas tributárias do Simples Nacional por Anexo
-- ========================================
CREATE TABLE public.das_anexos_faixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anexo TEXT NOT NULL, -- 'I','II','III','IV','V'
  faixa INTEGER NOT NULL,
  rbt12_min NUMERIC NOT NULL DEFAULT 0,
  rbt12_max NUMERIC NOT NULL,
  aliquota_nominal NUMERIC NOT NULL, -- ex: 0.045 = 4.5%
  parcela_deduzir NUMERIC NOT NULL DEFAULT 0,
  competencia_inicio TEXT NOT NULL, -- YYYY-MM
  competencia_fim TEXT NOT NULL,    -- YYYY-MM
  ativo BOOLEAN NOT NULL DEFAULT true,
  fonte_legal TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.das_anexos_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to das_anexos_faixas" ON public.das_anexos_faixas FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- Tabela: das_cnae_anexo
-- Mapeamento CNAE → Anexo sugerido
-- ========================================
CREATE TABLE public.das_cnae_anexo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnae TEXT NOT NULL,
  descricao TEXT,
  anexo_sugerido TEXT NOT NULL, -- 'I','II','III','IV','V'
  exige_fator_r BOOLEAN NOT NULL DEFAULT false,
  fator_r_limite NUMERIC DEFAULT 0.28, -- 28%
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.das_cnae_anexo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to das_cnae_anexo" ON public.das_cnae_anexo FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- SEED: Anexo IV – Construção Civil (LC 123/2006 vigente)
-- ========================================
INSERT INTO public.das_anexos_faixas (anexo, faixa, rbt12_min, rbt12_max, aliquota_nominal, parcela_deduzir, competencia_inicio, competencia_fim, fonte_legal) VALUES
('IV', 1, 0,       180000,   0.045,  0,       '2018-01', '2028-12', 'LC 123/2006, Anexo IV'),
('IV', 2, 180000,  360000,   0.09,   8100,    '2018-01', '2028-12', 'LC 123/2006, Anexo IV'),
('IV', 3, 360000,  720000,   0.102,  12420,   '2018-01', '2028-12', 'LC 123/2006, Anexo IV'),
('IV', 4, 720000,  1800000,  0.14,   39780,   '2018-01', '2028-12', 'LC 123/2006, Anexo IV'),
('IV', 5, 1800000, 3600000,  0.22,   183780,  '2018-01', '2028-12', 'LC 123/2006, Anexo IV'),
('IV', 6, 3600000, 4800000,  0.33,   828000,  '2018-01', '2028-12', 'LC 123/2006, Anexo IV');

-- SEED: Mapeamento CNAE construção civil → Anexo IV
INSERT INTO public.das_cnae_anexo (cnae, descricao, anexo_sugerido, exige_fator_r, observacoes) VALUES
('4120-4/00', 'Construção de edifícios', 'IV', false, 'CPP não inclusa no DAS — recolher separadamente'),
('4399-1/01', 'Administração de obras', 'IV', false, 'CPP não inclusa no DAS'),
('4399-1/99', 'Serviços especializados para construção', 'IV', false, 'CPP não inclusa no DAS'),
('4110-7/00', 'Incorporação de empreendimentos imobiliários', 'IV', false, 'Verificar enquadramento com contador'),
('4313-4/00', 'Obras de terraplenagem', 'IV', false, 'CPP não inclusa no DAS');
