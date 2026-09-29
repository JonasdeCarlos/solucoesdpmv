ALTER TABLE public.ts_empresa_config ADD COLUMN IF NOT EXISTS teto_retencao_cct numeric(5,2);
ALTER TABLE public.ts_funcionarios ADD COLUMN IF NOT EXISTS gera_lancamento boolean NOT NULL DEFAULT true;