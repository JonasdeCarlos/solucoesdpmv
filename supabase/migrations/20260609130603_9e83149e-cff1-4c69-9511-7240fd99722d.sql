
ALTER TABLE public.client_ccts
  ADD COLUMN IF NOT EXISTS instrumento_tipo text,
  ADD COLUMN IF NOT EXISTS numero_registro_mte text,
  ADD COLUMN IF NOT EXISTS abrangencia_territorial text,
  ADD COLUMN IF NOT EXISTS categoria_abrangida text,
  ADD COLUMN IF NOT EXISTS sindicato_laboral_nome text,
  ADD COLUMN IF NOT EXISTS sindicato_laboral_cnpj text,
  ADD COLUMN IF NOT EXISTS sindicato_laboral_endereco text,
  ADD COLUMN IF NOT EXISTS sindicato_laboral_representante text,
  ADD COLUMN IF NOT EXISTS sindicato_patronal_nome text,
  ADD COLUMN IF NOT EXISTS sindicato_patronal_cnpj text,
  ADD COLUMN IF NOT EXISTS sindicato_patronal_endereco text,
  ADD COLUMN IF NOT EXISTS sindicato_patronal_representante text;
