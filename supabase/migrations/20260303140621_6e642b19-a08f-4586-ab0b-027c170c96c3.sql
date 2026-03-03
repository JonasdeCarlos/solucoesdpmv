
-- Table: VAU/VAL parameters by UF, type, and competency
CREATE TABLE public.sero_vau_val (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf text NOT NULL DEFAULT 'MG',
  tipo_obra text NOT NULL DEFAULT 'residencial_unifamiliar',
  valor_m2 numeric NOT NULL,
  percentual_concreto numeric NOT NULL DEFAULT 0,
  competencia_inicio text NOT NULL,
  competencia_fim text NOT NULL,
  fonte text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sero_vau_val ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sero_vau_val" ON public.sero_vau_val FOR ALL USING (true) WITH CHECK (true);

-- Table: SERO construction parameters (technique percentages, reducers)
CREATE TABLE public.sero_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor numeric NOT NULL,
  descricao text,
  vigencia_inicio text,
  vigencia_fim text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sero_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sero_parametros" ON public.sero_parametros FOR ALL USING (true) WITH CHECK (true);

-- Table: Registered construction works (CNO)
CREATE TABLE public.sero_obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cno text NOT NULL,
  responsavel_tipo text NOT NULL DEFAULT 'PF',
  responsavel_nome text,
  responsavel_doc text,
  uf text NOT NULL DEFAULT 'MG',
  municipio text NOT NULL DEFAULT 'Camanducaia',
  endereco text,
  data_inicio date NOT NULL,
  data_termino date,
  data_termino_previsto date,
  categoria text NOT NULL DEFAULT 'obra_nova',
  tipo_obra text NOT NULL DEFAULT 'residencial_unifamiliar',
  area_principal numeric NOT NULL DEFAULT 0,
  area_complementar numeric NOT NULL DEFAULT 0,
  tecnica_construtiva text NOT NULL DEFAULT 'alvenaria',
  contabilidade_regular boolean NOT NULL DEFAULT false,
  folha_vinculada_id uuid,
  rateio_tipo text DEFAULT 'percentual',
  rateio_valor numeric DEFAULT 100,
  folha_total_projetada numeric DEFAULT 0,
  encargos_projetados numeric DEFAULT 0,
  observacoes_analista text,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sero_obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sero_obras" ON public.sero_obras FOR ALL USING (true) WITH CHECK (true);

-- Table: Deductions (concreto usinado, argamassa, massa asfáltica)
CREATE TABLE public.sero_deducoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.sero_obras(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  competencia text,
  nf_numero text,
  nf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sero_deducoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sero_deducoes" ON public.sero_deducoes FOR ALL USING (true) WITH CHECK (true);

-- Table: NF retentions (subcontractors)
CREATE TABLE public.sero_retencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.sero_obras(id) ON DELETE CASCADE,
  cnpj_fornecedor text,
  fornecedor_nome text,
  valor_bruto numeric NOT NULL DEFAULT 0,
  competencia text,
  retencao_valor numeric NOT NULL DEFAULT 0,
  aliquota_retencao numeric NOT NULL DEFAULT 0.11,
  nf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sero_retencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sero_retencoes" ON public.sero_retencoes FOR ALL USING (true) WITH CHECK (true);

-- Seed VAU/VAL data for all states (current values Feb 2026)
INSERT INTO public.sero_vau_val (uf, tipo_obra, valor_m2, percentual_concreto, competencia_inicio, competencia_fim, fonte) VALUES
('MG', 'residencial_unifamiliar', 2971.85, 4.68, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('MG', 'residencial_multifamiliar', 2578.22, 6.22, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('MG', 'comercial', 2894.81, 8.66, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('MG', 'galpao_industrial', 1273.47, 3.05, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('MG', 'projeto_social', 1670.11, 3.15, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('MG', 'casa_popular', 1670.11, 3.15, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('SP', 'residencial_unifamiliar', 2617.77, 4.90, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('RJ', 'residencial_unifamiliar', 3000.78, 4.94, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('PR', 'residencial_unifamiliar', 3231.99, 4.91, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('SC', 'residencial_unifamiliar', 3384.94, 4.79, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('RS', 'residencial_unifamiliar', 3354.96, 5.01, '2026-01', '2026-12', 'SERO/RFB Fev/2026'),
('ES', 'residencial_unifamiliar', 3293.16, 5.15, '2026-01', '2026-12', 'SERO/RFB Fev/2026');

-- Seed SERO parameters
INSERT INTO public.sero_parametros (chave, valor, descricao, vigencia_inicio, vigencia_fim) VALUES
('pct_mo_alvenaria', 0.40, 'Percentual de mão de obra - Alvenaria', '2026-01', '2026-12'),
('pct_mo_madeira', 0.30, 'Percentual de mão de obra - Madeira', '2026-01', '2026-12'),
('pct_mo_mista', 0.35, 'Percentual de mão de obra - Mista', '2026-01', '2026-12'),
('redutor_reforma', 0.50, 'Redutor para reforma (50% da obra nova)', '2026-01', '2026-12'),
('redutor_demolicao', 0.30, 'Redutor para demolição (30% da obra nova)', '2026-01', '2026-12'),
('redutor_ampliacao', 0.75, 'Redutor para ampliação (75% da obra nova)', '2026-01', '2026-12'),
('aliquota_patronal', 0.20, 'Alíquota INSS patronal', '2026-01', '2026-12'),
('aliquota_rat', 0.03, 'Alíquota RAT (construção civil)', '2026-01', '2026-12'),
('aliquota_terceiros', 0.058, 'Alíquota Terceiros (Sistema S)', '2026-01', '2026-12'),
('aliquota_retencao_nf', 0.11, 'Alíquota retenção NF (subempreitada)', '2026-01', '2026-12');
