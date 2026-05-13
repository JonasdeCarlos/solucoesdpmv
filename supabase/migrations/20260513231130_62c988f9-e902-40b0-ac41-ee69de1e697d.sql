ALTER TABLE public.aviso_empresas ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '';
ALTER TABLE public.avisos ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '';