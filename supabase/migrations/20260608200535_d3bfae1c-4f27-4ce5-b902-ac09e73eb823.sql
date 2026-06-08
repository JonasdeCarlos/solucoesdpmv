
-- 1. aviso_empresas: novo campo digisac_contact_id + saneamento do whatsapp
ALTER TABLE public.aviso_empresas
  ADD COLUMN IF NOT EXISTS digisac_contact_id text;

CREATE INDEX IF NOT EXISTS idx_aviso_empresas_whatsapp
  ON public.aviso_empresas(whatsapp);
CREATE INDEX IF NOT EXISTS idx_aviso_empresas_digisac_contact
  ON public.aviso_empresas(digisac_contact_id);

CREATE OR REPLACE FUNCTION public.sanitize_aviso_empresa_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := regexp_replace(NEW.whatsapp, '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_aviso_empresa_whatsapp ON public.aviso_empresas;
CREATE TRIGGER trg_sanitize_aviso_empresa_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.aviso_empresas
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_aviso_empresa_whatsapp();

-- 2. Tabela de log dos envios Digisac do módulo Avisos
CREATE TABLE IF NOT EXISTS public.avisos_envios_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES public.aviso_empresas(id) ON DELETE SET NULL,
  aviso_id        uuid REFERENCES public.avisos(id) ON DELETE SET NULL,
  tipo_aviso      text CHECK (tipo_aviso IN ('aviso1','aviso2','aviso3','ligacao')),
  payload_enviado jsonb,
  response_status int,
  response_body   jsonb,
  sucesso         boolean,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.avisos_envios_log TO anon, authenticated;
GRANT ALL ON public.avisos_envios_log TO service_role;

ALTER TABLE public.avisos_envios_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avisos_envios_log_select_public" ON public.avisos_envios_log;
CREATE POLICY "avisos_envios_log_select_public"
  ON public.avisos_envios_log
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_avisos_envios_log_empresa
  ON public.avisos_envios_log(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avisos_envios_log_aviso
  ON public.avisos_envios_log(aviso_id, created_at DESC);
