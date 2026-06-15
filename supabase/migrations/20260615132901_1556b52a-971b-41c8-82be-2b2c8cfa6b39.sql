ALTER TABLE public.client_dp_profile
  ADD COLUMN IF NOT EXISTS procuracao_govbr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS procuracao_conectividade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS govbr_duas_etapas boolean NOT NULL DEFAULT false;