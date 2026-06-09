ALTER TABLE public.aviso_empresas
  ADD COLUMN IF NOT EXISTS gestor_digisac_user_id text NULL;

CREATE INDEX IF NOT EXISTS idx_aviso_empresas_gestor_digisac
  ON public.aviso_empresas(gestor_digisac_user_id);

ALTER TABLE public.avisos_envios_log
  ADD COLUMN IF NOT EXISTS gestor_user_id text NULL;