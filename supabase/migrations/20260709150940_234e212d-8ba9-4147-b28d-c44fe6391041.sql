ALTER TABLE public.prize_policies
  ADD COLUMN IF NOT EXISTS remuneracao_variavel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rv_base text NOT NULL DEFAULT 'faturamento',
  ADD COLUMN IF NOT EXISTS rv_base_label text,
  ADD COLUMN IF NOT EXISTS rv_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rv_pct_individual numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rv_pct_igualitario numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rv_observacoes text;