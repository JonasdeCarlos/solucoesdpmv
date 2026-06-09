ALTER TABLE public.client_dp_profile
  ADD COLUMN IF NOT EXISTS sst_empresa text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sst_contato_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sst_contato_telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sst_contato_email text NOT NULL DEFAULT '';